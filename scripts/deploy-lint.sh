#!/bin/sh
# Static checks for deploy/pc/compose.yml and deploy/pi/compose.yml. Needs Docker (for `compose config`) and
# python3, but no running stack and no real secrets: it renders each file with a throwaway generated .env.
#   scripts/deploy-lint.sh
set -eu
cd "$(dirname "$0")/.."

# The variables that may be empty (AJ_OPTIONAL_VARS, AJ_PI_OPTIONAL_VARS): lists shared with scripts/deploy.sh.
. deploy/pc/env-lib.sh

command -v python3 >/dev/null || { echo "deploy-lint: python3 is required" >&2; exit 1; }

# The two deployments: name, then the lists. `optional_of` gives a deployment's optional variables.
optional_of() {
	case $1 in
	pc) echo "$AJ_OPTIONAL_VARS" ;;
	pi) echo "$AJ_PI_OPTIONAL_VARS" ;;
	esac
}

tmp=$(mktemp -d)
# The staged folder of the deploy.sh pi tests below lives under the repo (the publish step needs it there).
trap 'rm -rf "$tmp" "build/lint-stage-$$"' EXIT

for kind in pc pi; do
	[ -f "deploy/$kind/compose.yml" ] || { echo "deploy-lint: deploy/$kind/compose.yml is missing" >&2; exit 1; }
	[ -f "deploy/$kind/.env.example" ] || { echo "deploy-lint: deploy/$kind/.env.example is missing" >&2; exit 1; }
	# The real .env must never be committed.
	git check-ignore -q "deploy/$kind/.env" || { echo "deploy-lint: deploy/$kind/.env is not git-ignored" >&2; exit 1; }
	# A throwaway .env: every variable .env.example names, set to a sentinel that is not a real secret.
	sed -n 's/^\([A-Z][A-Z0-9_]*\)=.*/\1/p' "deploy/$kind/.env.example" | while read -r name; do
		# A port must be a number for compose to render it.
		case $name in
		AJ_API_PORT) echo "$name=18110" ;;
		AJ_EDGE_PORT) echo "$name=18180" ;;
		AJ_TUNNEL_PORT) echo "$name=18181" ;;
		*) echo "$name=lint-sentinel-$name" ;;
		esac
	done >"$tmp/env-$kind"
done
git check-ignore -q deploy/pc/secrets/x || { echo "deploy-lint: deploy/pc/secrets/ is not git-ignored" >&2; exit 1; }
git check-ignore -q build/pi/x || { echo "deploy-lint: build/pi/ (the staged edge) is not git-ignored" >&2; exit 1; }

compose=deploy/pc/compose.yml
example=deploy/pc/.env.example

# The compose checks, in a file so the same code can run on the real files and on broken copies of them.
# Usage: compose-lint.py KIND COMPOSE EXAMPLE CONFIG.json "OPTIONAL VARS"
cat >"$tmp/compose-lint.py" <<'PY'
import json
import re
import sys

kind, compose_path, example_path, config_path = sys.argv[1:5]
optional = set(sys.argv[5].split())
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

# Every variable is either required or optional (the lists in deploy/pc/env-lib.sh). A required one is a
# secret or a needed value: no default, an error when unset. An optional one has a default, so an empty or
# missing value never stops compose.
for name in sorted(used - optional):
    if not re.search(r"\$\{" + name + r":\?[^}]+\}", raw):
        fail(f"{name} must be interpolated as ${{{name}:?message}}, with no default")
    if re.search(r"\$\{" + name + r"(:-|-|\})", raw):
        fail(f"{name} is interpolated with a default or without the :? check")
for name in sorted(used & optional):
    if not re.search(r"\$\{" + name + r":-[^}]*\}", raw):
        fail(f"{name} is optional and must be interpolated as ${{{name}:-default}}")
    if re.search(r"\$\{" + name + r":\?", raw):
        fail(f"{name} is optional but is interpolated with the :? check")
