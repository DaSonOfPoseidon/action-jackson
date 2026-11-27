#!/bin/sh
# The Playwright run through a real edge, all in containers (the host needs only Docker). Run `npm run build` in
# apps/web first (scripts/node.sh npm run build): this stages what it built.
#   1. publishes the edge and the API (scripts/dotnet.sh publish) into build/e2e/edge and build/e2e/api;
#   2. stages build/e2e/sites/<key> from apps/web/dist with scripts/stage-sites.sh, the staging the Pi deploy uses;
#   3. starts two edges (aspnet image) on a throwaway network, with a random per-run Edge__Key (never printed, not a
#      deploy secret): `edge` has an API address nothing listens on, so its API counts as down, and `edge-api` proxies
#      to the real API;
#   4. starts the real API (aspnet image) on a fresh database of the throwaway Postgres (scripts/test-db.sh, the one the
#      data tests use). It migrates and seeds at start; the script waits until /healthz says "db":"ok" (the port opening
#      is not enough: docs/pitfalls.md, "A readiness probe that passes before the real service is up"). The API gets
#      nothing but its connection string and the key: Redis, Garage and SMTP are optional and left out;
#   5. runs the Playwright image (the tag is the exact @playwright/test version) on that network. Its Chromium maps
#      *.localhost and localhost to an edge, so the specs open http://<key>.localhost like a visitor. Two addresses go
#      in: EDGE_ORIGIN (the API-down edge, which every spec uses) and EDGE_API_ORIGIN (the edge with the API behind it,
#      which e2e/lan-forms.spec.ts uses for real submissions);
#   6. removes the containers, the network and the database on any exit (trap), so a failed run leaves nothing behind
#      (the shared Postgres container stays up, as scripts/check.sh leaves it). The names carry the process id, so no
#      fixed name is ever in use and two runs back to back (or at once) don't clash. Nothing here touches the deployed
#      stack (deploy/pc, project action-jackson) or its volumes.
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
edge_api=aj-e2e-edge-api-$$
api=aj-e2e-api-$$
database=aj_e2e_$$
database_created=
cleanup() {
	status=$?
	if [ "$status" -ne 0 ]; then
		for name in "$edge" "$edge_api" "$api"; do
			if docker inspect "$name" >/dev/null 2>&1; then
				echo "web-e2e.sh: failed (exit $status); last 30 log lines of $name:" >&2
				docker logs --tail 30 "$name" >&2 || true
			fi
		done
	fi
	docker rm -f "$edge" "$edge_api" "$api" >/dev/null 2>&1 || true
	docker network rm "$network" >/dev/null 2>&1 || true
	if [ -n "$database_created" ]; then
		docker exec aj-testdb psql -U postgres -c "DROP DATABASE IF EXISTS $database WITH (FORCE)" >/dev/null 2>&1 || true
	fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# 1 and 2. The edge, the API and the sites the edge serves.
rm -rf build/e2e
mkdir -p build/e2e
scripts/dotnet.sh publish server/src/ActionJackson.Edge -c Release -p:UseAppHost=false -o build/e2e/edge
[ -f build/e2e/edge/ActionJackson.Edge.dll ] || die "the publish did not produce build/e2e/edge/ActionJackson.Edge.dll"
scripts/dotnet.sh publish server/src/ActionJackson.Api -c Release -p:UseAppHost=false -o build/e2e/api
[ -f build/e2e/api/ActionJackson.Api.dll ] || die "the publish did not produce build/e2e/api/ActionJackson.Api.dll"
scripts/stage-sites.sh apps/web/dist build/e2e/sites

# 3. The edges. The key goes to the containers through the environment of this shell, never into a printed command. Both
# edges and the API share it: the API trusts X-Client-IP only on a request that carries it.
Edge__Key=$(openssl rand -hex 32)
export Edge__Key
docker network create --label monitoring.ignore=true "$network" >/dev/null
start_edge() {
	# $1 container name, $2 network alias, $3 the API address it proxies to.
	docker run -d --name "$1" --network "$network" --network-alias "$2" \
		--label monitoring.ignore=true --label wud.watch=false \
		--memory 512m --memory-swap 512m \
		-v "$PWD/build/e2e/edge:/app:ro" -v "$PWD/build/e2e/sites:/sites:ro" -w /app \
		-e Edge__Key -e Edge__WebRoot=/sites -e Edge__ApiUrl="$3" \
		-e ASPNETCORE_HTTP_PORTS= -e ASPNETCORE_FORWARDEDHEADERS_ENABLED=false -e HTTP_PORT=8080 -e TUNNEL_PORT=8081 \
		-e DOTNET_CLI_TELEMETRY_OPTOUT=1 \
		mcr.microsoft.com/dotnet/aspnet:10.0 dotnet /app/ActionJackson.Edge.dll >/dev/null
}
start_edge "$edge" edge http://127.0.0.1:9
start_edge "$edge_api" edge-api http://api:8080

# 4. The API, on a fresh database of the throwaway Postgres. test-db.sh prints the connection string without a database
# (its last line is TEST_DATABASE_URL=...); the password in it is the throwaway one, not a secret. The API container joins
# that network to reach the database, and this run's network (as `api`) so the second edge reaches it.
test_db=$(scripts/test-db.sh up | sed -n 's/^TEST_DATABASE_URL=//p')
[ -n "$test_db" ] || die "scripts/test-db.sh up did not print TEST_DATABASE_URL"
docker exec aj-testdb psql -U postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $database" >/dev/null
database_created=1
ConnectionStrings__Postgres="$test_db;Database=$database"
export ConnectionStrings__Postgres
docker run -d --name "$api" --network aj-test \
	--label monitoring.ignore=true --label wud.watch=false \
	--memory 512m --memory-swap 512m \
	-v "$PWD/build/e2e/api:/app:ro" -w /app \
	-e Edge__Key -e ConnectionStrings__Postgres \
	-e ASPNETCORE_HTTP_PORTS= -e HTTP_PORT=8080 -e DOTNET_CLI_TELEMETRY_OPTOUT=1 \
	mcr.microsoft.com/dotnet/aspnet:10.0 dotnet /app/ActionJackson.Api.dll >/dev/null
docker network connect --alias api "$network" "$api"
# The probe asks over the network, the way the edge does, and wants "db":"ok" (the API listens only after it migrated and
# seeded, and answers 503 while the database is down). A stopped container ends the wait at once.
api_ip=$(docker inspect -f "{{(index .NetworkSettings.Networks \"$network\").IPAddress}}" "$api")
tries=0
until body=$(curl -fsS -m 3 "http://$api_ip:8080/healthz" 2>/dev/null) && printf '%s' "$body" | grep -q '"db":"ok"'; do
	[ "$(docker inspect -f '{{.State.Running}}' "$api")" = true ] || die "the API container stopped before it was ready"
	tries=$((tries + 1))
	[ "$tries" -lt 90 ] || die "the API did not report \"db\":\"ok\" within 90 seconds (last answer: ${body:-none})"
	sleep 1
done

# 5. Playwright. Its global setup waits until each edge serves a real page of every site, and until the API answers a
# real request through the second edge (docs/pitfalls.md: /healthz alone passes before the files are served), so there is no
# sleep here.
docker run --rm -i \
	--label monitoring.ignore=true --label wud.watch=false \
	--memory 2g --memory-swap 2g --shm-size 1g \
	--network "$network" \
	--user "$(id -u):$(id -g)" -e HOME=/tmp \
	-e CI -e EDGE_ORIGIN=http://edge:8080 -e EDGE_API_ORIGIN=http://edge-api:8080 \
	-v "$PWD:/src" -w /src/apps/web \
	"mcr.microsoft.com/playwright:v$playwright_version-noble" \
	npx --no-install playwright test "$@"
