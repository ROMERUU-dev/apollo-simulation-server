# Private observability architecture

The phase-one monitoring plane is a separate `cimasim_monitoring` Compose project. It is not deployed by this change. Prometheus, Node Exporter, and the spool exporter are reachable only on `cimasim-monitoring-net`; Grafana alone binds to `127.0.0.1:3000` for an operator tunnel.

```text
node-exporter ----+
backend /metrics-+--> Prometheus --> Grafana
spool-exporter --+         |
                           +--> fixed-query admin API --> /admin/monitoring
```

The backend metrics endpoint accepts traffic only from the fixed monitoring CIDR and is explicitly blocked by preview Nginx. Administrative API calls continue to require a valid Cloudflare Access identity and then apply a separate exact-email allowlist loaded from an external owner-only file. Email values are neither logged nor returned.

## Data minimization

Metric labels are limited to normalized route, method, status class, bounded job kind, and final status. Job IDs, user IDs, names, email addresses, netlists, parameters, IP addresses, user agents, and request IDs are prohibited as labels. The spool exporter mounts `cimasim-job-spool` read-only, rejects symlinks, and returns aggregate counts only.

The admin API does not proxy arbitrary PromQL. Queries are constants in backend code, use a two-second timeout, cache for fifteen seconds, return at most 200 points per series, and accept only `15m`, `1h`, `6h`, or `24h`.

## Deliberate exclusions

cAdvisor is excluded because its normal deployment broadens host and container visibility. The Docker socket and daemon metrics are excluded, and Docker is not restarted, because Apollo shares the daemon. Loki, Tempo, OpenTelemetry Collector, SaaS services, remote write, external alert notification, and third-party Grafana plugins are out of scope.

Node Exporter uses the official container pattern with read-only `/proc`, `/sys`, and host-root mounts. It does not use `privileged`, host networking, host PID, devices, the Docker socket, the CimaSim spool, or individual Apollo volumes. Its collectors expose aggregate kernel and filesystem counters, not file contents, users, process arguments, or environment variables.

## Operations

Prometheus retains up to fifteen days and 2 GB. Grafana registration, anonymous access, update checks, reporting, and automatic plugin administration are disabled. Alert rules are local and visible in Grafana and the sanitized admin summary; notification delivery is intentionally absent in phase one.