for name in sorted(optional - named):
    fail(f"{name} is in the optional list (deploy/pc/env-lib.sh) but not in {example_path}")

# Secrets must not appear on a command line, where `docker inspect` and `ps` show them.
for name, svc in services.items():
    for key in ("command", "entrypoint"):
        if "lint-sentinel-" in json.dumps(svc.get(key)):
            fail(f"{name}: a secret is rendered into {key}")

# The conventions every service follows, on either machine.
for name, svc in services.items():
    if svc.get("restart") != "unless-stopped":
        fail(f"{name}: restart must be unless-stopped")
    test = svc.get("healthcheck", {}).get("test")
    if not test or test == ["NONE"]:
        fail(f"{name}: no healthcheck")
    elif re.search(r"\b(curl|wget)\b", json.dumps(test)):
        fail(f"{name}: the healthcheck uses curl or wget, which the image may not have")
    image = svc.get("image", "")
    labels = svc.get("labels", {})
    if "build" not in svc:
        tag = image.rsplit(":", 1)[1] if ":" in image.rsplit("/", 1)[-1] else ""
        if tag in ("", "latest"):
            fail(f"{name}: image {image!r} is untagged or latest")
        if "wud.tag.include" not in labels:
            fail(f"{name}: missing the wud.tag.include label")
    elif labels.get("wud.watch") != "false":
        fail(f'{name}: a built image needs the label wud.watch: "false"')
    # Memory: an explicit cap with no swap (memswap_limit equal to mem_limit), so the file does not
    # depend on the host's default.
    mem = svc.get("mem_limit")
    if not mem or svc.get("memswap_limit") != mem:
        fail(f"{name}: set mem_limit and an equal memswap_limit (a cap with no swap)")
    # A published port names the one address it listens on, never every interface; a service that publishes
    # one is monitored over HTTP.
    ports = svc.get("ports", [])
    for port in ports:
        if port.get("host_ip") in (None, "", "0.0.0.0", "::"):
            fail(f"{name}: port {port.get('target')} must be published on one named address, not every interface")
    if ports and not labels.get("monitoring.http.path"):
        fail(f"{name}: missing the monitoring.http.path label")

if kind == "pc":
    expected = {"api", "postgres", "redis", "garage"}
    if set(services) != expected:
        fail(f"services are {sorted(services)}, expected {sorted(expected)}")
    for name, svc in services.items():
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

    if not config.get("networks", {}).get("backend", {}).get("internal"):
        fail("the backend network must be internal")
else:
    # The edge on the Pi: one service with two listeners. The LAN one is published on the Pi's LAN address; the
    # tunnel one (the only one that believes CF-Connecting-IP) on localhost only, for cloudflared.
    if set(services) != {"edge"}:
        fail(f"services are {sorted(services)}, expected ['edge']")
    edge = services.get("edge", {})
    ports = edge.get("ports", [])
    by_target = {p.get("target"): p for p in ports}
    if len(ports) != 2 or set(by_target) != {8080, 8081}:
        fail(f"edge: must publish exactly the LAN port (container 8080) and the tunnel port (container 8081): {ports}")
    else:
        if by_target[8080].get("host_ip") != "192.168.1.69":
            fail("edge: the LAN port (container 8080) must be published on 192.168.1.69 only")
        if by_target[8081].get("host_ip") != "127.0.0.1":
            fail("edge: the tunnel port (container 8081) must be published on 127.0.0.1 only, so only cloudflared reaches it")
    if not re.fullmatch(r"\d+", edge.get("labels", {}).get("monitoring.http.port", "")):
        fail("edge: the monitoring.http.port label must be the published LAN port, as a number")

if failures:
    for message in failures:
        print("deploy-lint: " + message, file=sys.stderr)
    sys.exit(1)
print("deploy-lint: ok")
PY

# render KIND COMPOSE OUT: the compose file as JSON, with the throwaway .env.
render() {
	docker compose -f "$2" --env-file "$tmp/env-$1" config --format json >"$3"
}

