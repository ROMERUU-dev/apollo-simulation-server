# CimaSim API Contract v1

## Overview

Authenticated API routes are rooted at `/api` and return JSON unless an artifact download endpoint states otherwise. Internal service health routes are outside `/api`.

The backend must validate Cloudflare Access JWTs from `Cf-Access-Jwt-Assertion` and derive identity from validated claims. The frontend and API should be served from the same origin for v1. Mutable v1 endpoints accept only `application/json`.

Phase 1 does not execute arbitrary netlists. `POST /api/jobs` accepts job creation requests for validation and lifecycle handling only.

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

Initial limits:

- JSON request body: 1 MB.
- Netlist text: 256 KB, calculated from UTF-8 bytes by the server.
- Job name: 120 characters.
- Job description: 1,000 characters.
- Sweep combinations: 100 simulations.
- Artifact list response: 100 items per page.
- Log response: 256 KB per request window.

## Idempotency

`POST /api/jobs` accepts `Idempotency-Key`. The key is scoped to the validated user and request route.

Rules:

- same user, same key, same request body: return the original job with `200 OK` or `201 Created`;
- same user, same key, different body: return `409 Conflict`;
- different user, same key: independent idempotency record;
- keys expire after 24 hours.

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
    "job_submission": "validation_only",
    "artifact_downloads": "available"
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

Creates a job request after validation, quota, and global capacity checks. Phase 1 queues validation-only jobs and must not run arbitrary simulator execution.

Headers:

- `Content-Type: application/json`.
- `Idempotency-Key`: recommended.

Request:

```json
{
  "name": "RC low-pass sweep",
  "description": "Validation-only job for an RC circuit.",
  "simulator": "ngspice",
  "netlist": {
    "filename": "rc_lowpass.cir",
    "content": "* RC low-pass\n.end\n"
  },
  "sweep": {
    "parameters": [
      {
        "name": "R1",
        "values": ["1k", "2k", "5k"]
      }
    ]
  }
}
```

The backend calculates the actual netlist size from the UTF-8 bytes of `netlist.content` and applies the 256 KB limit to that calculated value. The backend must not trust client-provided counts, sizes, or checksums for validation or quota enforcement.

Response `201 Created`:

```json
{
  "job_id": "job_01JZ7X8Y2Q4SQ6Q9W4V4G6R2YE",
  "state": "queued",
  "created_at": "2026-07-17T21:45:00Z",
  "owner": {
    "user_id": "cf-sub:4f7f2c1b-8f3d-4db7-84f0-62d890000000"
  },
  "limits": {
    "timeout_seconds": 1800,
    "max_sweep_runs": 100
  }
}
```

Errors:

- `401 Unauthorized`: invalid identity.
- `413 Payload Too Large`: netlist or JSON body too large.
- `415 Unsupported Media Type`: content type is not `application/json`.
- `422 Unprocessable Entity`: unsupported simulator, unsafe filename, absolute path, symlink, traversal, or sweep too large.
- `429 Too Many Requests`: active user quota, queue limit, or global capacity exceeded.
- `503 Service Unavailable`: queue unavailable.

## GET /api/jobs

Lists jobs visible to the authenticated user.

Query parameters:

- `state`: optional job state filter.
- `limit`: optional page size.
- `cursor`: optional page cursor.

Response `200 OK`:

```json
{
  "items": [
    {
      "job_id": "job_01JZ7X8Y2Q4SQ6Q9W4V4G6R2YE",
      "name": "RC low-pass sweep",
      "state": "queued",
      "simulator": "ngspice",
      "created_at": "2026-07-17T21:45:00Z",
      "updated_at": "2026-07-17T21:45:00Z"
    }
  ],
  "page": {
    "limit": 25,
    "next_cursor": null
  }
}
```

Errors:

- `401 Unauthorized`.
- `400 Bad Request` for invalid `state`, `limit`, or `cursor`.

## GET /api/jobs/{job_id}

Returns one job if the authenticated user owns it or has admin access.

Response `200 OK`:

```json
{
  "job_id": "job_01JZ7X8Y2Q4SQ6Q9W4V4G6R2YE",
  "name": "RC low-pass sweep",
  "state": "validating",
  "simulator": "ngspice",
  "created_at": "2026-07-17T21:45:00Z",
  "updated_at": "2026-07-17T21:45:03Z",
  "progress": {
    "phase": "input_validation",
    "completed_runs": 0,
    "total_runs": 3
  },
  "terminal": false
}
```

Errors:

- `401 Unauthorized`.
- `404 Not Found` for missing jobs or jobs not visible to the user.

## GET /api/jobs/{job_id}/log

