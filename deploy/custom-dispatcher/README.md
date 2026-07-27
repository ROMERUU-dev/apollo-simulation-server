# Custom dispatcher deployment

This deployment keeps custom netlist execution behind
`CIMASIM_CUSTOM_NETLISTS_ENABLED=false` until the production gate is complete.
It does not use Docker socket access, a Podman socket, privileged containers, or
host networking.

## Host resources

Create a dedicated system group with a non-overlapping GID:

```sh
groupadd --system cimasim-custom-spool
usermod -a -G cimasim-custom-spool cimasim-runner
install -d -o root -g cimasim-custom-spool -m 2770 /var/lib/cimasim-custom-spool
install -d -o root -g cimasim-custom-spool -m 2770 /var/lib/cimasim-custom-spool/jobs
install -d -o root -g cimasim-custom-spool -m 2770 /var/lib/cimasim-custom-spool/queued
install -d -o root -g cimasim-custom-spool -m 2770 /var/lib/cimasim-custom-spool/claimed
install -d -o root -g cimasim-custom-spool -m 2770 /var/lib/cimasim-custom-spool/state
```

The backend container must receive the numeric custom spool GID through
`CIMASIM_CUSTOM_SPOOL_GID` and mounts only this bind path at `/custom-spool`.
The legacy worker and preview must not mount the custom spool.

## Runner image

Build the runner under the `cimasim-runner` Podman storage and record the full
local image ID:

```sh
podman image inspect localhost/cimasim-custom-runner:<tag> --format '{{.Id}}'
```

The dispatcher accepts only a full `sha256:<64 hex>` image ID through the
external file `/etc/cimasim/custom-dispatcher.env`. Tags such as `review`,
`latest`, or commit tags are rejected by code.

The environment file is not a secret, but it must be root-owned and not writable
by `cimasim-runner`:

```sh
install -d -o root -g root -m 0755 /etc/cimasim
install -o root -g cimasim-runner -m 0640 custom-dispatcher.env /etc/cimasim/custom-dispatcher.env
```

## Service

Build the wheel and provenance manifest from the exact repository HEAD:

```sh
scripts/custom-dispatcher-build-provenance.sh
```

The manifest records the commit SHA, source archive SHA-256, wheel SHA-256, and
systemd unit SHA-256. The installer refuses to continue if any recorded hash does
not match.

Install the verified wheel into a root-owned virtual environment:

```sh
scripts/install-verified-custom-dispatcher.sh custom_runner/dist/cimasim-custom-dispatcher-<sha>.manifest
systemctl daemon-reload
systemctl start cimasim-custom-dispatcher.service
```

The service runs as `cimasim-runner`, writes only the custom spool, the runner
home, and `/run/user/997`, and publishes a sanitized heartbeat at
`state/dispatcher.json`.

The dispatcher remains rootless. The service uses systemd resource limits as
the effective enforcement point because this deployment processes only one
custom job synchronously. The validated limits are:

- `MemoryMax=1073741824`;
- `CPUQuota=100%`;
- `TasksMax=64`.

These unit limits cover the dispatcher, Podman, conmon, the runner container,
Xyce, and any descendants. The Podman command still keeps `--memory=1g`,
`--cpus=1`, and `--pids-limit=64` as defense-in-depth flags, but host validation
showed the effective limits come from the systemd service cgroup.

Rootless Podman is launched with `--cgroup-manager=cgroupfs` because the systemd
cgroup manager could not create a nested scope from this hardened unit. The
unit keeps `ProtectHostname=yes`; the container uses `--uts=host`, which shares
the unit's private UTS namespace with the container rather than the global host
UTS namespace. Attempts to change the hostname remain denied. `ProtectHome=no`
is required so rootless Podman can access `/run/user/997`; `/home` and `/root`
remain blocked with `InaccessiblePaths=/home /root`.

Do not enable the service until the 120-second idle gate passes.

## Disabled staging

Keep:

```sh
CIMASIM_CUSTOM_NETLISTS_ENABLED=false
CIMASIM_ALLOW_LEGACY_RC_SUBMISSION=false
```

Expected state:

- dispatcher active and idle;
- heartbeat recent;
- custom spool empty;
- no rootless runner containers;
- backend and preview healthy;
- legacy RC history readable;
- legacy submission returns `410`;
- custom submission remains disabled.