for kind in pc pi; do
	render "$kind" "deploy/$kind/compose.yml" "$tmp/config-$kind.json"
	echo "deploy-lint: $kind:"
	python3 -I "$tmp/compose-lint.py" "$kind" "deploy/$kind/compose.yml" "deploy/$kind/.env.example" "$tmp/config-$kind.json" "$(optional_of "$kind")"
done

# The lint must catch the mistakes it exists for: break the real file one way at a time (a sed script) and
# expect a failure that names the variable or setting.
must_fail() {
	kind=$1
	label=$2
	script=$3
	variable=$4
	file=deploy/$kind/compose.yml
	sed "$script" "$file" >"$tmp/mutated.yml"
	cmp -s "$file" "$tmp/mutated.yml" && { echo "deploy-lint: the mutation for $label changed nothing" >&2; exit 1; }
	render "$kind" "$tmp/mutated.yml" "$tmp/mutated.json"
	if python3 -I "$tmp/compose-lint.py" "$kind" "$tmp/mutated.yml" "deploy/$kind/.env.example" "$tmp/mutated.json" "$(optional_of "$kind")" >/dev/null 2>"$tmp/err"; then
		echo "deploy-lint: the lint accepted $label" >&2
		exit 1
	fi
	grep -q -- "$variable" "$tmp/err" || { echo "deploy-lint: the lint failed for $label but did not name $variable:" >&2; cat "$tmp/err" >&2; exit 1; }
}
must_fail pc "an optional variable written with :?" 's/\${SMTP_HOST:-}/${SMTP_HOST:?set SMTP_HOST}/' SMTP_HOST
must_fail pc "an optional variable written without a default" 's/\${EMAIL_FROM:-}/${EMAIL_FROM}/' EMAIL_FROM
must_fail pc "a required variable written with :-" 's/\${EDGE_KEY:?[^}]*}/${EDGE_KEY:-}/' EDGE_KEY
must_fail pc "a required variable written bare" 's/\${REDIS_PASSWORD:?[^}]*}/${REDIS_PASSWORD}/g' REDIS_PASSWORD
must_fail pi "a required variable written with :-" 's/\${EDGE_KEY:?[^}]*}/${EDGE_KEY:-}/' EDGE_KEY
must_fail pi "an optional variable written with :?" 's/\${AJ_API_URL:-[^}]*}/${AJ_API_URL:?set AJ_API_URL}/' AJ_API_URL
must_fail pi "a tunnel port with no bind address" 's/"127\.0\.0\.1:\${AJ_TUNNEL_PORT/"${AJ_TUNNEL_PORT/' tunnel
must_fail pi "a tunnel port published on 0.0.0.0" 's/"127\.0\.0\.1:\${AJ_TUNNEL_PORT/"0.0.0.0:${AJ_TUNNEL_PORT/' tunnel
must_fail pi "a LAN port published on every interface" 's/"192\.168\.1\.69:\${AJ_EDGE_PORT/"0.0.0.0:${AJ_EDGE_PORT/' 192.168.1.69
must_fail pi "a service with no memswap_limit" '/memswap_limit/d' memswap_limit
must_fail pi "a service that restarts never" 's/restart: unless-stopped/restart: "no"/' restart
must_fail pi "a built image without wud.watch false" '/wud.watch/d' wud.watch
must_fail pi "a healthcheck that uses curl" 's/\["CMD", "dotnet", "\/app\/ActionJackson.Edge.dll", "--healthcheck"\]/["CMD", "curl", "-f", "http:\/\/localhost:8080\/healthz"]/' curl
echo "deploy-lint: variable checks ok"

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

