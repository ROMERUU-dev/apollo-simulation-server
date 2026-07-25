# Storage Layout Proposal

This proposal is documentation only. Do not apply it on the current host.

## Goals

- Put the OS, applications, Docker, Podman, active databases, active CimaSim
  spools, Prometheus, Grafana, and temporary execution paths on NVMe.
- Put DICOM data, Apollo archives, local backups, exports, and verified
  snapshots on final HDD storage.
- Keep stable mount points independent of transient disk names.
- Use placeholder UUIDs until final disks are selected:
  - `<NVME_UUID>`
  - `<APOLLO_DATA_UUID>`
  - `<BACKUP_UUID>`

## Proposed Mount Points

| Mount point | Backing storage | Contents |
|---|---|---|
| `/` | NVMe | Ubuntu and base packages |
| `/var/lib/docker` | NVMe | Docker images, layers, volumes |
| `/var/lib/containers` | NVMe | Podman/rootless container state |
| `/opt` | NVMe | installed application artifacts |
| `/var/lib/cimasim-custom-spool` | NVMe | active custom CimaSim spool |
| `/srv/cimasim-spool` | NVMe | active legacy spool if moved out of Docker volume |
| `/srv/apollo-db` | NVMe | active Apollo database data |
| `/srv/orthanc-db` | NVMe | active Orthanc database data |
| `/srv/monitoring` | NVMe | Prometheus and Grafana active data |
| `/srv/apollo-data` | HDD | DICOM storage and Apollo archive |
| `/srv/apollo-backups` | HDD or independent backup disk | Apollo backups |
| `/srv/cimasim-backups` | HDD or independent backup disk | CimaSim backups |
| `/srv/exports` | HDD | non-clinical exports and transfer staging |

## Example `fstab` Template

```fstab
UUID=<NVME_UUID> / ext4 defaults,noatime 0 1
UUID=<APOLLO_DATA_UUID> /srv/apollo-data ext4 defaults,noatime,nofail 0 2
UUID=<BACKUP_UUID> /srv/apollo-backups ext4 defaults,noatime,nofail 0 2
```

Do not commit real UUIDs until the hardware is final and the runbook is being
executed.

## Scenario A: One NVMe And One HDD

- NVMe: OS, Docker, Podman, active databases, active spools, monitoring.
- HDD: DICOM storage, local backups, exports.
- Risk: a single HDD failure loses DICOM and local backups unless off-host
  backups are current.
- Minimum requirement: external encrypted backup copy.

## Scenario B: One NVMe And Two HDD In A Mirror

- NVMe: OS and active workloads.
- HDD mirror: DICOM storage and local backups.
- Mirror can reduce downtime after one HDD fails.
- Mirror is not backup: accidental delete, corruption, and ransomware are
  replicated.
- Additional off-host or offline backup remains required.

## Scenario C: One NVMe, Mirrored Data, Independent Backup Disk

- NVMe: OS and active workloads.
- HDD mirror: DICOM and archive data.
- Separate HDD: local encrypted backups.
- Best local resilience of the three scenarios, but still requires one off-host
  copy for disaster recovery.

## Filesystem And RAID Notes

Do not configure ZFS, Btrfs, or mdadm in this PR. Choose after hardware is
installed and SMART health is checked.

| Option | Benefits | Requirements |
|---|---|---|
| ext4 single disk | simple, well understood | external backup discipline |
| mdadm mirror + ext4 | common Linux mirror stack | monitoring, replacement drill |
| ZFS mirror | checksums, snapshots | memory, operator familiarity |
| Btrfs mirror | checksums and snapshots | careful operational runbook |

RAID or mirrors reduce some hardware-failure risk. They do not replace backup.

