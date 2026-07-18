# Internal Xyce Worker Spike

This deployment is an isolated internal spike for proving that CimaSim can run a
single fixed Xyce circuit in a container. It is not connected to the API or the
frontend and exposes no ports.

The worker:

- runs only the bundled fixed RC low-pass netlist;
- does not accept user netlists, models, files, or electrical parameters;
- does not run sweeps or parallel jobs;
- writes only `summary.json` and `waveform.csv` under `/output/<run-id>/`;
- failed runs keep a terminal `summary.json` and do not keep partial waveforms;
- uses `network_mode: none`, no new privileges, dropped capabilities, read-only
  root filesystem, a non-root UID/GID, PID/CPU/memory limits, and tmpfs `/tmp`;
- is not the production worker.

The Xyce installation is supplied as a local Docker additional context. Do not
copy Xyce binaries, compiled libraries, installers, or tarballs into the
repository.

```bash
export CIMASIM_XYCE_PREFIX=/path/to/local/xyce-prefix
export CIMASIM_XYCE_IMAGE_TAG=dev

docker compose -p cimasim_xyce_spike \
  -f deploy/worker/docker-compose.yml \
  build xyce-spike

docker compose -p cimasim_xyce_spike \
  -f deploy/worker/docker-compose.yml \
  run --rm xyce-spike --run-id manual-a
```

Inspect artifacts with a read-only helper container:

```bash
docker run --rm --network none \
  -v cimasim-xyce-spike-output:/output:ro \
  busybox:1.36 \
  find /output -maxdepth 3 -type f -name summary.json -o -name waveform.csv
```

Run the reproducible smoke test:

```bash
export CIMASIM_XYCE_PREFIX=/path/to/local/xyce-prefix
export CIMASIM_XYCE_IMAGE_TAG=smoke
deploy/worker/smoke-test.sh
```

Rollback the spike containers only:

```bash
docker compose -p cimasim_xyce_spike \
  -f deploy/worker/docker-compose.yml \
  down --remove-orphans
```

The command above does not remove the output volume. Remove it only when
explicitly intended:

```bash
docker volume rm cimasim-xyce-spike-output
```

Known limitations:

- no API integration;
- no authenticated user job lifecycle;
- no queue, Redis, database, retention policy, or scheduling;
- no user-supplied netlists or models;
- no parallel execution;
- the current local Xyce build is MPI-linked and may start a transient local
  Open MPI `orted` helper even for a single Xyce process.

The next phase should introduce an authenticated API and queue-backed worker
contract before accepting any user-provided simulation input.
