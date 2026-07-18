# CimaSim API Contract v1

## Overview

Authenticated API routes are rooted at `/api` and return JSON unless an artifact download endpoint states otherwise. Internal service health routes are outside `/api`.

The backend must validate Cloudflare Access JWTs from `Cf-Access-Jwt-Assertion` and derive identity from validated claims. The frontend and API should be served from the same origin for v1. Mutable v1 endpoints accept only `application/json`.

The current internal phase executes only the fixed `rc_lowpass_fixed_v1` template.
It does not accept arbitrary netlists, model files, parameters, sweeps, simulator
selection, paths, commands, or environment variables from users. These routes are
implemented in the backend but are not exposed through the preview Nginx config
yet, and the frontend does not call them yet.

## Identity Schema

Validated identity is represented internally as:

```json
{
  "user_id": "cf-sub:4f7f2c1b-8f3d-4db7-84f0-62d890000000",
  "email": "user@example.com",
  "name": "Example User",
  "roles": ["user"],
  "is_admin": false
}
```

An optional `groups` field may be present only when Cloudflare Access is explicitly configured to emit a validated groups claim.

Identity rules:

- `user_id` is derived from the stable `sub` claim after JWT validation.
- `email` is derived only from a validated JWT claim.
- `groups` is optional and must not be assumed to exist.
- `roles` and `is_admin` are resolved by CimaSim configuration or internal storage after identity validation.
- `is_admin` must not be trusted directly from a request header or arbitrary JWT claim.
- the exact Cloudflare Access Application Audience AUD is loaded from deployment configuration or secret storage.
- staging and production AUD values must be configured explicitly and separately.
- the raw JWT is never persisted.

Required JWT validation:

- verify signature using Cloudflare Access public keys;
- verify issuer;
- verify exact configured audience;
- verify expiration;
- verify not-before when the claim exists;
- derive the stable user identifier from `sub`;
- do not persist the raw JWT.

HTTP security rules:

- do not use `Access-Control-Allow-Origin: *`;
- validate `Origin` for browser-originating mutable requests when applicable;
- trust `X-Forwarded-*` only from the controlled proxy path;
- return `404 Not Found` for resources that do not exist or are not visible to the authenticated user;
- logs must not include tokens, cookies, full netlists, private host paths, or sensitive headers.

