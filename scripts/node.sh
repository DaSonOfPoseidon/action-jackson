#!/bin/sh
# Runs Node (for apps/web, the Angular workspace) in a container, so the host needs only Docker. The host's Node
# is older than Angular's engines (^22.22.3 || ^24.15.0 || >=26), so Node commands never run on the host.
#   scripts/node.sh npm ci --ignore-scripts      scripts/node.sh npx ng build main
# The repo is mounted at /src (the apps import ../../contracts/*.json) and commands run in /src/apps/web.
# The image is Debian (glibc), not alpine: esbuild's native binary must also run in the Playwright image, which
# shares node_modules. The npm cache lives in the named volume aj-npm. The labels keep these throwaway containers
# out of monitoring alerts (ContainerGone) and WUD. Output files belong to the calling user, not root (#4).
# Memory: 4g, no swap. Measured (apps/web, Angular 22.3, five apps built one after another): the full build passes at
# 1280m and is killed at 1g, so its peak is between 1.0 and 1.25 GiB; the unit tests pass at 2g. AJ_NODE_MEMORY overrides the cap.
set -e
cd "$(dirname "$0")/.."
memory=${AJ_NODE_MEMORY:-4g}
# A new named volume is root-owned; make the cache writable for the calling user once.
if ! docker volume inspect aj-npm >/dev/null 2>&1; then
	docker volume create aj-npm >/dev/null
	docker run --rm --user 0 -v aj-npm:/npm-cache node:24.21.0-bookworm-slim chmod 1777 /npm-cache
fi
mkdir -p apps/web
exec docker run --rm -i \
	--label monitoring.ignore=true --label wud.watch=false \
	--memory "$memory" --memory-swap "$memory" \
	--user "$(id -u):$(id -g)" -e HOME=/tmp \
	-v "$PWD:/src" -w /src/apps/web \
	-v aj-npm:/npm-cache -e npm_config_cache=/npm-cache \
	-e NG_CLI_ANALYTICS=false -e CI -e NO_UPDATE_NOTIFIER=1 \
	node:24.21.0-bookworm-slim "$@"
