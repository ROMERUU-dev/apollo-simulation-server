# CimaSim API Contract v1

## Overview

Authenticated API routes are rooted at `/api` and return JSON unless an artifact download endpoint states otherwise. Internal service health routes are outside `/api`.

The backend must validate Cloudflare Access JWTs from `Cf-Access-Jwt-Assertion` and derive identity from validated claims. The frontend and API should be served from the same origin for v1. Mutable v1 endpoints accept only `application/json`.

The production jobs API continues to read the two historical RC templates.
Custom submission is a disabled review feature identified by
`custom_xyce_netlist_v1`. It accepts one bounded, normalized Xyce 7.10 netlist
only when `CIMASIM_CUSTOM_NETLISTS_ENABLED=true` after the rootless runner gate.
It never accepts support files, includes, external models, paths, plugins,
commands, environment variables, or user-selected output files.

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
        "field": "parameters.duration_seconds",
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

Initial limits for the bounded-template phase:

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

Internal readiness endpoint. It is unauthenticated, must be reachable only by
loopback or a private internal network, and must not be exposed publicly. It
checks critical authentication configuration and, when jobs are enabled, the
complete spool structure plus a cleaned-up atomic read/write probe.

Response `200 OK`:

```json
{
  "status": "ready",
  "service": "cimasim-api",
  "dependencies": {
    "auth_configuration": "ok",
    "job_spool": "ok"
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

When authentication configuration is valid but the enabled spool is
unavailable, `dependencies` contains `auth_configuration: ok` and
`job_spool: unavailable`; no filesystem path or volume name is returned.

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
    "identity": "available",
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

Creates a job request after identity, schema, physical-boundary, quota,
idempotency, and global capacity checks. The backend always selects Xyce.

When `CIMASIM_ALLOW_LEGACY_RC_SUBMISSION=false`, the two RC request shapes below
are historical read contracts only. New submissions receive `410 Gone` with
`LEGACY_TEMPLATE_DISABLED`; existing list, detail, waveform, and summary reads
remain unchanged.

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
characters. For `rc_lowpass_fixed_v1`, `parameters` must be absent, preserving
the original request and stored-job format.

The second accepted request shape is:

```json
{
  "name": "RC personalizada",
  "template_id": "rc_lowpass_param_v1",
  "parameters": {
    "resistance_ohms": 1000,
    "capacitance_farads": 0.000001,
    "input_voltage_volts": 1,
    "duration_seconds": 0.005
  }
}
```

`parameters` is required only for `rc_lowpass_param_v1`, has no extra fields,
and accepts JSON numbers only. Strings such as `"1k"`, `"1u"`, and `"5ms"`,
non-finite numbers, arrays, and nested values are rejected. Limits are inclusive:

| Parameter | Minimum | Maximum | Unit |
|---|---:|---:|---|
| `resistance_ohms` | 1 | 10,000,000 | ohm |
| `capacitance_farads` | 1e-12 | 1e-2 | farad |
| `input_voltage_volts` | 0.001 | 10 | volt |
| `duration_seconds` | 1e-6 | 1 | second |

With `tau = resistance_ohms * capacitance_farads`, the backend also requires
`0.01 <= duration_seconds / tau <= 1000`. Extra fields are rejected, including
`netlist`, `content`, `filename`, `sweep`, `simulator`, `paths`, `environment`,
`command`, `model`, and `include`.

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

Parameterized responses additionally include normalized, read-only
`parameters` and `derived.time_constant_seconds`. Those fields are optional so
historical fixed-job responses remain unchanged. Generated netlist text and
internal execution details are never returned.

Errors:

- `401 Unauthorized`: invalid identity.
- `415 Unsupported Media Type`: content type is not `application/json`.
- `422 Unprocessable Entity`: invalid template, invalid name, or prohibited field.
- `429 Too Many Requests`: active user quota, queue limit, or global capacity exceeded.
- `503 Service Unavailable`: queue unavailable.

### Custom Xyce request (disabled by default)

```json
{
  "name": "Custom transient",
  "template_id": "custom_xyce_netlist_v1",
  "netlist": "V1 in 0 1\nR1 in out 1k\n.TRAN 1u 1m\n.END\n",
  "requested_outputs": ["V(out)"]
}
```

The schema has no additional fields. The netlist is UTF-8, at most 64 KiB,
2,000 lines, and 512 characters per line. It permits exactly one `.TRAN`, `.DC`,
or `.AC` analysis and the bounded syntax in
`docs/custom-netlist-supported-syntax.md`. The backend normalizes one controlled
`.PRINT`; the isolated runner selects Xyce, timeout, paths, and output format.

`POST /api/jobs/preflight` accepts the same authenticated custom body and
returns only analysis, bounded topology counts, requested outputs, and whether
the administrative sandbox gate is ready. It does not run Xyce and does not
accept PromQL, commands, paths, or files.

Custom limits are one active job per user, ten submissions per user per hour,
one global execution, 60 seconds, 64 KiB input, and 10 MiB result output. A
disabled custom feature returns `503` with `CUSTOM_NETLISTS_DISABLED`.

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

Lists artifacts for a visible job. Legacy jobs expose `waveform.csv`; successful
custom jobs expose `results.csv`.

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

Downloads the single visible CSV artifact for a successful authorized-template job.

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

## GET /api/jobs/{job_id}/artifacts/results.csv

Downloads the generic CSV for a successful custom job. It uses the same
ownership, symlink, regular-file, `nosniff`, no-store, and safe disposition
controls as `waveform.csv`, with a 10 MiB limit. It contains at most 100,000 rows
and 128 unique numeric columns. TRAN, DC, and AC use explicit axis columns; AC
complex values use Xyce's separate `Re(...)` and `Im(...)` columns.

## Unsupported API

Arbitrary files, free-form runner commands, external models, includes, plugins,
user-selected paths, control blocks, cancellation, deletion, logs, Redis,
PostgreSQL, and multiworker execution are not part of this contract. Custom
netlists remain unavailable in production until the rootless isolation gate.

Errors:

- `401 Unauthorized`.
- `404 Not Found`.
- `409 Conflict` when the job is not terminal.
