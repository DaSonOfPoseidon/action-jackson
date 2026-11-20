#!/bin/sh
# A throwaway Postgres for the .NET data tests, on a private network that scripts/dotnet.sh joins.
# Labelled so monitoring and WUD ignore it, and not published on the host. Each test class creates
# and drops its own database in it.
#   scripts/test-db.sh up | down
set -e
# The same major version as deploy/pc/compose.yml.
image=postgres:18-alpine
case "$1" in
up)
	docker network inspect aj-test >/dev/null 2>&1 || docker network create aj-test >/dev/null
	# Tests run on the production major version. A container left over from an older image is replaced
	# (it is throwaway: every test class creates and drops its own database).
	if [ "$(docker inspect -f '{{.Config.Image}}' aj-testdb 2>/dev/null)" != "$image" ]; then
		docker rm -f -v aj-testdb >/dev/null 2>&1 || true
	fi
	if docker inspect aj-testdb >/dev/null 2>&1; then
		# A stopped container (after a reboot, say) must be started, or pg_isready never succeeds.
		docker start aj-testdb >/dev/null
	else
		docker run -d --name aj-testdb \
			--label monitoring.ignore=true --label wud.watch=false \
			--network aj-test --memory 512m --memory-swap 512m \
			-e POSTGRES_PASSWORD=test "$image" >/dev/null
	fi
	# Ask over TCP: the image's temporary init server listens only on its socket, so a socket check
	# can pass before the real server accepts connections from other containers.
	until docker exec aj-testdb pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; do sleep 1; done
	echo "TEST_DATABASE_URL=Host=aj-testdb;Username=postgres;Password=test"
	;;
down)
	docker rm -f aj-testdb >/dev/null 2>&1 || true
	docker network rm aj-test >/dev/null 2>&1 || true
	;;
*)
	echo "usage: $0 up|down" >&2
	exit 2
	;;
esac
