# Secrets Inventory

This file tracks secret categories and expected locations only. It must never
contain secret values, emails, tokens, private keys, passwords, patient names, or
DICOM tags.

## Expected Secrets

| Secret | Expected source | Restore target | Notes |
|---|---|---|---|
| Apollo environment | current host secure copy | `/srv/secrets/apollo/.env` or equivalent | validate permissions before Compose |
| Apollo DB credentials | Apollo env | generated DB users | rotate only with planned migration |
| Orthanc credentials | Orthanc env/config | Orthanc config path | do not expose DICOM credentials in logs |
| Cloudflare Tunnel token/config | Cloudflare dashboard or encrypted backup | `/etc/cloudflared` | prefer provider-side recovery if available |
| CimaSim backend env | encrypted backup | backend secret path | custom execution remains false until final gate |
| CimaSim admin allowlist | encrypted backup | backend secret path | treat addresses as sensitive |
| Grafana admin password | encrypted backup | Grafana secret file | rotate on rebuild if practical |
| RustDesk private key | encrypted backup | RustDesk data directory | preserve identity unless compromise is proven |
| TLS certificate and private key | encrypted backup or CA reissue | gateway cert path | private key mode must be owner-only |
| Tailscale state/recovery | Tailscale admin console or encrypted backup | tailnet enrollment | do not commit auth keys |
| Deployment tokens | external password manager | operator only | never write to scripts |

## Future Encrypted Bundle

Use one of:

- `age`
- `sops`
- external encrypted storage managed outside Git

Required metadata outside the secret payload:

- creation date;
- source host;
- operator;
- checksum of encrypted archive;
- restore test date;
- second-copy location.

## Permission Targets

- Private keys: `0600` when read as root; `0640` only when a minimal service
  group is required.
- Env files: `0640` or stricter.
- Directories containing secrets: no access for `other`.
- Public keys and certificates may remain world-readable if they contain no
  private material.
