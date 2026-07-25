#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/reinstallation/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

parse_mode "$@"
require_dry_run_default
require_ubuntu
require_command docker
require_command podman
check_subid_range cimasim-runner

log "CimaSim custom execution must remain disabled until final rootless gates pass."
run_or_show true "verify backend and preview images by digest"
run_or_show true "install verified dispatcher wheel only after manifest hash checks pass"
run_or_show true "start dispatcher without enabling it for idle gate"

summary
