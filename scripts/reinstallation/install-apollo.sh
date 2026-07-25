#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/reinstallation/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

parse_mode "$@"
require_dry_run_default
require_ubuntu
require_command docker

log "Apollo should be recreated empty unless real clinical data is introduced before rebuild."
log "Pending decision: API healthcheck endpoint /api/v1/ready versus /api/v1/health."
run_or_show true "restore Apollo secrets from encrypted bundle"
run_or_show true "deploy Apollo Compose after secrets and storage pass preflight"
run_or_show true "run migrations into empty databases"

summary
