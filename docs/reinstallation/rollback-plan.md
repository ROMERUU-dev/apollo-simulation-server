# Rollback Plan

## Before Cutover

- Keep the current disk disconnected or mounted read-only as rollback media.
- Confirm encrypted secret backup decrypts.
- Confirm at least one off-host backup exists.
- Record DNS, Cloudflare, Tailscale, and tunnel state.
- Record current Compose project names and expected ports.

## During Cutover

- Do not erase the old disk until the new host passes GO/NO-GO.
- Avoid changing provider-side routing until local and tailnet checks pass.
- Keep custom execution disabled.
- Use only non-clinical DICOM test data.

## Rollback Trigger

Rollback if any of these occur:

- storage mount mismatch;
- secret restore failure;
- Apollo gateway or DICOM validation failure;
- CimaSim backend readiness failure;
- RustDesk identity failure;
- unexpected public listener;
- unresolved filesystem, OOM, or database errors.

## Rollback Action

1. Stop cutover.
2. Preserve logs from the new host without secrets.
3. Boot or reattach the previous disk.
4. Restore previous network routing if it was changed.
5. Re-run the short integrity audit.
