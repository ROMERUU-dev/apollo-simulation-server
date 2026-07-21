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

Install the wheel into a root-owned virtual environment:

```sh
python3 -m venv /opt/cimasim/custom-dispatcher
/opt/cimasim/custom-dispatcher/bin/python -m pip install ./cimasim_custom_runner-*.whl
install -o root -g root -m 0644 cimasim-custom-dispatcher.service /etc/systemd/system/cimasim-custom-dispatcher.service
systemd-analyze verify /etc/systemd/system/cimasim-custom-dispatcher.service
systemctl daemon-reload
systemctl enable --now cimasim-custom-dispatcher.service
```

The service runs as `cimasim-runner`, writes only the custom spool, the runner
home, and `/run/user/997`, and publishes a sanitized heartbeat at
`state/dispatcher.json`.

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
