#!/bin/sh
# Stages the edge's web root: one folder per site key of contracts/sites.json, under TARGET (the edge's Edge:WebRoot).
#   scripts/stage-sites.sh DIST TARGET     DIST is where the Angular output is (apps/web/dist), TARGET the folder to fill
# A site's folder is dist/<key>/browser (what Angular's application builder writes), else dist/<key>, else the
# placeholder page (deploy/pi/placeholder). One script, called by scripts/deploy-pi.sh and scripts/web-e2e.sh and by
# the CI web job, so the staging that is tested is the staging that deploys. Paths are relative to the repo root.
set -eu

[ "$#" -eq 2 ] || {
	echo "usage: $0 DIST TARGET" >&2
	exit 2
}
dist=$1
target=$2

cd "$(dirname "$0")/.."

keys=$(python3 -I -c 'import json, sys; print(*[s["key"] for s in json.load(open(sys.argv[1]))["sites"]])' contracts/sites.json)
for site in $keys; do
	printf '%s' "$site" | grep -Eq '^[a-z][a-z0-9-]*$' || {
		echo "stage-sites.sh: contracts/sites.json has an unusable site key" >&2
		exit 1
	}
	if [ -d "$dist/$site/browser" ]; then
		source_dir=$dist/$site/browser
	elif [ -d "$dist/$site" ]; then
		source_dir=$dist/$site
	else
		source_dir=deploy/pi/placeholder
	fi
	mkdir -p "$target/$site"
	cp -R "$source_dir/." "$target/$site/"
done
