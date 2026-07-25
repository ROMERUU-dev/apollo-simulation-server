#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/reinstallation/lib/common.sh
. "$SCRIPT_DIR/lib/common.sh"

parse_mode "$@"
require_dry_run_default
require_ubuntu

log "## Host"
uname -a
dpkg --print-architecture

log "## Packages"
for pkg in docker.io docker-compose-v2 containerd podman uidmap fuse-overlayfs cloudflared tailscale; do
  dpkg-query -W -f='${Package} ${Version} ${db:Status-Abbrev}\n' "$pkg" 2>/dev/null || warn "package not installed: $pkg"
done

log "## Services"
systemctl is-active docker containerd cloudflared tailscaled 2>/dev/null || true
systemctl show cimasim-custom-dispatcher.service -p ActiveState -p SubState -p UnitFileState -p NRestarts 2>/dev/null || true

log "## Containers"
if command -v docker >/dev/null 2>&1; then
  docker ps --format '{{.Names}} {{.Status}}'
else
  warn "docker not available"
fi

summary
