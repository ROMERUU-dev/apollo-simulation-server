# CimaSim API Phase 1

This backend phase introduces only the FastAPI application boundary, health endpoints, Cloudflare Access JWT validation, and the authenticated identity endpoint. It does not implement jobs, uploads, queues, databases, workers, Xyce, ngspice, Docker deployment, or simulator execution.

## Local Setup

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[dev]'
```

Do not install dependencies globally and do not commit `.env` files.

## Configuration

Settings use the `CIMASIM_` prefix:

- `CIMASIM_ENV`
- `CIMASIM_CF_TEAM_DOMAIN`
- `CIMASIM_CF_AUD`
- `CIMASIM_ALLOWED_EMAIL_DOMAINS`
- `CIMASIM_ENABLE_DOCS`

Example values are in `.env.example`. The Cloudflare Access team domain may be stored there, but the real Application Audience AUD, JWTs, cookies, and tokens must never be committed.

The JWKS URL is derived internally as:

```text
${CIMASIM_CF_TEAM_DOMAIN}/cdn-cgi/access/certs
```

The backend never accepts a request-provided JWKS URL.

## Fail-Closed Behavior

`GET /healthz` remains available when authentication configuration is incomplete.

`GET /readyz` returns `503` if critical authentication configuration is missing or invalid.

Protected endpoints return `503` when authentication configuration is incomplete, `401` for missing or invalid JWTs, and `403` for a valid JWT whose email domain is not allowed.

There is no anonymous identity, fake user, auth bypass, or environment-provided test user in production code.

## Available Endpoints

- `GET /healthz`: unauthenticated liveness.
- `GET /readyz`: unauthenticated internal readiness for auth configuration.
- `GET /api/health`: authenticated frontend health.
- `GET /api/me`: authenticated identity and initial limits.

`/api/jobs`, artifacts, cancellation, queues, workers, and simulator execution are intentionally not implemented in this phase.

## Running Locally

```bash
cd backend
. .venv/bin/activate
CIMASIM_CF_AUD=example-aud uvicorn cimasim_api.main:create_app --factory --host 127.0.0.1 --port 8001
```

Use a non-production AUD for local development. Do not store real values in Git.

## Tests and Quality

```bash
cd backend
. .venv/bin/activate
ruff format --check .
ruff check .
mypy src
python -m pytest --cov=cimasim_api --cov-report=term-missing
python -m build
```

Tests use local RSA keys and simulated JWKS responses. They do not call Cloudflare or the Internet.

## Cloudflare Access AUD

The AUD should be retrieved later from the Cloudflare Access application configuration and provided through deployment configuration or secret storage. Keep staging and production AUD values explicit and separate.

Never commit AUD values, tokens, cookies, JWTs, private keys, PEM files, or captured production headers.
