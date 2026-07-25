# Backup Matrix

Backups must be encrypted, checksummed, and periodically restored in a test
environment. No backup artifact belongs in Git.

| Item | Class | Backup method | Restore test |
|---|---|---|---|
| Apollo `.env` and related config | secret | encrypted secrets bundle | decrypt and validate file presence |
| Apollo DB | data persistent | dump after quiescing future service | restore to empty DB |
| Apollo DICOM store | data persistent | filesystem copy with checksum | non-clinical C-STORE/C-FIND test |
| Orthanc config | secret/config | encrypted secrets bundle | start Orthanc in test VM |
| Orthanc DB/storage | data persistent | dump plus filesystem copy | retrieve non-clinical study |
| CimaSim backend env | secret | encrypted secrets bundle | `/readyz` preflight |
| CimaSim admin allowlist | secret/config | encrypted secrets bundle | auth configuration check |
| CimaSim legacy spool | data persistent | archive with manifest | list historical RC results |
| CimaSim custom spool | data persistent | backup only when jobs exist | verify idle state |
| RustDesk private key | secret | encrypted secrets bundle | hbbs/hbbr start and preserve ID |
| Cloudflare tunnel config/token | secret | encrypted secrets bundle or provider recovery | tunnel status check |
| Tailscale state/recovery | secret/generated | documented recovery flow | node joins tailnet |
| Grafana data | data persistent | volume backup or provisioning replay | dashboard loads |
| Prometheus data | data persistent/prescindible | optional volume backup | target history optional |
| TLS certs/keys | secret/generated | encrypted secrets bundle | gateway TLS validation |

## Minimum Backup Rules

- Keep two encrypted copies.
- Keep at least one copy off-host or offline.
- Record date, host, source commit, and checksum.
- Test decryption before declaring a backup valid.
- Do not include secrets, dumps, or checksums of secret content in Git.