# deploy.sh's empty-value check skips exactly the optional variables. Start from a full valid env (optional
# ones empty, the rest from quoted.env or a sentinel), then empty each variable .env.example names in turn:
# an optional one must get past the check (to `docker up`, where the fake docker stops it), any other must
# stop it by name.
names=$(sed -n 's/^\([A-Z][A-Z0-9_]*\)=.*/\1/p' "$example")
: >"$tmp/full.env"
for each in $names; do
	if env_is_optional "$each"; then
		echo "$each=" >>"$tmp/full.env"
	elif grep -q "^$each=" "$tmp/quoted.env"; then
		grep "^$each=" "$tmp/quoted.env" >>"$tmp/full.env"
	else
		echo "$each=lint-sentinel-$each" >>"$tmp/full.env"
	fi
done
for name in $names; do
	grep -v "^$name=" "$tmp/full.env" >"$tmp/case.env"
	echo "$name=" >>"$tmp/case.env"
	: >"$tmp/calls"
	PATH="$tmp/bin:$PATH" AJ_PC_ENV_FILE="$tmp/case.env" AJ_PC_PROJECT=aj-lint-test scripts/deploy.sh pc >/dev/null 2>"$tmp/err" || true
	if env_is_optional "$name"; then
		! grep -q 'empty or missing' "$tmp/err" || { echo "deploy-lint: deploy.sh refused an empty optional $name" >&2; cat "$tmp/err" >&2; exit 1; }
		grep -q UNEXPECTED "$tmp/calls" || { echo "deploy-lint: deploy.sh did not get past its checks with $name empty" >&2; cat "$tmp/err" >&2; exit 1; }
	else
		grep -q "empty or missing.*$name" "$tmp/err" || { echo "deploy-lint: deploy.sh accepted an empty $name" >&2; cat "$tmp/err" >&2; exit 1; }
		! grep -q UNEXPECTED "$tmp/calls" || { echo "deploy-lint: deploy.sh reached docker up with $name empty" >&2; exit 1; }
	fi
done
echo "deploy-lint: optional variables ok"

# deploy.sh pi, with fake ssh, rsync, curl and publish: nothing leaves this machine. It must refuse a bad key or
# folder before doing anything, never put the key in an argument or in the staged folder, send it only on ssh's
# stdin, and touch only the edge's own folder on the Pi.
mkdir -p "$tmp/pibin"
ln -s "$tmp/bin/docker" "$tmp/pibin/docker"
cat >"$tmp/pibin/ssh" <<'SHIM'
#!/bin/sh
# Logs every argument on its own line; keeps stdin when the command writes the Pi's .env.
{ echo "ssh:"; for a in "$@"; do printf 'arg:%s\n' "$a"; done; } >>"$PI_CALLS"
case " $* " in
*"cat >.env.new"*) cat >"$PI_STDIN" ;;
*"compose ps"*) echo "action-jackson-edge-edge-1 healthy" ;;
esac
exit 0
SHIM
cat >"$tmp/pibin/rsync" <<'SHIM'
#!/bin/sh
{ echo "rsync:"; for a in "$@"; do printf 'arg:%s\n' "$a"; done; } >>"$PI_CALLS"
exit 0
SHIM
cat >"$tmp/pibin/curl" <<'SHIM'
#!/bin/sh
# Answers like a healthy edge. Only the arguments deploy.sh pi uses are understood.
{ echo "curl:"; for a in "$@"; do printf 'arg:%s\n' "$a"; done; } >>"$PI_CALLS"
out= host= url=
while [ "$#" -gt 0 ]; do
	case $1 in
	-o) out=$2; shift ;;
	-H) host=$2; shift ;;
	-w | -m) shift ;;
	-*) ;;
	*) url=$1 ;;
	esac
	shift
