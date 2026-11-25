#!/bin/sh
# The edge on the Raspberry Pi: scripts/deploy.sh pi runs this, from the PC (.195). Idempotent: run it again to
# redeploy. The Pi never builds .NET: the edge is published here for linux-arm64, staged next to its sites, rsynced
# to /srv/action-jackson-edge on the Pi, and built there by deploy/pi/Dockerfile, which only copies.
#
# The edge key is read from deploy/pc/.env (EDGE_KEY), so the Pi and the API cannot drift. It travels to the Pi
# only on ssh's stdin, into a mode-600 .env there. It is in no argument, log, or the staged folder.
#
# On the Pi it touches only that folder and the action-jackson-edge compose project. Overrides (env):
#   AJ_PI_HOST   ssh target, default claude@192.168.1.69      AJ_PI_DIR   default /srv/action-jackson-edge
#   AJ_API_URL   the API as the Pi reaches it, default http://192.168.1.195:<AJ_API_PORT in deploy/pc/.env or 8110>
#   AJ_EDGE_PORT / AJ_TUNNEL_PORT  host ports of the LAN and tunnel listeners, default 8180 / 8181
#   AJ_SITES_DIST  where the Angular output is (default apps/web/dist/<site key>[/browser]); a site with none gets
#                  the placeholder page
# Test overrides: AJ_PC_ENV_FILE (default deploy/pc/.env), AJ_PI_STAGE (a folder under build/, default build/pi),
# AJ_DOTNET (default scripts/dotnet.sh).
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

pi_host=${AJ_PI_HOST:-claude@192.168.1.69}
pi_dir=${AJ_PI_DIR:-/srv/action-jackson-edge}
pc_env=${AJ_PC_ENV_FILE:-$root/deploy/pc/.env}
stage=${AJ_PI_STAGE:-build/pi}
dotnet_cmd=${AJ_DOTNET:-$root/scripts/dotnet.sh}
dist=${AJ_SITES_DIST:-apps/web/dist}
edge_port=${AJ_EDGE_PORT:-8180}
tunnel_port=${AJ_TUNNEL_PORT:-8181}

die() {
	echo "deploy.sh pi: $*" >&2
	exit 1
}

