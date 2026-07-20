# Custom Runner Architecture

Custom work is separated from the legacy RC worker and legacy
`cimasim-job-spool`.

```text
backend -> dedicated custom spool -> cimasim-custom-dispatcher
                                      |
                                      +-> rootless podman run --rm
                                           /job/input:ro
                                           /job/output:rw
                                           tmpfs /tmp
                                           Xyce 7.10
```

The backend stores only normalized requests in a dedicated custom spool. The
dispatcher claims one marker at a time, revalidates the request, creates
job-local input and output directories, and invokes one fixed Podman argument
vector. The runner image, entrypoint, command, executable, mount destinations,
resource limits, and timeout are administrative constants.

The runner performs Xyce `-norun` preflight and then a maximum 60-second run.
SIGTERM or deadline expiry terminates the full process group, followed by
SIGKILL after a five-second grace period. Temporary directories are removed and
terminal metadata uses sanitized stable errors. The dispatcher never mounts or
receives the Docker socket.

Production requirements not performed by this PR:

1. Install rootless Podman and `newuidmap`/`newgidmap` through a reviewed host
   administration task.
2. Provision non-login account `cimasim-runner` with dedicated subuid/subgid
   ranges and no Docker group, sudo, SSH, secrets, Apollo data, or administrative
   Tailscale access.
3. Provision the dedicated custom spool and restricted dispatcher service.
4. Pass TRAN, DC, AC, sibling-job isolation, host-denial, timeout, and residual
   process smoke tests.
5. Only then enable `CIMASIM_CUSTOM_NETLISTS_ENABLED` in a separate deployment.

There is no Docker fallback. If rootless isolation cannot be established, the
custom feature remains disabled.