done
case $url in
*/healthz) printf '{"status":"ok"}' ;;
*/api/*) [ -z "$out" ] || printf '{"runs":{}}' >"$out"; printf '200 application/json; charset=utf-8' ;;
*)
	case $host in
	"Host: www."*) printf '301 https://actionjacksoninstalls.com/x?y=1' ;;
	*) printf '200' ;;
	esac
	;;
esac
SHIM
cat >"$tmp/pibin/dotnet" <<'SHIM'
#!/bin/sh
# A stand-in for scripts/dotnet.sh publish: writes the file the script looks for into the -o folder.
{ echo "dotnet:"; for a in "$@"; do printf 'arg:%s\n' "$a"; done; } >>"$PI_CALLS"
while [ "$#" -gt 0 ]; do
	[ "$1" = -o ] && { mkdir -p "$2"; : >"$2/ActionJackson.Edge.dll"; }
	shift
done
SHIM
chmod +x "$tmp/pibin/ssh" "$tmp/pibin/rsync" "$tmp/pibin/curl" "$tmp/pibin/dotnet"

pi_deploy() {
	# usage: pi_deploy ENVFILE [VAR=value ...]; stdout and stderr go to $tmp/pi-out
	envfile=$1
	shift
	: >"$tmp/pi-calls"
	: >"$tmp/pi-stdin"
	env PATH="$tmp/pibin:$PATH" PI_CALLS="$tmp/pi-calls" PI_STDIN="$tmp/pi-stdin" \
		AJ_PC_ENV_FILE="$envfile" AJ_PI_STAGE="build/lint-stage-$$" AJ_DOTNET="$tmp/pibin/dotnet" AJ_SITES_DIST="$tmp/no-dist" \
		"$@" scripts/deploy.sh pi >"$tmp/pi-out" 2>&1
}
pi_key=0123456789abcdef0123456789abcdef

pi_deploy "$tmp/quoted.env" || { echo "deploy-lint: deploy.sh pi failed with a valid key:" >&2; cat "$tmp/pi-out" >&2; exit 1; }
# The key is in no argument, no output and nothing staged; it reaches the Pi only on ssh's stdin.
! grep -qF -- "$pi_key" "$tmp/pi-calls" || { echo "deploy-lint: deploy.sh pi put the edge key in a command line" >&2; exit 1; }
! grep -qF -- "$pi_key" "$tmp/pi-out" || { echo "deploy-lint: deploy.sh pi printed the edge key" >&2; exit 1; }
! grep -rqF -- "$pi_key" "build/lint-stage-$$" || { echo "deploy-lint: deploy.sh pi staged the edge key" >&2; exit 1; }
grep -qx "EDGE_KEY=$pi_key" "$tmp/pi-stdin" || { echo "deploy-lint: deploy.sh pi did not send EDGE_KEY on ssh's stdin" >&2; exit 1; }
grep -q 'umask 077' "$tmp/pi-calls" || { echo "deploy-lint: deploy.sh pi did not write the Pi's .env with umask 077" >&2; exit 1; }
# Only the edge's folder is touched, with --delete never reaching its .env, and nothing else on the Pi.
grep -qx 'arg:claude@192.168.1.69:/srv/action-jackson-edge/' "$tmp/pi-calls" || { echo "deploy-lint: deploy.sh pi did not rsync into /srv/action-jackson-edge" >&2; exit 1; }
grep -qx 'arg:--exclude=/.env' "$tmp/pi-calls" || { echo "deploy-lint: deploy.sh pi's rsync --delete would remove the Pi's .env" >&2; exit 1; }
! grep '^arg:.*/srv' "$tmp/pi-calls" | grep -v 'action-jackson-edge' | grep -q . || { echo "deploy-lint: deploy.sh pi named a folder other than action-jackson-edge" >&2; exit 1; }
# Every site of contracts/sites.json is staged (here all from the placeholder), with the Dockerfile and compose file.
for site in $(python3 -I -c 'import json; print(*[s["key"] for s in json.load(open("contracts/sites.json"))["sites"]])'); do
	[ -f "build/lint-stage-$$/sites/$site/index.html" ] || { echo "deploy-lint: deploy.sh pi did not stage the $site site" >&2; exit 1; }
	[ -f "build/lint-stage-$$/sites/$site/404.html" ] || { echo "deploy-lint: deploy.sh pi did not stage the $site 404 page" >&2; exit 1; }