# Everything that reaches a remote command line or a path is checked first.
printf '%s' "$pi_host" | grep -Eq '^[A-Za-z0-9._@-]+$' || die "AJ_PI_HOST is not a plain ssh target"
# rsync --delete runs against this folder, so it must be the edge's own, and nothing else.
printf '%s' "$pi_dir" | grep -Eq '^/[A-Za-z0-9._/-]*action-jackson-edge$' || die "AJ_PI_DIR must be an absolute path ending in action-jackson-edge"
case $pi_dir in *..*) die "AJ_PI_DIR must not contain .." ;; esac
# The stage is deleted and rebuilt on every run, so it must be a folder under build/ (git-ignored), nothing else.
case $stage in
build/?*) ;;
*) die "AJ_PI_STAGE must be a folder under build/" ;;
esac
case $stage in *..*) die "AJ_PI_STAGE must not contain .." ;; esac
case $edge_port$tunnel_port in *[!0-9]* | "") die "AJ_EDGE_PORT and AJ_TUNNEL_PORT must be numbers" ;; esac
pi_address=${pi_host#*@}

# 1. The key comes from deploy/pc/.env, read the way Compose reads it (deploy/pc/env-lib.sh).
[ -f "$pc_env" ] || die "$pc_env is missing. Run scripts/deploy.sh pc first: the edge key lives there."
. "$root/deploy/pc/env-lib.sh"
env_load "$pc_env" || die "cannot read $pc_env"
key=$(env_get EDGE_KEY)
[ -n "$key" ] || die "EDGE_KEY is empty or missing in $pc_env"
# The edge refuses a key under 32 characters (the API does too); catch it here, by name only.
[ "$(printf '%s' "$key" | wc -c)" -ge 32 ] || die "EDGE_KEY in $pc_env must be at least 32 characters (openssl rand -hex 32)"
# It is written to a .env file, so it must be plain: letters, digits and . _ + / = -
printf '%s' "$key" | grep -Eq '^[A-Za-z0-9_.+/=-]+$' || die "EDGE_KEY in $pc_env may only hold letters, digits and . _ + / = - (openssl rand -hex 32)"

api_port=$(env_get AJ_API_PORT)
api_url=${AJ_API_URL:-http://192.168.1.195:${api_port:-8110}}
printf '%s' "$api_url" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$' || die "AJ_API_URL must look like http://192.168.1.195:8110"

ssh_pi() {
	ssh -o BatchMode=yes "$pi_host" "$@"
}

# Any failure ends the run non-zero, with the edge's last 50 log lines from the Pi (the edge never logs its key).
started=
on_exit() {
	status=$?
	if [ "$status" -ne 0 ] && [ -n "$started" ]; then
		echo "deploy.sh pi: failed (exit $status); last 50 log lines of the edge:" >&2
		ssh_pi "cd '$pi_dir' && docker compose logs --tail 50" >&2 || true
	fi
}
trap on_exit EXIT

# 2. Publish for the Pi's CPU into a fresh, git-ignored stage folder. The edge starts as `dotnet X.dll`, so no apphost.
rm -rf "$stage"
mkdir -p "$stage/sites"
"$dotnet_cmd" publish server/src/ActionJackson.Edge -c Release -r linux-arm64 --self-contained false -p:UseAppHost=false -o "$stage/app"
[ -f "$stage/app/ActionJackson.Edge.dll" ] || die "the publish did not produce $stage/app/ActionJackson.Edge.dll"

# 3. One folder per site key of contracts/sites.json: the Angular output when there is one, the placeholder otherwise.
"$root/scripts/stage-sites.sh" "$dist" "$stage/sites" || die "staging the sites failed"
cp deploy/pi/Dockerfile deploy/pi/compose.yml "$stage/"
# Belt and braces: the key must be nowhere in what is about to leave this machine (the pattern comes from stdin).
if printf '%s' "$key" | grep -rIlF -f - "$stage" >/dev/null 2>&1; then
	die "the edge key was found in the staged folder; nothing was copied"
fi

# 4. The Pi's folder (only this one), owned by the ssh user, then the stage into it. The Pi's .env is kept.
started=1
ssh_pi "sudo -n install -d -o \"\$(id -un)\" -g \"\$(id -gn)\" '$pi_dir'"
rsync -a --no-owner --no-group --delete --exclude=/.env -e 'ssh -o BatchMode=yes' "$stage/" "$pi_host:$pi_dir/"

# 5. The Pi's .env, over ssh's stdin with umask 077: never in argv, a log or the stage folder.
{
	printf 'EDGE_KEY=%s\n' "$key"
	printf 'AJ_API_URL=%s\n' "$api_url"
	if [ -n "${AJ_EDGE_PORT:-}" ]; then printf 'AJ_EDGE_PORT=%s\n' "$AJ_EDGE_PORT"; fi
	if [ -n "${AJ_TUNNEL_PORT:-}" ]; then printf 'AJ_TUNNEL_PORT=%s\n' "$AJ_TUNNEL_PORT"; fi
} | ssh_pi "cd '$pi_dir' && umask 077 && cat >.env.new && mv .env.new .env"

# 6. Build on the Pi (a COPY only) and start; --wait blocks until the edge's healthcheck passes.
ssh_pi "cd '$pi_dir' && docker compose up -d --build --wait"

# 7. Check from here, through the published LAN port, the way a client reaches it. /healthz is the edge's own answer
# and passes before the proxy works, so the last check goes through the proxy to the API (docs/pitfalls.md).
base=http://$pi_address:$edge_port
tries=0
until body=$(curl -fsS -m 5 "$base/healthz" 2>/dev/null) && printf '%s' "$body" | grep -q '"status":"ok"'; do
	tries=$((tries + 1))
	[ "$tries" -lt 10 ] || die "$base/healthz did not answer ok (last answer: ${body:-none})"
	sleep 2
done
echo "deploy.sh pi: $base/healthz -> $body"

result=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -H 'Host: lan.actionjacksoninstalls.com' "$base/") || die "$base/ did not answer"
[ "$result" = 200 ] || die "Host lan.actionjacksoninstalls.com on / gave $result, expected 200"
echo "deploy.sh pi: Host lan.actionjacksoninstalls.com / -> $result"

result=$(curl -sS -m 10 -o /dev/null -w '%{http_code} %{redirect_url}' -H 'Host: www.actionjacksoninstalls.com' "$base/x?y=1") || die "the www redirect did not answer"
[ "$result" = '301 https://actionjacksoninstalls.com/x?y=1' ] || die "Host www.actionjacksoninstalls.com on /x?y=1 gave '$result', expected '301 https://actionjacksoninstalls.com/x?y=1'"
echo "deploy.sh pi: Host www.actionjacksoninstalls.com /x?y=1 -> $result"

result=$(curl -sS -m 10 -o "${TMPDIR:-/tmp}/aj-pi-pricing.$$" -w '%{http_code} %{content_type}' -H 'Host: lan.actionjacksoninstalls.com' "$base/api/lan/quotes/pricing") || die "the proxied pricing call did not answer"
pricing=$(cat "${TMPDIR:-/tmp}/aj-pi-pricing.$$")
rm -f "${TMPDIR:-/tmp}/aj-pi-pricing.$$"
case $result in
"200 application/json"*) ;;
*) die "Host lan.actionjacksoninstalls.com on /api/lan/quotes/pricing gave '$result', expected 200 application/json (is the API up at $api_url?)" ;;
esac
printf '%s' "$pricing" | grep -q '^{' || die "the proxied pricing answer is not a JSON object"
echo "deploy.sh pi: Host lan.actionjacksoninstalls.com /api/lan/quotes/pricing -> $result"

# 8. Names and health only.
ssh_pi "cd '$pi_dir' && docker compose ps --format '{{.Name}} {{.Health}}'"
