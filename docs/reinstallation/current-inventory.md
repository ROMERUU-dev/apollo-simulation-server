# Current Non-Secret Inventory

Captured from the existing host in read-only mode on 2026-07-25. This is an
input to the future rebuild, not an instruction to preserve the current runtime
byte-for-byte.

## Host

| Resource | Current value | Class |
|---|---|---|
| OS | Ubuntu 24.04.4 LTS (`noble`) | recreable |
| Kernel | `6.17.0-35-generic` | recreable |
| Architecture | `amd64` / `x86_64` | recreable |
| Docker package | `docker.io 29.1.3-0ubuntu3~24.04.2` | recreable |
| Docker Compose | `docker-compose-v2 2.40.3+ds1-0ubuntu1~24.04.1` | recreable |
| containerd | `2.2.1-0ubuntu1~24.04.3` | recreable |
| Podman | `4.9.3+ds1-1ubuntu0.2` | recreable |
| uidmap | `1:4.13+dfsg1-4ubuntu3.2` | recreable |
| fuse-overlayfs | `1.13-1` | recreable |
| cloudflared | `2026.7.2` | recreable plus secret |
| Tailscale | `1.98.8` | recreable plus identity |

## Service Users And Groups

| Name | Current value | Class |
|---|---|---|
| `cimasim-runner` | UID `997`, GID `984` | configuration manual |
| `cimasim-custom-spool` | GID `10004`; member `cimasim-runner` | configuration manual |
| Docker group | GID `125`; member `romeruu` | configuration manual |
| `subuid` | `cimasim-runner:262144:65536` | configuration manual |
| `subgid` | `cimasim-runner:262144:65536` | configuration manual |

Do not assume these IDs are free on a clean host. The bootstrap must detect
collisions before creating users or groups.

## Systemd Units And Timers

| Unit | Current state | Class |
|---|---|---|
| `docker.service` | enabled, active | recreable |
| `containerd.service` | enabled, active | recreable |
| `cloudflared.service` | enabled, active | secret-backed |
| `tailscaled.service` | enabled, active | secret-backed |
| `rustdesk.service` | enabled, active desktop service | recreable |
| `cimasim-custom-dispatcher.service` | disabled, inactive | versioned plus generated |
| `podman.service` | enabled | recreable |
| `podman-auto-update.timer` | enabled | configuration manual |

## Compose Projects

| Project | Services | Class |
|---|---|---|
| `cimasim_backend` | `api` | versioned |
| `cimasim_preview` | `frontend` | versioned |
| `cimasim_jobs` | `worker` | versioned |
| `cimasim_monitoring` | `prometheus`, `grafana`, `node-exporter`, `spool-exporter` | versioned |
| `apollo_server` | gateway, API, frontend, OHIF, auth, DB, DICOM services | configuration manual |
| `apollo-orthanc-lab` | Orthanc and Orthanc DB | configuration manual |
| `rustdesk-server` | `hbbs`, `hbbr` | configuration manual |

## Running Images

| Component | Current image | Class |
|---|---|---|
| CimaSim backend | `cimasim-backend-api:fd34449` | generated |
| CimaSim preview | `cimasim-preview-frontend:fd34449` | generated |
| CimaSim legacy worker | `cimasim-xyce-worker:e7353fb` | generated |
| Prometheus | `prom/prometheus:v3.12.0@sha256:dd4b...cd13` | recreable |
| Grafana | `grafana/grafana:13.1.0@sha256:6ea0...00534` | recreable |
| Node exporter | `prom/node-exporter:v1.11.1@sha256:fbd8...20b1` | recreable |
| Apollo gateway | `nginx:1.27-alpine` | recreable |
| Apollo API/storage/MWL/frontend | locally built `apollo_server-*` | generated |
| Orthanc | `orthancteam/orthanc:26.6.1` | recreable |
| RustDesk | `rustdesk/rustdesk-server:latest` | unknown; must pin digest |

`latest` is not acceptable for the rebuilt host. Pin RustDesk by digest before
production use.

## Docker Networks

