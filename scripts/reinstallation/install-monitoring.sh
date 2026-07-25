#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/reinstallation/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

parse_mode "$@"
require_dry_run_default
require_ubuntu
require_command docker

log "Monitoring exporters must not publish public ports."
log "Node exporter root mount, if retained, must be read-only and documented as hardening WARN."
run_or_show true "restore Grafana secret and provisioning files"
run_or_show true "deploy Prometheus, Grafana, node exporter, and spool exporter"

summary
