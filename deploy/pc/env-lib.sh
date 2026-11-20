# Sourced by scripts/deploy.sh and deploy/pc/garage-init.sh (POSIX sh); not run on its own.
#
# env_load <env file> reads the file the way Docker Compose does (quotes stripped, trailing comments
# dropped, the shell's own environment first), so a value checked or imported by a script is the one
# the containers get. The file is data and is never sourced. Then env_get NAME prints NAME's value.
env_load() {
	# `config --environment` prints the interpolation environment as NAME=value lines. It still needs a
	# project to load, so a one-service file on stdin stands in for the real compose file, which would
	# refuse to render while a required variable is empty (the very case the callers check for).
	env_resolved=$(printf 'name: env-lib\nservices:\n  x:\n    image: x\n' |
		docker compose -f - --env-file "$1" config --environment) || return 1
}

env_get() {
	printf '%s\n' "$env_resolved" | sed -n "s/^$1=//p" | tail -n 1
}
