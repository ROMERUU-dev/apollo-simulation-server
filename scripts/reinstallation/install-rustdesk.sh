#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/reinstallation/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

parse_mode "$@"
require_dry_run_default
require_ubuntu
require_command docker

log "RustDesk image must be pinned by digest; mutable tags without digest are rejected."
run_or_show true "restore RustDesk private key with owner-only permissions"
run_or_show true "deploy hbbs and hbbr after key permissions are validated"

summary