done
[ -f "build/lint-stage-$$/Dockerfile" ] && [ -f "build/lint-stage-$$/compose.yml" ] || { echo "deploy-lint: deploy.sh pi did not stage the Dockerfile and compose file" >&2; exit 1; }
[ ! -e "build/lint-stage-$$/.env" ] || { echo "deploy-lint: deploy.sh pi staged an .env" >&2; exit 1; }
grep -q 'compose up -d --build --wait' "$tmp/pi-calls" || { echo "deploy-lint: deploy.sh pi did not start the edge with --wait" >&2; exit 1; }
# A site whose Angular output exists is staged from it, not from the placeholder.
mkdir -p "$tmp/dist/lan/browser"
echo built >"$tmp/dist/lan/browser/index.html"
pi_deploy "$tmp/quoted.env" AJ_SITES_DIST="$tmp/dist" || { echo "deploy-lint: deploy.sh pi failed with an Angular dist:" >&2; cat "$tmp/pi-out" >&2; exit 1; }
[ "$(cat "build/lint-stage-$$/sites/lan/index.html")" = built ] || { echo "deploy-lint: deploy.sh pi ignored the Angular dist of lan" >&2; exit 1; }
grep -q 'This site is being rebuilt' "build/lint-stage-$$/sites/car/index.html" || { echo "deploy-lint: deploy.sh pi did not fall back to the placeholder for car" >&2; exit 1; }

# Refusals happen before any command runs: nothing is published, copied or sent.
pi_must_refuse() {
	label=$1
	named=$2
	shift 2
	if pi_deploy "$@"; then
		echo "deploy-lint: deploy.sh pi accepted $label" >&2
		exit 1
	fi
	grep -q -- "$named" "$tmp/pi-out" || { echo "deploy-lint: deploy.sh pi refused $label but did not name $named:" >&2; cat "$tmp/pi-out" >&2; exit 1; }
	[ ! -s "$tmp/pi-calls" ] || { echo "deploy-lint: deploy.sh pi ran commands before refusing $label:" >&2; cat "$tmp/pi-calls" >&2; exit 1; }
}
sed 's/^EDGE_KEY=.*/EDGE_KEY="0123456789abcdef0123456789abcde"/' "$tmp/quoted.env" >"$tmp/pi-short.env"
pi_must_refuse "a 31-character EDGE_KEY" EDGE_KEY "$tmp/pi-short.env"
sed 's/^EDGE_KEY=.*/EDGE_KEY=""/' "$tmp/quoted.env" >"$tmp/pi-empty.env"
pi_must_refuse "an empty EDGE_KEY" EDGE_KEY "$tmp/pi-empty.env"
sed 's/^EDGE_KEY=.*/EDGE_KEY="0123456789abcdef 0123456789abcdef"/' "$tmp/quoted.env" >"$tmp/pi-odd.env"
pi_must_refuse "an EDGE_KEY with a space" EDGE_KEY "$tmp/pi-odd.env"
pi_must_refuse "a missing deploy/pc/.env" "is missing" "$tmp/does-not-exist.env"
pi_must_refuse "the legacy stack's folder" AJ_PI_DIR "$tmp/quoted.env" AJ_PI_DIR=/srv/action-jackson
pi_must_refuse "another folder" AJ_PI_DIR "$tmp/quoted.env" AJ_PI_DIR=/srv/other
pi_must_refuse "a folder with .." AJ_PI_DIR "$tmp/quoted.env" AJ_PI_DIR=/srv/../action-jackson-edge
pi_must_refuse "a host with a space" AJ_PI_HOST "$tmp/quoted.env" "AJ_PI_HOST=claude@host; rm -rf /"
pi_must_refuse "a stage folder outside build/" AJ_PI_STAGE "$tmp/quoted.env" AJ_PI_STAGE=server
pi_must_refuse "a stage folder with .." AJ_PI_STAGE "$tmp/quoted.env" AJ_PI_STAGE=build/../server
pi_must_refuse "an API URL with a path" AJ_API_URL "$tmp/quoted.env" AJ_API_URL=http://192.168.1.195:8110/x
echo "deploy-lint: deploy.sh pi ok"