| Network | Current purpose | Class |
|---|---|---|
| `cimasim-edge-net` | internal CimaSim edge API link | recreable |
| `cimasim-backend-net` | backend private network | recreable |
| `cimasim-preview-internal` | preview private network | recreable |
| `cimasim-monitoring-net` | monitoring private network | recreable |
| `apollo_server_default` | Apollo app network | recreable |
| `apollo-orthanc-lab_orthanc-lab` | Orthanc lab network | recreable |
| `rustdesk-server_default` | RustDesk server network | recreable |

No CimaSim container was observed attached to Apollo or RustDesk networks.

## Published Ports

| Port | Bind | Component | Class |
|---|---|---|---|
| `80/tcp`, `443/tcp` | `0.0.0.0`, `[::]` | Apollo gateway | configuration manual |
| `8088/tcp` | `127.0.0.1` | CimaSim preview | versioned |
| `8089/tcp` | `127.0.0.1` | CimaSim backend | versioned |
| `8042/tcp` | `127.0.0.1` | Orthanc HTTP | configuration manual |
| `4242/tcp` | Tailscale IP | Orthanc DICOM | configuration manual |
| `11112/tcp`, `11113/tcp` | Tailscale IP | Apollo DICOM services | configuration manual |
| `21115-21117/tcp`, `21116/udp` | Tailscale IP | RustDesk server | configuration manual |

Grafana is currently internal-only: container port `3000/tcp` is not published
to the host.

## Persistent Paths And Mounts

| Path or volume | Purpose | Class |
|---|---|---|
| `/var/lib/docker` | Docker state | generated/persistent |
| `/var/lib/containers` | Podman state | generated/persistent |
| `cimasim-job-spool` | legacy CimaSim spool | data persistent |
| `/var/lib/cimasim-custom-spool` | custom CimaSim spool | data persistent |
| `cimasim-prometheus-data` | Prometheus data | data persistent |
| `cimasim-grafana-data` | Grafana data | data persistent |
| `/home/romeruu/apollo-data/dicom` | Apollo DICOM path | data persistent |
| `/home/romeruu/apollo-data/postgres` | Apollo DB path | data persistent |
| `/home/romeruu/apollo_server/infra/orthanc/data/*` | Orthanc storage/DB | data persistent |
| `/home/romeruu/rustdesk-server/data` | RustDesk server key and DB | secret plus generated |
| `/srv/apollo-data` | final data mount candidate, currently mostly empty | persistent target |

## Secret And Config Paths

Secret values must not be committed. Only paths and permissions belong in the
runbook.

| Path | Purpose | Class |
|---|---|---|
| `/etc/cimasim/custom-dispatcher.env` | dispatcher configuration | secret/config manual |
| `/home/romeruu/.config/cimasim/admin-emails.txt` | CimaSim admin allowlist | secret/config manual |
| `/home/romeruu/.config/cimasim/grafana-admin-password.txt` | Grafana admin password | secret |
| `/home/romeruu/apollo_server/.env` | Apollo configuration | secret |
| `/home/romeruu/apollo_server/infra/orthanc/.env` | Orthanc configuration | secret |
| `/etc/cloudflared/*` | Cloudflare tunnel token/config | secret |
| `/var/lib/tailscale/tailscaled.state` | Tailscale node state | secret/generated |
| `/home/romeruu/rustdesk-server/data/id_ed25519` | RustDesk private key | secret |
| `/home/romeruu/apollo_server/infra/gateway/certs/*` | TLS certificate/key | secret/generated |

## Known Drift And Decisions

- PR #15 custom dispatcher deployment is paused.
- Installed dispatcher wheel drifted from source because version `0.1.0` was
  reused for different source content. Future installs must verify wheel and
  source hashes.
- Apollo `docker-compose.yml` has local drift changing the API healthcheck from
  `/api/v1/ready` to `/api/v1/health`. Decide the correct endpoint after
  verifying the Apollo version selected for the clean rebuild.
- Apollo has no real clinical data yet. Prefer a clean empty reinstall over
  migrating current runtime volumes.

