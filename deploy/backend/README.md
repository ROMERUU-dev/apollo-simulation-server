# CimaSim Backend Internal Deployment

This deployment runs the phase 1 FastAPI backend only on `127.0.0.1:8089`.
It is isolated from the public preview, Cloudflare Tunnel, Apollo PACS/DICOM,
and RustDesk. It does not execute jobs, netlists, Xyce, ngspice, or simulations.

The runtime configuration file lives outside the repository:

```sh
/home/romeruu/.config/cimasim/backend.env
```

Never print, copy, commit, or paste the real AUD, JWTs, cookies, tokens, or
captured headers.

## Deploy

Use the repository root as the working directory:

```sh
export CIMASIM_BACKEND_ENV_FILE=/home/romeruu/.config/cimasim/backend.env
export CIMASIM_BACKEND_IMAGE_TAG=<short-sha>

docker compose -p cimasim_backend \
  -f deploy/backend/docker-compose.yml \
  up -d --build
```

The host publication is only `127.0.0.1:8089:8080`. There is no public proxy to
`/api` in this phase.

## Health And Readiness

```sh
curl -fsS http://127.0.0.1:8089/healthz
curl -fsS http://127.0.0.1:8089/readyz
```

Protected endpoints require a valid Cloudflare Access JWT and should return
`401` without one:

```sh
curl -i http://127.0.0.1:8089/api/health
curl -i http://127.0.0.1:8089/api/me
```

## Logs

```sh
docker compose -p cimasim_backend \
  -f deploy/backend/docker-compose.yml \
  logs --tail=100 api
```

Do not print environment variables or the external env file while debugging.

## Restart Only This Backend

```sh
docker compose -p cimasim_backend \
  -f deploy/backend/docker-compose.yml \
  restart api
```

## Stop Or Roll Back

```sh
docker compose -p cimasim_backend \
  -f deploy/backend/docker-compose.yml \
  down --remove-orphans
```

This rollback targets only the `cimasim_backend` project and does not affect
`cimasim_preview`, `apollo_server`, `apollo-orthanc-lab`, `rustdesk-server`, or
`cloudflared`.

## Remove Local Image

```sh
docker image rm cimasim-backend-api:<short-sha>
```

Do not use `docker system prune`, `docker network prune`, or a global
`docker compose down`.

## Isolation From Apollo

The backend uses its own image, container, project name, bridge network, and
loopback-only port. It has no Apollo networks, volumes, databases, credentials,
or services attached. The container has no persistent volumes, no Docker socket,
no privileged mode, no host network, and runs as UID/GID `10001`.
