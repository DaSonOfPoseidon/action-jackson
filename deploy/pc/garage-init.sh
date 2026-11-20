#!/bin/sh
# Bootstraps the single Garage node: cluster layout, the attachments bucket and the API's S3 key.
# Idempotent: a second run finds everything in place and changes nothing. Never prints a secret.
# Needs the stack up (scripts/deploy.sh pc runs this after `up --wait`).
#   deploy/pc/garage-init.sh
# Test overrides: AJ_PC_ENV_FILE (default deploy/pc/.env) and AJ_PC_PROJECT (a compose project name).
set -eu

root=$(cd "$(dirname "$0")/../.." && pwd)
env_file=${AJ_PC_ENV_FILE:-$root/deploy/pc/.env}
bucket=aj-attachments
# Garage balances data by capacity; with one node the number only has to be positive, so it is nominal.
capacity=100GB

compose() {
	if [ -n "${AJ_PC_PROJECT:-}" ]; then
		docker compose -p "$AJ_PC_PROJECT" -f "$root/deploy/pc/compose.yml" --env-file "$env_file" "$@"
	else
		docker compose -f "$root/deploy/pc/compose.yml" --env-file "$env_file" "$@"
	fi
}

# The garage binary in the container (the image has only /garage, no shell).
garage() {
	compose exec -T garage /garage "$@"
}

# Runs a garage command that changes state; its output is shown only when it fails, because a
# failure message (a malformed key ID, say) is what the operator needs and success output is noise.
garage_quiet() {
	if ! out=$(garage "$@" 2>&1); then
		printf '%s\n' "$out" >&2
		echo "garage-init: 'garage $1 $2' failed" >&2
		exit 1
	fi
}

[ -f "$env_file" ] || { echo "garage-init: $env_file is missing" >&2; exit 1; }
# The values as Compose reads them (quotes stripped), so the imported key is the one the API is given.
. "$root/deploy/pc/env-lib.sh"
env_load "$env_file" || { echo "garage-init: cannot read $env_file" >&2; exit 1; }
key_id=$(env_get S3_ACCESS_KEY_ID)
secret=$(env_get S3_SECRET_ACCESS_KEY)
[ -n "$key_id" ] || { echo "garage-init: S3_ACCESS_KEY_ID is empty in $env_file" >&2; exit 1; }
[ -n "$secret" ] || { echo "garage-init: S3_SECRET_ACCESS_KEY is empty in $env_file" >&2; exit 1; }

# 1. Layout: version 0 means no layout was ever applied. Apply exactly version 1; an applied layout
# is left alone, so a re-run never bumps the version.
version=$(garage layout show 2>/dev/null | sed -n 's/^Current cluster layout version: \([0-9][0-9]*\).*/\1/p')
[ -n "$version" ] || { echo "garage-init: cannot read the layout version (is the garage container up?)" >&2; exit 1; }
if [ "$version" -eq 0 ]; then
	node=$(garage node id -q 2>/dev/null)
	node=${node%%@*}
	[ -n "$node" ] || { echo "garage-init: cannot read the node ID" >&2; exit 1; }
	garage_quiet layout assign -z home -c "$capacity" "$node"
	garage_quiet layout apply --version 1
	echo "garage-init: layout applied (version 1, $capacity)"
else
	echo "garage-init: layout already applied (version $version)"
fi

# The bucket and key commands answer "Layout not ready" for a moment after a layout is applied.
tries=0
until garage bucket list >/dev/null 2>&1; do
	tries=$((tries + 1))
	[ "$tries" -lt 30 ] || { echo "garage-init: garage did not become ready after the layout" >&2; exit 1; }
	sleep 1
done

# 2. Bucket.
if garage bucket info "$bucket" >/dev/null 2>&1; then
	echo "garage-init: bucket $bucket exists"
else
	garage_quiet bucket create "$bucket"
	echo "garage-init: bucket $bucket created"
fi

# 3. Key: imported with the ID and secret from .env, so the API's configuration and Garage agree.
# A malformed ID makes Garage refuse, and that message and a non-zero exit reach the operator.
if garage key info "$key_id" >/dev/null 2>&1; then
	echo "garage-init: key aj-api exists"
else
	garage_quiet key import --yes -n aj-api "$key_id" "$secret"
	echo "garage-init: key aj-api imported"
fi

# 4. Read and write on the bucket for that key (safe to repeat).
garage_quiet bucket allow "$bucket" --read --write --key "$key_id"
echo "garage-init: key aj-api may read and write $bucket"
