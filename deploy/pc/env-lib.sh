# Sourced by scripts/deploy.sh (pc and pi), scripts/deploy-lint.sh and deploy/pc/garage-init.sh (POSIX sh); not run
# on its own.
#
# env_load <env file> reads the file the way Docker Compose does (quotes stripped, trailing comments
# dropped, the shell's own environment first), so a value checked or imported by a script is the one
# the containers get. The file is data and is never sourced. Then env_get NAME prints NAME's value.
#
# AJ_OPTIONAL_VARS lists the variables in deploy/pc/.env.example that may be left empty. It is the one
# list: scripts/deploy.sh skips them in its empty-value check, and scripts/deploy-lint.sh requires compose
# to interpolate exactly these with a default (${NAME:-...}) and every other variable with ${NAME:?...}.
# The SMTP_* and EMAIL_* variables are optional because email delivery is (issue #15).
AJ_OPTIONAL_VARS="AJ_API_PORT SMTP_HOST SMTP_PORT SMTP_SECURITY SMTP_USERNAME SMTP_PASSWORD EMAIL_FROM EMAIL_ADMIN_ADDRESS"

# The same for deploy/pi/.env.example (the edge on the Pi). EDGE_KEY is its only required variable.
AJ_PI_OPTIONAL_VARS="AJ_API_URL AJ_EDGE_PORT AJ_TUNNEL_PORT"

# env_is_optional NAME [LIST] succeeds when NAME may be empty: it is in LIST (default AJ_OPTIONAL_VARS).
env_is_optional() {
	case " ${2-$AJ_OPTIONAL_VARS} " in
	*" $1 "*) return 0 ;;
	esac
	return 1
}
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
