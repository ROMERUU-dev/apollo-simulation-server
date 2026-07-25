#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/reinstallation/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

parse_mode "$@"
require_dry_run_default
require_ubuntu

require_command docker
require_command systemctl
require_command curl

if command -v docker >/dev/null 2>&1; then
  docker ps --format '{{.Names}} {{.Status}}' | sed -n '1,80p'
fi

run_or_show true "check CimaSim /healthz and /readyz"
run_or_show true "check Apollo gateway and DICOM with non-clinical test data"
run_or_show true "check RustDesk hbbs/hbbr"
run_or_show true "check Prometheus targets and Grafana health"
run_or_show true "assert zero Xyce/orted and zero residual Podman containers"

summary
