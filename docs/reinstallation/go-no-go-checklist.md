# GO/NO-GO Checklist

## GO Requires

- [ ] Backups encrypted, checksummed, and test-decrypted.
- [ ] Final storage selected and mounted by UUID.
- [ ] UID/GID and subuid/subgid collisions checked.
- [ ] Docker and Podman versions recorded.
- [ ] Secrets restored with restrictive permissions.
- [ ] Apollo healthcheck endpoint decision resolved.
- [ ] All images pinned by digest.
- [ ] Custom dispatcher wheel hash matches source hash manifest.
- [ ] Systemd unit hashes match manifest.
- [ ] Dry-run PASS.
- [ ] First apply PASS.
- [ ] Second apply proves idempotence.
- [ ] VM test PASS, or explicit waiver recorded.
- [ ] Current disk retained as rollback.

## NO-GO Conditions

- [ ] Any secret appears in Git, logs, or PR output.
- [ ] Any production clinical data lacks verified backup.
- [ ] Any service needs a mutable image tag without digest.
- [ ] Any script requires world-writable chmod, destructive Docker cleanup, or
  global service restart.
- [ ] Any unexpected wildcard listener appears.
- [ ] Custom execution would be enabled before rootless gates pass.
