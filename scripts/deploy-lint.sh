#!/bin/sh
# Static checks for deploy/pc/compose.yml. Needs Docker (for `compose config`) and python3, but no
# running stack and no real secrets: it renders the file with a throwaway generated .env.
#   scripts/deploy-lint.sh
set -eu
cd "$(dirname "$0")/.."

compose=deploy/pc/compose.yml
example=deploy/pc/.env.example

command -v python3 >/dev/null || { echo "deploy-lint: python3 is required" >&2; exit 1; }
[ -f "$compose" ] || { echo "deploy-lint: $compose is missing" >&2; exit 1; }
[ -f "$example" ] || { echo "deploy-lint: $example is missing" >&2; exit 1; }

# The real .env must never be committed.
git check-ignore -q deploy/pc/.env || { echo "deploy-lint: deploy/pc/.env is not git-ignored" >&2; exit 1; }
git check-ignore -q deploy/pc/secrets/x || { echo "deploy-lint: deploy/pc/secrets/ is not git-ignored" >&2; exit 1; }

# A throwaway .env: every variable .env.example names, set to a sentinel that is not a real secret.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
sed -n 's/^\([A-Z][A-Z0-9_]*\)=.*/\1/p' "$example" | while read -r name; do
	# The port must be a number for compose to render it.
	if [ "$name" = AJ_API_PORT ]; then echo "$name=18110"; else echo "$name=lint-sentinel-$name"; fi
done >"$tmp/env"

docker compose -f "$compose" --env-file "$tmp/env" config --format json >"$tmp/config.json"

python3 -I - "$compose" "$example" "$tmp/config.json" <<'PY'
import json
import re
import sys

compose_path, example_path, config_path = sys.argv[1:4]
failures = []


def fail(message):
    failures.append(message)


config = json.load(open(config_path))
services = config.get("services", {})
raw = open(compose_path).read()

# Variables: the compose file interpolates exactly the ones .env.example names.
used = set(re.findall(r"(?<!\$)\$\{([A-Z][A-Z0-9_]*)", raw))
named = set(re.findall(r"^([A-Z][A-Z0-9_]*)=", open(example_path).read(), re.M))
if used != named:
    fail(f".env.example and {compose_path} disagree: only in compose {sorted(used - named)}, "
         f"only in .env.example {sorted(named - used)}")

# Every variable but the port is a secret or a required value: no default, an error when unset.
for name in sorted(used - {"AJ_API_PORT"}):
    if not re.search(r"\$\{" + name + r":\?[^}]+\}", raw):
        fail(f"{name} must be interpolated as ${{{name}:?message}}, with no default")
    if re.search(r"\$\{" + name + r"(:-|-|\})", raw):
        fail(f"{name} is interpolated with a default or without the :? check")

expected = {"api", "postgres", "redis", "garage"}
if set(services) != expected:
    fail(f"services are {sorted(services)}, expected {sorted(expected)}")

# Secrets must not appear on a command line, where `docker inspect` and `ps` show them.
for name, svc in services.items():
    for key in ("command", "entrypoint"):
        if "lint-sentinel-" in json.dumps(svc.get(key)):
            fail(f"{name}: a secret is rendered into {key}")

for name, svc in services.items():
    if svc.get("restart") != "unless-stopped":
        fail(f"{name}: restart must be unless-stopped")
    test = svc.get("healthcheck", {}).get("test")
    if not test or test == ["NONE"]:
        fail(f"{name}: no healthcheck")
    elif re.search(r"\b(curl|wget)\b", json.dumps(test)):
        fail(f"{name}: the healthcheck uses curl or wget, which the image may not have")
    image = svc.get("image", "")
    if "build" not in svc:
        tag = image.rsplit(":", 1)[1] if ":" in image.rsplit("/", 1)[-1] else ""
        if tag in ("", "latest"):
            fail(f"{name}: image {image!r} is untagged or latest")
        if "wud.tag.include" not in svc.get("labels", {}):
            fail(f"{name}: missing the wud.tag.include label")
    # Memory: an explicit cap with no swap (memswap_limit equal to mem_limit), so the file does not
    # depend on the host's default.
    mem = svc.get("mem_limit")
    if not mem or svc.get("memswap_limit") != mem:
        fail(f"{name}: set mem_limit and an equal memswap_limit (a cap with no swap)")

    ports = svc.get("ports", [])
    if name == "api":
        if len(ports) != 1 or ports[0].get("host_ip") != "192.168.1.195":
            fail(f"api: must publish exactly one port, on 192.168.1.195 only: {ports}")
        elif ports[0].get("target") != 8080:
            fail("api: the published port must map to container port 8080")
    elif ports:
        fail(f"{name}: must not publish a port")

    nets = set(svc.get("networks", {}) or {"default": None})
    if name != "api" and nets != {"backend"}:
        fail(f"{name}: must be on the backend network only, not {sorted(nets)}")
    if name == "api" and nets != {"backend", "default"}:
        fail(f"api: must be on backend and default, not {sorted(nets)}")

api = services.get("api", {})
labels = api.get("labels", {})
if labels.get("wud.watch") != "false":
    fail('api: label wud.watch must be "false"')
