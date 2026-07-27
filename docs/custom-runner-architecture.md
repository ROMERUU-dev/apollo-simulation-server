# Custom Runner Architecture

Custom work is separated from the legacy RC worker and legacy
`cimasim-job-spool`.

```text
backend -> dedicated custom spool -> cimasim-custom-dispatcher
                                      |
                                      +-> rootless podman --cgroup-manager=cgroupfs run --rm --uts=host
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

The runner is still rootless Podman; it is not treated as VM-equivalent
isolation. Host validation selected the systemd service cgroup as the effective
resource boundary because the dispatcher processes one job synchronously. The
unit applies `MemoryMax=1073741824`, `CPUQuota=100%`, and `TasksMax=64`, covering
the dispatcher, Podman, conmon, the container, Xyce, and descendants. Podman
keeps its memory, CPU, and PID limit flags as defense in depth.

Rootless Podman uses `--cgroup-manager=cgroupfs` because the default systemd
cgroup manager could not create a nested scope from inside the hardened
dispatcher unit. The unit keeps `ProtectHostname=yes`, creating a private UTS
namespace for the service. Podman uses `--uts=host`, which shares that unit UTS
namespace with the container, not the global host UTS namespace. A controlled
`sethostname` probe remained denied. `ProtectHome=no` is required for access to
`/run/user/997`; `/home` and `/root` remain inaccessible via
`InaccessiblePaths=/home /root`.

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
