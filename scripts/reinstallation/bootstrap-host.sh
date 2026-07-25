#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/reinstallation/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

parse_mode "$@"
require_dry_run_default
require_ubuntu
require_command apt-get
require_command systemctl

check_user_collision cimasim-runner 997
check_group_collision cimasim-custom-spool 10004
check_subid_range cimasim-runner

run_or_show true "install required packages after operator approval"
run_or_show true "create service users only after collision checks pass"
run_or_show true "restore encrypted secrets outside Git"

summary

