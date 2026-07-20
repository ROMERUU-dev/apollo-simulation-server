# Fixed-template jobs deployment

This Compose project runs the single CimaSim Xyce worker against the external
`cimasim-job-spool` volume. The worker accepts only the compiled-in
`rc_lowpass_fixed_v1` template, executes one job at a time, has no network or
ports, and does not mount backend configuration or any Apollo resource.

## Initialize once

Create the dedicated volume only when it does not already exist:

```sh
docker volume create --label com.cimasim.purpose=fixed-job-spool cimasim-job-spool
docker compose -p cimasim_jobs -f deploy/jobs/docker-compose.yml \
  --profile init run --rm spool-init
```

The administrative owner is root, the shared group is GID `10003`, and all
spool directories are mode `2770`. Backend UID `10001` and worker UID `10002`
join GID `10003`; persistent files use group-readable/writable private modes.

## Build and start

```sh
export CIMASIM_XYCE_PREFIX=/home/romeruu/.local/opt/xyce/xyce-mpi
export CIMASIM_XYCE_WORKER_IMAGE_TAG=<short-sha>
docker compose -p cimasim_jobs -f deploy/jobs/docker-compose.yml build worker
docker compose -p cimasim_jobs -f deploy/jobs/docker-compose.yml up -d worker
deploy/jobs/smoke-test.sh
```

## Rollback

Keep the spool volume for analysis. Restore only the three CimaSim containers:

```sh
export CIMASIM_BACKEND_ENV_FILE=/home/romeruu/.config/cimasim/backend.env
export CIMASIM_BACKEND_IMAGE_TAG=581edc6
export CIMASIM_PREVIEW_IMAGE_TAG=f2faf45

docker compose -p cimasim_preview -f /tmp/<rollback-dir>/preview-compose.yml \
  up -d --no-deps --force-recreate frontend
docker compose -p cimasim_jobs -f deploy/jobs/docker-compose.yml stop worker
docker compose -p cimasim_jobs -f deploy/jobs/docker-compose.yml rm -f worker
docker compose -p cimasim_backend -f /tmp/<rollback-dir>/backend-compose.yml \
  up -d --no-deps --force-recreate api
deploy/preview/api-proxy-smoke-test.sh
```

After restoring the previous Nginx image, `/api/jobs` returns `404`. The
rollback does not remove `cimasim-job-spool`; removal requires a separate,
explicit future task. Do not use Compose `down` for backend or preview and do
not use Docker prune commands.