if not labels.get("monitoring.http.path"):
    fail("api: missing the monitoring.http.path label")

if not config.get("networks", {}).get("backend", {}).get("internal"):
    fail("the backend network must be internal")

if failures:
    for message in failures:
        print("deploy-lint: " + message, file=sys.stderr)
    sys.exit(1)
print("deploy-lint: ok")
PY

# Env-file parsing: deploy.sh and garage-init.sh must read the .env the way Compose does (quotes
# stripped, trailing comments dropped), or the empty-variable check and the key bootstrap would use
# a different value from the one the containers get. A fake `docker` stands in for the stack: it
# fails the run if `up` is reached and answers the garage subcommands, logging what key import got.
real_docker=$(command -v docker)
mkdir -p "$tmp/bin"
cat >"$tmp/bin/docker" <<SHIM
#!/bin/sh
for a in "\$@"; do
	[ "\$a" = up ] && { echo "UNEXPECTED: docker up reached" >>"$tmp/calls"; exit 99; }
done
case " \$* " in
*" exec "*)
	while [ "\$1" != /garage ]; do shift; done
	shift
	case "\$1 \$2" in
	"layout show") echo "Current cluster layout version: 1" ;;
	"key info") exit 1 ;;
	"key import")
		# Logged one argument per line, so a value with spaces stays visible.
		printf 'key-import:%s\n' "\$@" >>"$tmp/calls" ;;
	*) ;;
	esac
	exit 0 ;;
esac
exec "$real_docker" "\$@"
SHIM
chmod +x "$tmp/bin/docker"

cat >"$tmp/quoted.env" <<'ENV'
POSTGRES_PASSWORD="pg pass"
REDIS_PASSWORD='redis'
EDGE_KEY="0123456789abcdef0123456789abcdef"
GARAGE_RPC_SECRET=raw
GARAGE_ADMIN_TOKEN=admin # trailing comment
GARAGE_METRICS_TOKEN=metrics
S3_ACCESS_KEY_ID="GKquoted"
S3_SECRET_ACCESS_KEY='quoted-secret'
AJ_API_PORT="18110"
ENV

# garage-init.sh imports the unquoted values.
: >"$tmp/calls"
PATH="$tmp/bin:$PATH" AJ_PC_ENV_FILE="$tmp/quoted.env" AJ_PC_PROJECT=aj-lint-test deploy/pc/garage-init.sh >/dev/null
for expected in key-import:GKquoted key-import:quoted-secret; do
	grep -qx -- "$expected" "$tmp/calls" || { echo "deploy-lint: garage-init.sh did not pass the unquoted value ($expected); calls:" >&2; cat "$tmp/calls" >&2; exit 1; }
done

# deploy.sh treats a quoted-empty value as empty and stops before Docker starts anything.
sed 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=""/' "$tmp/quoted.env" >"$tmp/empty.env"
: >"$tmp/calls"
if PATH="$tmp/bin:$PATH" AJ_PC_ENV_FILE="$tmp/empty.env" AJ_PC_PROJECT=aj-lint-test scripts/deploy.sh pc >/dev/null 2>"$tmp/err"; then
	echo "deploy-lint: deploy.sh accepted POSTGRES_PASSWORD=\"\"" >&2
	exit 1
fi
grep -q 'POSTGRES_PASSWORD' "$tmp/err" || { echo "deploy-lint: deploy.sh did not name the empty POSTGRES_PASSWORD" >&2; cat "$tmp/err" >&2; exit 1; }
! grep -q UNEXPECTED "$tmp/calls" || { echo "deploy-lint: deploy.sh reached docker up with an empty password" >&2; exit 1; }

# deploy.sh also stops on an EDGE_KEY under 32 characters (the API would refuse to start with it), and
# accepts exactly 32.
sed 's/^EDGE_KEY=.*/EDGE_KEY="0123456789abcdef0123456789abcde"/' "$tmp/quoted.env" >"$tmp/short.env"
: >"$tmp/calls"
if PATH="$tmp/bin:$PATH" AJ_PC_ENV_FILE="$tmp/short.env" AJ_PC_PROJECT=aj-lint-test scripts/deploy.sh pc >/dev/null 2>"$tmp/err"; then
	echo "deploy-lint: deploy.sh accepted a 31-character EDGE_KEY" >&2
	exit 1
fi
grep -q 'EDGE_KEY' "$tmp/err" || { echo "deploy-lint: deploy.sh did not name the short EDGE_KEY" >&2; cat "$tmp/err" >&2; exit 1; }
! grep -q UNEXPECTED "$tmp/calls" || { echo "deploy-lint: deploy.sh reached docker up with a short EDGE_KEY" >&2; exit 1; }
: >"$tmp/calls"
PATH="$tmp/bin:$PATH" AJ_PC_ENV_FILE="$tmp/quoted.env" AJ_PC_PROJECT=aj-lint-test scripts/deploy.sh pc >/dev/null 2>"$tmp/err" || true
! grep -q 'EDGE_KEY' "$tmp/err" || { echo "deploy-lint: deploy.sh rejected a 32-character EDGE_KEY" >&2; cat "$tmp/err" >&2; exit 1; }
echo "deploy-lint: env parsing ok"
