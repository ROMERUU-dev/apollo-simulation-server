# Service Validation

## Host

- `systemctl --failed` has no unexpected units.
- Docker and containerd active.
- Tailscale active and node visible in tailnet.
- Cloudflare Tunnel active after Apollo/CimaSim routing is ready.
- No unexpected wildcard listeners.
- No OOM or filesystem errors in recent logs.

## Apollo And Orthanc

- 13 expected containers or updated documented count.
- All expected containers running.
- Database healthchecks pass.
- Gateway serves expected public routes.
- Orthanc accepts non-clinical test DICOM only.
- Validate C-STORE, C-FIND, and any configured forwarding with test data.
- Healthcheck endpoint decision is resolved: `/api/v1/ready` or
  `/api/v1/health`.

## RustDesk

- `hbbs` and `hbbr` running.
- Ports bound only to expected tailnet or selected interface.
- Private key present with minimal permissions.
- No restart loop.

## Monitoring

- Prometheus healthy.
- Targets UP.
- Grafana dashboard accessible through intended private path.
- Exporters not publicly exposed.
- Node exporter root mount, if used, remains read-only and is documented as a
  hardening WARN.

## CimaSim

- Backend `/healthz` returns 200.
- Backend `/readyz` returns 200.
- Preview serves expected static application.
- Legacy worker healthy and `network_mode: none`.
- `CIMASIM_CUSTOM_NETLISTS_ENABLED=false` until final approval.
- Custom dispatcher idle with zero jobs before custom is enabled.
- No Xyce, `orted`, or residual Podman containers after gates.

## VM Test

In a clean VM, verify:

- bootstrap from Ubuntu clean;
- dry-run;
- apply;
- second apply idempotent;
- no secrets in logs;
- services healthy;
- isolated networks;
- correct volumes;
- correct ports;
- Apollo empty but operational;
- RustDesk operational;
- monitoring operational;
- CimaSim operational;
- dispatcher idle;
- full host reboot;
- persistence after reboot;
- `verify-all` PASS.

