#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/reinstallation/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

parse_mode "$@"
require_dry_run_default
require_ubuntu
require_command findmnt

for path in / /var/lib/docker /var/lib/containers /srv/apollo-data /srv/apollo-backups /var/lib/cimasim-custom-spool; do
  if [[ -e "$path" ]]; then
    require_mountpoint "$path"
  else
    warn "path does not exist yet: $path"
  fi
done

log "Expected placeholders: <NVME_UUID> <APOLLO_DATA_UUID> <BACKUP_UUID>"
run_or_show true "create mount points only after final disk UUIDs are known"

summary

