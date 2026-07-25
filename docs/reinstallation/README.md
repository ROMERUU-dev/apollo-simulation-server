# Reproducible Server Reinstallation

This directory prepares a clean rebuild of the CimaSim, Apollo PACS, Orthanc,
RustDesk, monitoring, Cloudflare Tunnel, and Tailscale host.

The current runtime is intentionally frozen. Do not use these notes to change
the existing server. The future rebuild target is final NVMe storage for the
operating system, applications, Docker, Podman, active databases, and active
spools, plus final HDD storage for DICOM data and backups.

## Current Freeze

- PR #15 remains draft and paused.
- `cimasim-custom-dispatcher.service` remains disabled and inactive.
- `CIMASIM_CUSTOM_NETLISTS_ENABLED=false`.
- `CIMASIM_ALLOW_LEGACY_RC_SUBMISSION=false`.
- Backend and preview currently run image tag `fd34449`.
- The legacy worker currently runs image tag `e7353fb`.
- Apollo, RustDesk, monitoring, Cloudflare Tunnel, and Tailscale remain
  operational on the current host.

## Documents

- [current-inventory.md](current-inventory.md): non-secret runtime inventory.
- [storage-layout.md](storage-layout.md): proposed NVMe/HDD layout.
- [backup-matrix.md](backup-matrix.md): what to back up and how to verify it.
- [secrets-inventory.md](secrets-inventory.md): expected secret locations and
  handling rules.
- [restore-order.md](restore-order.md): ordered rebuild sequence.
- [nvme-installation-runbook.md](nvme-installation-runbook.md): host bootstrap
  runbook.
- [service-validation.md](service-validation.md): post-restore validation.
- [rollback-plan.md](rollback-plan.md): rollback and old-disk hold plan.
- [disaster-recovery.md](disaster-recovery.md): recovery procedures.
- [go-no-go-checklist.md](go-no-go-checklist.md): final cutover checklist.

## Scripts

Scripts under `scripts/reinstallation/` default to `--dry-run`. They must not
modify a host unless invoked with `--apply`, after the preflight checks and
GO/NO-GO checklist pass. This PR executes dry-run only.

## Immutable Deployment Rule

Future installs must use immutable references:

- Git commit SHA, not branch names.
- Container image digest, not only tags.
- Wheel SHA-256 and source SHA-256.
- Systemd unit SHA-256.
- Sanitized configuration SHA-256.

See `deploy/manifests/example-host-manifest.yaml`.

