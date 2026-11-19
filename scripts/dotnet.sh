#!/bin/sh
# Runs the .NET SDK in a container so the host needs only Docker. NuGet packages are cached in
# a named volume. Paths are given from the repo root, which is mounted at /src (server/...).
# The labels keep these throwaway containers out of monitoring alerts (ContainerGone) and WUD.
# When scripts/test-db.sh is up, the container joins its network and the data tests use it.
#   scripts/dotnet.sh ef <args>   runs the dotnet-ef local tool (.config/dotnet-tools.json), e.g.
#   scripts/dotnet.sh ef migrations add <Name> --context LanDbContext -o Migrations/Lan \
#     --project server/src/ActionJackson.Data --startup-project server/src/ActionJackson.Data
set -e
cd "$(dirname "$0")/.."
network=bridge
if docker inspect aj-testdb >/dev/null 2>&1; then
	network=aj-test
	: "${TEST_DATABASE_URL:=Host=aj-testdb;Username=postgres;Password=test}"
	export TEST_DATABASE_URL
fi
# Each run is a fresh container, so the local tool is restored first.
if [ "$1" = ef ]; then
	shift
	set -- sh -c 'dotnet tool restore >/dev/null && exec dotnet tool run dotnet-ef "$@"' ef "$@"
else
	set -- dotnet "$@"
fi
exec docker run --rm -i \
	--label monitoring.ignore=true --label wud.watch=false \
	-v "$PWD:/src" -w /src \
	-v aj-nuget:/root/.nuget/packages \
	-e DOTNET_CLI_TELEMETRY_OPTOUT=1 -e DOTNET_NOLOGO=1 \
	-e TEST_DATABASE_URL --network "$network" \
	mcr.microsoft.com/dotnet/sdk:10.0 "$@"
