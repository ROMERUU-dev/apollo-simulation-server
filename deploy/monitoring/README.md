# Private CimaSim monitoring

This Compose project is intentionally not deployed by this change. It uses an internal bridge network, publishes only Grafana on `127.0.0.1:3000`, and never mounts the Docker socket. Prometheus and both exporters have no published ports.

## Pinned supply

Versions were checked against official releases on 2026-07-20. Images are pinned to the Linux AMD64 manifest digest.

| Component | Version | Digest | License | Official source |
| --- | --- | --- | --- | --- |
| Prometheus | 3.12.0 | `sha256:dd4bced05dfaddf23a7ec50f87334993a4149f7fcfbf58456d1c8bafce91cd13` | Apache-2.0 | github.com/prometheus/prometheus/releases |
| Node Exporter | 1.11.1 | `sha256:fbd8062b4529e166e902bd62cd93de2f48b36d50af942620d419657265bc20b1` | Apache-2.0 | github.com/prometheus/node_exporter/releases |
| Grafana OSS | 13.1.0 | `sha256:6ea068891652aa6a65ca9065c26b89de939653803c836426970305c11fd00534` | AGPL-3.0 | grafana.com/grafana/download |

cAdvisor is intentionally excluded because it would broaden host and Docker visibility. Docker daemon metrics would require a daemon restart that could affect Apollo. Host, API, and aggregate spool metrics cover this phase without either mechanism.

## Operator prerequisites

Create `/home/romeruu/.config/cimasim/grafana-admin-password.txt` as an owner-only regular file (`0600`). Create `/home/romeruu/.config/cimasim/admin-emails.txt` as a regular file owned by backend UID `10001`, also mode `0600`; it contains one exact normalized email per line. Neither file is copied into an image or committed.

The backend must join `cimasim-monitoring-net` for private Prometheus scraping and fixed-query administrative summaries. `/metrics` is deliberately absent from Nginx. Grafana is intended for an SSH or Tailscale tunnel; it is not embedded in CimaSim.
