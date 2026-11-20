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
