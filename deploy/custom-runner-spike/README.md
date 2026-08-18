# Rootless custom-runner spike

This is an architecture review artifact, not a production deployment. `CIMASIM_CUSTOM_NETLISTS_ENABLED` remains `false`.

The dispatcher must run as a dedicated system account `cimasim-runner` with no login shell, Docker group, sudo, SSH, backend secrets, Apollo access, or administrative Tailscale access. It invokes only the fixed `podman run` argument vector in `cimasim_custom_runner.dispatcher`; there is no generic image or command API.

The target host currently has unprivileged user namespaces enabled but does not have Podman, `newuidmap`, a `cimasim-runner` account, or delegated subuid/subgid ranges. That is a deployment blocker. Do not substitute Docker socket access. A reviewed host-administration task must install rootless Podman and provision the account before the smoke tests below can run.

Required gate:

1. Verify rootless `podman info` under `cimasim-runner`.
2. Build the fixed runner image from `custom_runner/Dockerfile` with the existing Xyce 7.10 additional context.
3. Confirm TRAN, DC, and AC fixtures with `--network=none`, read-only rootfs, one input directory and one output directory.
4. Confirm the runner cannot read a sibling job, the full spool, host files, Docker state, or backend configuration.
5. Confirm timeout termination leaves no Xyce, `orted`, conmon, or Podman process.

No system user, subuid/subgid entry, systemd unit, image, volume, or production container is created by this PR.
