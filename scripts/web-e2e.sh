#!/bin/sh
# The Playwright run through a real edge, all in containers (the host needs only Docker). Run `npm run build` in
# apps/web first (scripts/node.sh npm run build): this stages what it built.
#   1. publishes the edge (scripts/dotnet.sh publish) into build/e2e/edge;
#   2. stages build/e2e/sites/<key> from apps/web/dist with scripts/stage-sites.sh, the staging the Pi deploy uses;
#   3. starts the edge (aspnet image) on a throwaway network, with a random per-run Edge__Key (never printed, not a
#      deploy secret) and an API address nothing listens on, so the API counts as down;
#   4. runs the Playwright image (the tag is the exact @playwright/test version) on that network. Its Chromium maps
#      *.localhost and localhost to the edge, so the specs open http://<key>.localhost like a visitor;
#   5. removes the edge container and the network on any exit (trap), so a failed run leaves nothing behind. The
#      names carry the process id, so no fixed name is ever in use and two runs back to back (or at once) don't clash.
# Extra arguments go to `playwright test` (scripts/web-e2e.sh e2e/edge.spec.ts). The HTML report is apps/web/playwright-report.
set -eu
cd "$(dirname "$0")/.."

die() {
	echo "web-e2e.sh: $*" >&2
	exit 1
}

[ -d apps/web/dist ] || die "apps/web/dist is missing: build the apps first (scripts/node.sh npm run build)"
playwright_version=$(python3 -I -c 'import json; print(json.load(open("apps/web/package.json"))["devDependencies"]["@playwright/test"])')
printf '%s' "$playwright_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || die "@playwright/test must be pinned to an exact version in apps/web/package.json"
[ -d apps/web/node_modules/@playwright/test ] || die "apps/web/node_modules is missing: scripts/node.sh npm ci --ignore-scripts"

network=aj-e2e-$$
edge=aj-e2e-edge-$$
cleanup() {
	status=$?
	if [ "$status" -ne 0 ] && docker inspect "$edge" >/dev/null 2>&1; then
		echo "web-e2e.sh: failed (exit $status); last 30 log lines of the edge:" >&2
		docker logs --tail 30 "$edge" >&2 || true
	fi
	docker rm -f "$edge" >/dev/null 2>&1 || true
	docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# 1 and 2. The edge and the sites it serves.
rm -rf build/e2e
mkdir -p build/e2e
scripts/dotnet.sh publish server/src/ActionJackson.Edge -c Release -p:UseAppHost=false -o build/e2e/edge
[ -f build/e2e/edge/ActionJackson.Edge.dll ] || die "the publish did not produce build/e2e/edge/ActionJackson.Edge.dll"
scripts/stage-sites.sh apps/web/dist build/e2e/sites

# 3. The edge. The key goes to the container through the environment of this shell, never into a printed command.
Edge__Key=$(openssl rand -hex 32)
export Edge__Key
docker network create --label monitoring.ignore=true "$network" >/dev/null
docker run -d --name "$edge" --network "$network" --network-alias edge \
	--label monitoring.ignore=true --label wud.watch=false \
	--memory 512m --memory-swap 512m \
	-v "$PWD/build/e2e/edge:/app:ro" -v "$PWD/build/e2e/sites:/sites:ro" -w /app \
	-e Edge__Key -e Edge__WebRoot=/sites -e Edge__ApiUrl=http://127.0.0.1:9 \
	-e ASPNETCORE_HTTP_PORTS= -e ASPNETCORE_FORWARDEDHEADERS_ENABLED=false -e HTTP_PORT=8080 -e TUNNEL_PORT=8081 \
	-e DOTNET_CLI_TELEMETRY_OPTOUT=1 \
	mcr.microsoft.com/dotnet/aspnet:10.0 dotnet /app/ActionJackson.Edge.dll >/dev/null

# 4. Playwright. Its global setup waits until the edge serves a real page of every site (docs/pitfalls.md: /healthz
# alone passes before the files are served), so there is no sleep here.
docker run --rm -i \
	--label monitoring.ignore=true --label wud.watch=false \
	--memory 2g --memory-swap 2g --shm-size 1g \
	--network "$network" \
	--user "$(id -u):$(id -g)" -e HOME=/tmp \
	-e CI -e EDGE_ORIGIN=http://edge:8080 \
	-v "$PWD:/src" -w /src/apps/web \
	"mcr.microsoft.com/playwright:v$playwright_version-noble" \
	npx --no-install playwright test "$@"