## Common Error Shape

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The request body is invalid.",
    "details": [
      {
        "field": "netlist.content",
        "reason": "exceeds_limit"
      }
    ],
    "request_id": "req_01JZ7X2P0D6WM3Q5GMQKT5W9Q8"
  }
}
```

Common status codes:

- `400 Bad Request`: malformed JSON or invalid query parameter.
- `401 Unauthorized`: missing or invalid Cloudflare Access JWT.
- `404 Not Found`: resource does not exist or is not visible to the user.
- `409 Conflict`: invalid lifecycle transition or idempotency conflict.
- `413 Payload Too Large`: request exceeds size limit.
- `415 Unsupported Media Type`: mutable endpoint did not receive `application/json`.
- `422 Unprocessable Entity`: schema-valid request rejected by domain validation.
- `429 Too Many Requests`: rate, quota, or global capacity exceeded.
- `503 Service Unavailable`: queue or metadata store unavailable.

## Pagination

List endpoints use cursor pagination:

- `limit`: integer from 1 to 100, default 25.
- `cursor`: opaque string from the previous response.

Response shape:

```json
{
  "items": [],
  "page": {
    "limit": 25,
    "next_cursor": null
  }
}
```

## Size Limits

Initial limits for the current fixed-template phase:

- JSON request body: 1 MB.
- Job name: 120 characters.
- Non-terminal jobs per user: 2.
- Non-terminal jobs globally: 20.
- Listed jobs per request: 100.
- Worker timeout: fixed backend configuration, initially 30 seconds.
- Artifact download size: 5 MiB.

## Idempotency

`POST /api/jobs` accepts `Idempotency-Key`. The key is scoped to the validated user and request route.

Rules:

- same user, same key, same request body: return the original job with `200 OK`;
- same user, same key, different body: return `409 Conflict`;
- different user, same key: independent idempotency record;
- keys are stored as hashes inside the file spool for this internal phase.

## GET /healthz

Internal liveness endpoint. It is unauthenticated, must be reachable only by loopback or a private internal network, and must not be exposed publicly. It does not check dependencies.

Response `200 OK`:

```json
{
  "status": "ok",
  "service": "cimasim-api",
  "version": "v1"
}
```

## GET /readyz

Internal readiness endpoint. It is unauthenticated, must be reachable only by loopback or a private internal network, and must not be exposed publicly. In the first backend implementation phase it checks only critical authentication configuration because metadata storage and queue services do not exist yet.

Response `200 OK`:

```json
{
  "status": "ready",
  "service": "cimasim-api",
  "dependencies": {
    "auth_configuration": "ok"
  }
}
```

Response `503 Service Unavailable`:

```json
{
  "status": "not_ready",
  "service": "cimasim-api",
  "dependencies": {
    "auth_configuration": "unavailable"
  }
}
```

## GET /api/health

Authenticated frontend health endpoint protected by Cloudflare Access. It returns limited UI-safe status and must not reveal topology, internal versions, host paths, queue backend, database type, network names, or sensitive configuration.

Response `200 OK`:

```json
{
  "status": "ok",
  "service": "cimasim",
  "features": {
    "identity": "available",
    "job_submission": "available"
  }
}
```

Response `503 Service Unavailable`:

```json
{
  "status": "degraded",
  "service": "cimasim",
  "features": {
    "job_submission": "temporarily_unavailable"
  }
}
```

Errors:

- `401 Unauthorized`.

## GET /api/me

Returns the authenticated user derived from the validated Cloudflare Access JWT and CimaSim's internal role mapping.

Response `200 OK`:

```json
{
  "user_id": "cf-sub:4f7f2c1b-8f3d-4db7-84f0-62d890000000",
  "email": "user@example.com",
  "name": "Example User",
  "roles": ["user"],
  "is_admin": false,
  "limits": {
    "active_jobs_per_user": 2,
    "storage_bytes": 1073741824
  }
}
```

The optional `groups` field may be returned only when a validated groups claim is configured.

Errors:

- `401 Unauthorized` for missing or invalid JWT.

## POST /api/jobs

Creates a job request after identity, schema, quota, idempotency, and global
capacity checks. The backend always selects Xyce and the fixed
`rc_lowpass_fixed_v1` template.

Headers:

- `Content-Type: application/json`.
- `Idempotency-Key`: recommended.

Request:

```json
{
  "name": "Mi prueba RC",
  "template_id": "rc_lowpass_fixed_v1"
}
```

`name` is normalized, limited to 120 characters, and must not contain control
characters. `template_id` must be exactly `rc_lowpass_fixed_v1`. Extra fields are
rejected, including `netlist`, `content`, `filename`, `parameters`, `sweep`,
`simulator`, `paths`, `environment`, and `command`.

Response `201 Created`:

```json
{
  "job_id": "job_0123456789abcdef0123456789abcdef",
  "name": "Mi prueba RC",
  "template_id": "rc_lowpass_fixed_v1",
  "simulator": "xyce",
  "status": "queued",
  "created_at": "2026-07-17T21:45:00Z",
  "updated_at": "2026-07-17T21:45:00Z",
  "summary": null
}
```

Errors:

- `401 Unauthorized`: invalid identity.
- `415 Unsupported Media Type`: content type is not `application/json`.
- `422 Unprocessable Entity`: invalid template, invalid name, or prohibited field.
- `429 Too Many Requests`: active user quota, queue limit, or global capacity exceeded.
- `503 Service Unavailable`: queue unavailable.

## GET /api/jobs

Lists up to 100 jobs owned by the authenticated user, ordered by `created_at`
descending. It does not expose jobs owned by other users.

Response `200 OK`:

```json
{
  "jobs": [
    {
      "job_id": "job_0123456789abcdef0123456789abcdef",
      "name": "Mi prueba RC",
      "template_id": "rc_lowpass_fixed_v1",
      "simulator": "xyce",
      "status": "queued",
      "created_at": "2026-07-17T21:45:00Z",
      "updated_at": "2026-07-17T21:45:00Z",
      "summary": null
    }
  ]
}
```

Errors:

- `401 Unauthorized`.
- `503 Service Unavailable` when the spool is unavailable.

## GET /api/jobs/{job_id}

Returns one job if the authenticated user owns it or has admin access.

Response `200 OK`:

```json
{
  "job_id": "job_0123456789abcdef0123456789abcdef",
  "name": "Mi prueba RC",
  "template_id": "rc_lowpass_fixed_v1",
  "simulator": "xyce",
  "status": "succeeded",
  "created_at": "2026-07-17T21:45:00Z",
  "updated_at": "2026-07-17T21:45:03Z",
  "summary": {
    "status": "succeeded",
    "simulator": "xyce",
    "template": "rc_lowpass_fixed_v1",
    "samples": 2013,
    "duration_seconds": 0.005,
    "artifacts": [
      {
        "filename": "waveform.csv",
        "content_type": "text/csv",
        "size_bytes": 54164
      }
    ]
  }
}
```

Errors:

- `401 Unauthorized`.
- `404 Not Found` for missing jobs or jobs not visible to the user.

## GET /api/jobs/{job_id}/artifacts

Lists artifacts for a visible job. The current phase exposes only
`waveform.csv` after a successful fixed-template run.

Response `200 OK`:

```json
{
  "artifacts": [
    {
      "filename": "waveform.csv",
      "content_type": "text/csv",
      "size_bytes": 54164
    }
  ]
}
```

Errors:

- `401 Unauthorized`.
- `404 Not Found` for missing jobs or jobs not visible to the user.

## GET /api/jobs/{job_id}/artifacts/waveform.csv

Downloads the single visible CSV artifact for a successful fixed-template job.

Response `200 OK`:

Headers:

```http
Content-Type: text/csv
Content-Disposition: attachment; filename="waveform.csv"
X-Content-Type-Options: nosniff
Cache-Control: no-store
```

Rules:

- return `404 Not Found` for nonexistent artifacts, nonexistent jobs, or resources not visible to the user;
- never reveal host paths in headers, errors, logs, or response bodies;
- enforce a 5 MiB artifact size limit;
- serve only `text/csv`;
- do not follow symlinks;
- return `404` for missing, oversized, non-regular, or non-owned artifacts.

Errors:

- `401 Unauthorized`.
- `404 Not Found`.
- `503 Service Unavailable`.

## Future API

Arbitrary netlists, parameters, sweeps, cancellation, deletion, logs, Redis,
PostgreSQL, multiworker execution, and frontend integration are future phases.
They are not part of the current backend contract.

Errors:

- `401 Unauthorized`.
- `404 Not Found`.
- `409 Conflict` when the job is not terminal.
