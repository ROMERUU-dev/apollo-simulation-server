# NVMe Installation Runbook

This runbook is for a future clean host. It is not to be executed on the current
server.

## Preflight

- Confirm final NVMe and HDD hardware.
- Record disk serials and SMART health.
- Decide storage scenario A, B, or C from `storage-layout.md`.
- Confirm backup and secret recovery material exists.
- Confirm no clinical data exists on the current Apollo runtime, or update the
  migration plan if that changes.

## Host Bootstrap

1. Install Ubuntu 24.04 LTS or the selected supported release.
2. Apply OS updates.
3. Set hostname and timezone.
4. Create mount points and mount final storage by UUID placeholders replaced
   with real values.
5. Install Docker, Compose, containerd, Podman, uidmap, and fuse-overlayfs.
6. Create service users/groups after checking UID/GID collisions.
7. Configure subuid/subgid ranges for rootless execution.
8. Install Tailscale and enroll the node.
9. Restore encrypted secrets into final paths with restrictive permissions.
10. Deploy services in `restore-order.md`.

## Apply Discipline

- Run every script first in `--dry-run`.
- Run `--apply` only after dry-run is PASS.
- Run `--apply` a second time to prove idempotence.
- Start services only after all preflight checks pass.
- Keep custom execution disabled until final gates pass.