Returns a bounded log window for a visible job. Logs must be sanitized and must not include tokens, cookies, complete netlists, or private paths.

Query parameters:

- `cursor`: optional opaque cursor.
- `limit_bytes`: optional integer up to 262144.

Response `200 OK`:

```json
{
  "job_id": "job_01JZ7X8Y2Q4SQ6Q9W4V4G6R2YE",
  "entries": [
    {
      "timestamp": "2026-07-17T21:45:03Z",
      "level": "info",
      "message": "Job input validation started."
    }
  ],
  "page": {
    "next_cursor": null
  }
}
```

Errors:

- `401 Unauthorized`.
- `404 Not Found` for missing jobs or jobs not visible to the user.
- `400 Bad Request` for invalid cursor or size.

## GET /api/jobs/{job_id}/artifacts

Lists artifacts for a terminal or partially completed visible job.

Query parameters:

- `limit`: optional page size.
- `cursor`: optional page cursor.

Response `200 OK`:

```json
{
  "items": [
    {
      "artifact_id": "art_01JZ7XAZK0DP5NS3HR4XTB4Z6P",
      "filename": "validation-report.json",
      "content_type": "application/json",
      "size_bytes": 2048,
      "created_at": "2026-07-17T21:45:05Z",
      "download_url": "/api/jobs/job_01JZ7X8Y2Q4SQ6Q9W4V4G6R2YE/artifacts/art_01JZ7XAZK0DP5NS3HR4XTB4Z6P"
    }
  ],
  "page": {
    "limit": 25,
    "next_cursor": null
  }
}
```

Errors:

- `401 Unauthorized`.
- `404 Not Found` for missing jobs or jobs not visible to the user.

## GET /api/jobs/{job_id}/artifacts/{artifact_id}

Downloads one artifact visible to the authenticated user. Authorization is limited to the job owner or a CimaSim administrator resolved through internal role configuration.

Response `200 OK`:

Headers:

```http
Content-Type: application/json
Content-Disposition: attachment; filename="validation-report.json"
X-Content-Type-Options: nosniff
Content-Length: 2048
```

Rules:

- return `404 Not Found` for nonexistent artifacts, nonexistent jobs, or resources not visible to the user;
- never reveal host paths in headers, errors, logs, or response bodies;
- sanitize `filename` for `Content-Disposition`;
- enforce the configured single artifact size limit, initially 100 MB;
- allow only explicit downloadable content types in the first version;
- do not serve HTML, SVG, or JavaScript inline in the first version;
- rate limit repeated downloads.

Initial downloadable content type allowlist:

- `application/json`
- `text/plain`
- `text/csv`
- `application/octet-stream`
- `application/gzip`
- `application/zip`

Range semantics:

- v1 supports at most one byte range for artifacts with a known immutable size;
- multiple ranges are rejected;
- invalid or unsatisfiable ranges return `416 Range Not Satisfiable`;
- range responses include `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Accept-Ranges: bytes`, and a valid `Content-Range`;
- range requests count toward download rate limits.

Errors:

- `401 Unauthorized`.
- `404 Not Found`.
- `416 Range Not Satisfiable`.
- `429 Too Many Requests`.

## POST /api/jobs/{job_id}/cancel

Requests cancellation for a non-terminal visible job. The operation is idempotent. The API records `cancel_requested_at` and returns `202 Accepted`; it does not immediately change the visible state to `cancelled`. The worker confirms `cancelled` only after stopping work and attempting controlled cleanup.

Headers:

- `Content-Type: application/json`.

Request:

```json
{}
```

Response `202 Accepted`:

```json
{
  "job_id": "job_01JZ7X8Y2Q4SQ6Q9W4V4G6R2YE",
  "state": "running",
  "cancel_requested_at": "2026-07-17T21:50:00Z",
  "cancellation": {
    "status": "requested"
  }
}
```

Repeated response `202 Accepted`:

```json
{
  "job_id": "job_01JZ7X8Y2Q4SQ6Q9W4V4G6R2YE",
  "state": "running",
  "cancel_requested_at": "2026-07-17T21:50:00Z",
  "cancellation": {
    "status": "already_requested"
  }
}
```

Errors:

- `401 Unauthorized`.
- `404 Not Found`.
- `409 Conflict` when the job is already terminal.
- `415 Unsupported Media Type` when the request is not `application/json`.

## DELETE /api/jobs/{job_id}

Deletes retained data for a terminal visible job. It is not used for cancellation.

Response `204 No Content` when deletion completes.

Errors:

- `401 Unauthorized`.
- `404 Not Found`.
- `409 Conflict` when the job is not terminal.
