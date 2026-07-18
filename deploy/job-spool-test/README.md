# Internal Job Spool Test

This compose project is only for isolated validation of the fixed-template job spool.
It is not connected to the active preview, backend, Apollo, Cloudflare, or RustDesk.

Set the local Xyce prefix without committing host paths:

```bash
export CIMASIM_XYCE_PREFIX=/path/to/xyce-prefix
deploy/job-spool-test/smoke-test.sh
```

The test uses a dedicated Docker volume named `cimasim-job-spool-test`. The backend
runs as UID 10001 with supplemental group 10003; the worker runs as UID 10002
with supplemental group 10003. The spool initializer prepares `/spool` as
`root:10003` with setgid directories and no permissions for `other`.

The worker runs with `network_mode: none`, no published ports, a read-only root
filesystem, no Linux capabilities, no new privileges, and fixed CPU, memory,
swap, and PID limits. It executes only `rc_lowpass_fixed_v1`.

Stop and remove only this test project:

```bash
docker compose -p cimasim_job_spool_test -f deploy/job-spool-test/docker-compose.yml down --remove-orphans
```

Remove the dedicated output volume only when explicitly needed:

```bash
docker volume rm cimasim-job-spool-test
```
