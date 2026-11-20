#!/bin/sh
# Brings a deployment up. Idempotent: run it again after a pull to rebuild what changed.
#   scripts/deploy.sh pc     api, postgres, redis, garage on this machine (deploy/pc/compose.yml)
#   scripts/deploy.sh pi     the edge on the Raspberry Pi (added in unit 9)
# Test overrides for pc: AJ_PC_ENV_FILE (default deploy/pc/.env) and AJ_PC_PROJECT (a compose project
# name, so a trial run never touches the real action-jackson project).
set -eu

usage() {
	echo "usage: $0 pc|pi" >&2
	exit 2
}

[ "$#" -eq 1 ] || usage

case "$1" in
pc) ;;
pi)
	echo "deploy.sh pi: added in unit 9" >&2
	exit 2
	;;
*) usage ;;
esac

root=$(cd "$(dirname "$0")/.." && pwd)
env_file=${AJ_PC_ENV_FILE:-$root/deploy/pc/.env}
example=$root/deploy/pc/.env.example

# The value of a variable in the env file, taken literally (the file is data, never sourced).
get() {
	sed -n "s/^$1=//p" "$env_file" | tail -n 1
}

# 1. The env file must exist and every variable .env.example names must be set (only the optional
# port may be empty). Refuse before touching Docker; name the variable, never its value.
if [ ! -f "$env_file" ]; then
	echo "deploy.sh: $env_file is missing." >&2
	echo "Create it: cp deploy/pc/.env.example deploy/pc/.env, then fill every value (the comments say how)." >&2
	exit 1
fi
missing=
for name in $(sed -n 's/^\([A-Z][A-Z0-9_]*\)=.*/\1/p' "$example"); do
	[ "$name" = AJ_API_PORT ] && continue
	if [ -z "$(get "$name")" ]; then
		missing="$missing $name"
	fi
done
if [ -n "$missing" ]; then
	echo "deploy.sh: empty or missing in $env_file:$missing" >&2
	exit 1
fi

compose() {
	if [ -n "${AJ_PC_PROJECT:-}" ]; then
		docker compose -p "$AJ_PC_PROJECT" -f "$root/deploy/pc/compose.yml" --env-file "$env_file" "$@"
	else
		docker compose -f "$root/deploy/pc/compose.yml" --env-file "$env_file" "$@"
	fi
}

# 6. Any failure ends the run non-zero, with each service's last 50 log lines.
started=
on_exit() {
	status=$?
	if [ "$status" -ne 0 ] && [ -n "$started" ]; then
		echo "deploy.sh: failed (exit $status); last 50 log lines per service:" >&2
		compose logs --tail 50 >&2 || true
	fi
}
trap on_exit EXIT

# 2. Build and start; --wait blocks until every service is healthy and fails otherwise.
started=1
compose up -d --build --wait

# 3. Layout, bucket and key in Garage.
"$root/deploy/pc/garage-init.sh"

# 4. The API must see its database. The port follows compose's own precedence: shell, then env file.
port=${AJ_API_PORT:-$(get AJ_API_PORT)}
port=${port:-8110}
url=http://192.168.1.195:$port/healthz
tries=0
until body=$(curl -fsS -m 5 "$url" 2>/dev/null) && printf '%s' "$body" | grep -q '"db":"ok"'; do
	tries=$((tries + 1))
	if [ "$tries" -ge 10 ]; then
		echo "deploy.sh: $url did not report \"db\":\"ok\" (last answer: ${body:-none})" >&2
		exit 1
	fi
	sleep 2
done
echo "deploy.sh: $url -> $body"

# 5. Names and health only.
compose ps --format '{{.Name}} {{.Health}}'
