#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/reinstallation/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

parse_mode "$@"
require_dry_run_default
require_ubuntu
require_command sha256sum

log "This script inventories backup actions only. It does not copy secrets in dry-run."
run_or_show true "create encrypted secret bundle outside Git"
run_or_show true "record checksum of encrypted archive"
run_or_show true "create second encrypted copy"
run_or_show true "test decrypt on isolated host"

summary

