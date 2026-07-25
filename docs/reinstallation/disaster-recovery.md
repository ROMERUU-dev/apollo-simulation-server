# Disaster Recovery

## Recovery Objectives

- Restore control-plane access first: SSH, Tailscale, RustDesk.
- Restore secrets from encrypted backup only.
- Restore Apollo empty if no clinical data exists; otherwise restore validated
  DICOM and database backups.
- Restore CimaSim stable path before custom execution.

## Loss Scenarios

| Scenario | Recovery |
|---|---|
| NVMe failure | Reinstall OS and applications; restore secrets; reattach HDD data |
| HDD data failure | Restore DICOM and backups from off-host encrypted copy |
| Secret loss | Recover from external password manager or provider consoles |
| Cloudflare Tunnel loss | Recreate tunnel from provider, update local config |
| Tailscale state loss | Re-enroll host and update ACL/routing records |
| RustDesk key loss | Restore private key or accept new server identity |

## Required Evidence For Recovery

- encrypted backup checksum;
- restore test log;
- manifest commit and artifact hashes;
- service validation PASS;
- operator sign-off.

