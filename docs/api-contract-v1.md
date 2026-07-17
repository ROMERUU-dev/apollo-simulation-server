# CimaSim API Contract v1

## Overview

All API routes are rooted at `/api` and return JSON unless an artifact download endpoint later states otherwise. The backend must validate Cloudflare Access JWTs from `Cf-Access-Jwt-Assertion` and derive identity from validated claims.

Phase 1 does not execute arbitrary netlists. `POST /api/jobs` accepts job creation requests for validation and lifecycle handling only.

## Identity Schema

Validated identity is represented internally as:

```json
{
  "user_id": "cf:example-user-id",
  "email": "user@example.com",
  "name": "Example User",
  "groups": ["cimasim-users"],
  "is_admin": false
}
```

Required JWT validation:

- verify signature using Cloudflare Access public keys;
- verify issuer;
- verify audience;
- verify expiration;
- map stable subject to `user_id`;
- do not persist the raw JWT.

## Common Error Shape

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The request body is invalid.",
    "details": [
      {
        "field": "netlist.size_bytes",
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

## GET /api/health

Returns service health without requiring user identity if the route is used for internal liveness. A separate readiness mode may check dependencies.

Response `200 OK`:

```json
{
  "status": "ok",
  "service": "cimasim-api",
  "version": "v1",
  "dependencies": {
    "metadata_store": "ok",
    "queue": "ok"
  }
}
```

Response `503 Service Unavailable`:

```json
{
  "status": "degraded",
  "service": "cimasim-api",
  "dependencies": {
    "metadata_store": "ok",
    "queue": "unavailable"
  }
}
```

## GET /api/me

Returns the authenticated user derived from the validated Cloudflare Access JWT.

Response `200 OK`:

```json
{
  "user_id": "cf:example-user-id",
  "email": "user@example.com",
  "name": "Example User",
  "groups": ["cimasim-users"],
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
    "size_bytes": 19
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

Response `201 Created`:

```json
{
  "job_id": "job_01JZ7X8Y2Q4SQ6Q9W4V4G6R2YE",
  "state": "queued",
  "created_at": "2026-07-17T21:45:00Z",
  "owner": {
    "user_id": "cf:example-user-id"
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
- `403 Forbidden`.
- `404 Not Found`.

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
- `403 Forbidden`.
- `404 Not Found`.
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
- `403 Forbidden`.
- `404 Not Found`.

## DELETE /api/jobs/{job_id}

Cancels a non-terminal job or requests deletion of retained job data depending on state.

Response `202 Accepted` for cancellation:

```json
{
  "job_id": "job_01JZ7X8Y2Q4SQ6Q9W4V4G6R2YE",
  "state": "cancelled",
  "requested_at": "2026-07-17T21:50:00Z"
}
```

Response `204 No Content` for deletion of an already terminal retained job.

Errors:

- `401 Unauthorized`.
- `403 Forbidden`.
- `404 Not Found`.
- `409 Conflict` when cancellation is no longer possible.
