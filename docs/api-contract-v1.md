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
  "groups": ["cimasim-users"],
  "roles": ["user"],
  "is_admin": false
}
```

Identity rules:

- `user_id` is derived from the stable `sub` claim after JWT validation.
- `email` is derived only from a validated JWT claim.
- `groups` is optional and exists only when Cloudflare Access is explicitly configured to emit a groups claim.
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
- `403 Forbidden`: authenticated user lacks access to the resource.
- `404 Not Found`: resource does not exist or is not visible to the user.
- `409 Conflict`: invalid lifecycle transition or idempotency conflict.
- `413 Payload Too Large`: request exceeds size limit.
- `422 Unprocessable Entity`: schema-valid request rejected by domain validation.
- `429 Too Many Requests`: rate or quota exceeded.
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
- Netlist text: 256 KB.
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

Internal readiness endpoint. It is unauthenticated, must be reachable only by loopback or a private internal network, and must not be exposed publicly. It checks critical dependencies.

Response `200 OK`:

```json
{
  "status": "ready",
  "service": "cimasim-api",
  "dependencies": {
    "metadata_store": "ok",
    "queue": "ok"
  }
}
```

Response `503 Service Unavailable`:

```json
{
  "status": "not_ready",
  "service": "cimasim-api",
  "dependencies": {
    "metadata_store": "ok",
    "queue": "unavailable"
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

Returns the authenticated user derived from the validated Cloudflare Access JWT.

Response `200 OK`:

```json
{
  "user_id": "cf-sub:4f7f2c1b-8f3d-4db7-84f0-62d890000000",
  "email": "user@example.com",
  "name": "Example User",
  "groups": ["cimasim-users"],
  "roles": ["user"],
  "is_admin": false,
  "limits": {
    "active_jobs_per_user": 2,
    "storage_bytes": 1073741824
  }
}
```

Errors:

- `401 Unauthorized` for missing or invalid JWT.

## POST /api/jobs

Creates a job request after validation and quota checks. Phase 1 queues validation-only jobs and must not run arbitrary simulator execution.

Headers:

- `Idempotency-Key`: recommended.

Request:

```json
{
  "name": "RC low-pass sweep",
  "description": "Validation-only job for an RC circuit.",
  "simulator": "ngspice",
  "netlist": {
    "filename": "rc_lowpass.cir",
    "content": "* RC low-pass\n.end\n",
    "client_reported_size_bytes": 19
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

`client_reported_size_bytes` is optional and informational only. The backend must calculate the actual netlist size from the UTF-8 bytes of `netlist.content` and apply the 256 KB limit to that calculated value. The backend must not trust client-provided counts, sizes, or checksums for validation or quota enforcement.

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
- `422 Unprocessable Entity`: unsupported simulator, unsafe filename, absolute path, symlink, traversal, or sweep too large.
- `429 Too Many Requests`: active job or queue quota exceeded.
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

Returns a bounded log window for a visible job. Logs must be sanitized and must not include tokens.

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

- single byte ranges may be supported for artifacts that have a known immutable size;
- multiple ranges are not supported in v1;
- invalid or unsatisfiable ranges return `416 Range Not Satisfiable`;
- Range responses must still include `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`;
- Range requests count toward download rate limits.

Errors:

- `401 Unauthorized`.
- `404 Not Found`.
- `416 Range Not Satisfiable`.
- `429 Too Many Requests`.

## POST /api/jobs/{job_id}/cancel

Requests cancellation for a non-terminal visible job. The operation is idempotent. The API records `cancel_requested_at` and returns `202 Accepted`; it does not immediately change the visible state to `cancelled`. The worker confirms `cancelled` only after stopping work and attempting controlled cleanup.

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

## DELETE /api/jobs/{job_id}

Deletes retained data for a terminal visible job. It is not used for cancellation.

Response `204 No Content` when deletion completes.

Errors:

- `401 Unauthorized`.
- `404 Not Found`.
- `409 Conflict` when the job is not terminal.
