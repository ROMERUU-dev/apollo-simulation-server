#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/reinstallation/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

parse_mode "$@"
require_dry_run_default
require_ubuntu

log "Restore must happen from an encrypted bundle outside Git."
run_or_show true "verify encrypted bundle checksum"
run_or_show true "decrypt into temporary root-only staging directory"
run_or_show true "install secrets with restrictive permissions"
run_or_show true "remove temporary decrypted staging material"

summary

