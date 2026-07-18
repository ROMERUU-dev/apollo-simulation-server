# CimaSim Preview API Proxy

The preview remains the public entrypoint on `127.0.0.1:8088`. Cloudflare
Tunnel continues to route `sim.cimasim.online` to `http://localhost:8088`; this
deployment does not modify Cloudflare, DNS, or `cloudflared`.

## Toolchain

Frontend development requires Node.js 24 LTS. Use `nvm use` from the repository
root, then run frontend commands from `frontend/`:

```sh
nvm use
cd frontend
npm ci
npm run format:check
npm run lint
npm run test
npm run build
```

Node 18 is not compatible with the current frontend toolchain. Keep any system
Node installation in place unless it has been separately audited; do not use
`sudo npm`. The preview production image builds with the official
`node:24-alpine` builder stage and serves the final files from
`nginxinc/nginx-unprivileged`; Node and npm are not part of the runtime stage.

`deploy/preview/Dockerfile.dockerignore` is specific to the preview Dockerfile.
The Docker build context remains the repository root so the Dockerfile can copy
`frontend/` and `deploy/preview/nginx.conf`, but backend, docs, caches, local
env files, and other unrelated files are excluded before the context is sent to
the builder.

## Network Architecture

The preview keeps its existing `cimasim-preview-internal` network and also joins
the external bridge network `cimasim-edge-net`. The backend keeps
`cimasim-backend-net` for HTTPS JWKS egress and also joins `cimasim-edge-net`
with alias `cimasim-api`.

`cimasim-edge-net` is dedicated to CimaSim and should contain only:

- `cimasim-preview-frontend`
- `cimasim-backend-api`

It must not contain Apollo, RustDesk, or unrelated containers, and it does not
share Apollo networks, volumes, databases, credentials, or services.

## Published API Surface

Nginx proxies only exact requests for:

- `GET /api/health`
- `HEAD /api/health`
- `GET /api/me`
- `HEAD /api/me`

The proxy does not enable wildcard CORS. It forwards
`Cf-Access-Jwt-Assertion` to the backend, strips `Cookie`, strips
`Authorization`, and does not trust client-provided `X-Forwarded-*` headers.

The preview returns `404` without proxying for:

- `/api/*` other than the exact endpoints above
- `/healthz`
- `/readyz`
- `/docs`
- `/redoc`
- `/openapi.json`

Jobs, uploads, artifacts, backend liveness/readiness, and API documentation are
not public in this phase.

Do not show AUD, JWTs, `CF_Authorization`, `Cf-Access-Jwt-Assertion`, backend
env file values, JWKS keys, `kid`, or modulus values in logs, commands,
screenshots, or reports.

## Deploy

Create the shared network if it does not already exist:

```sh
docker network create \
  --driver bridge \
  --internal \
  --attachable \
  --label com.cimasim.purpose=edge-api \
  cimasim-edge-net
```

Apply backend network membership:

```sh
export CIMASIM_BACKEND_ENV_FILE=/home/romeruu/.config/cimasim/backend.env
export CIMASIM_BACKEND_IMAGE_TAG=581edc6

docker compose -p cimasim_backend \
  -f deploy/backend/docker-compose.yml \
  up -d --no-build --force-recreate api
```

Build and apply preview:

```sh
export CIMASIM_PREVIEW_IMAGE_TAG=<short-sha>

docker compose -p cimasim_preview \
  -f deploy/preview/docker-compose.yml \
  up -d --build frontend
```

## Smoke Test

```sh
deploy/preview/api-proxy-smoke-test.sh
```

The smoke test uses only `http://127.0.0.1:8088`, does not use JWTs or cookies,
and does not contact `sim.cimasim.online`.

## Rollback

Restore the previous `deploy/preview/docker-compose.yml`,
`deploy/preview/nginx.conf`, and `deploy/backend/docker-compose.yml` revisions,
then recreate only the affected CimaSim services:

```sh
export CIMASIM_BACKEND_ENV_FILE=/home/romeruu/.config/cimasim/backend.env
export CIMASIM_BACKEND_IMAGE_TAG=581edc6
export CIMASIM_PREVIEW_IMAGE_TAG=a7a5c2e

docker compose -p cimasim_backend \
  -f deploy/backend/docker-compose.yml \
  up -d --no-build --force-recreate api

docker compose -p cimasim_preview \
  -f deploy/preview/docker-compose.yml \
  up -d --build frontend
```

Remove `cimasim-edge-net` only after it has no members:

```sh
docker network rm cimasim-edge-net
```

Do not use `docker compose down`, `docker system prune`,
`docker network prune`, or commands against Apollo, RustDesk, Cloudflare,
firewall, Tailscale, SSH, Xyce, or ngspice.
