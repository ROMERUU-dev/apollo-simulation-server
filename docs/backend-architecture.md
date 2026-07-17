# CimaSim Backend Architecture Phase 1

## Scope

This document defines the first safe backend architecture for CimaSim before enabling real simulation execution. Phase 1 must support authenticated API workflows, durable job metadata, validation gates, controlled artifact access, and operational visibility without executing arbitrary user-provided netlists.

The backend must remain isolated from the Apollo PACS/DICOM deployment. CimaSim must not share Docker networks, volumes, databases, credentials, service discovery, or runtime privileges with Apollo.

## Proposed Components

- FastAPI API service: handles authenticated HTTP requests under `/api`, validates Cloudflare Access JWTs, enforces request limits, and writes audit events.
- Job queue: stores requested jobs and state transitions. Redis or PostgreSQL-backed queuing is acceptable later, but Phase 1 should document the boundary before selecting the implementation.
- Worker service: consumes validated jobs, creates per-job work directories, applies resource limits, and runs only approved internal commands. Phase 1 workers may stop after validation and lifecycle simulation.
- Metadata store: keeps users, jobs, state transitions, limits, artifact metadata, and audit events. PostgreSQL is the preferred default for durability.
- Artifact store: stores user-visible result files by job and user. The initial deployment can use a dedicated local filesystem path owned by CimaSim, with a migration path to object storage.
- Log store: records structured job and API logs without tokens, raw Cloudflare Access assertions, or sensitive headers.
- Admin maintenance tasks: enforce retention, cleanup abandoned temporary directories, and expire old artifacts.

## FastAPI Boundary

FastAPI should expose authenticated application routes under `/api`. The frontend preview remains a static Nginx deployment and should call the backend through a separate internal backend port when the backend is introduced.

The API service must:

- validate `Cf-Access-Jwt-Assertion` using Cloudflare Access public keys;
- load the exact Cloudflare Access Application Audience AUD from deployment configuration or secret storage for each environment;
- derive `user_id` from the validated stable `sub` claim;
- derive `email` only from a validated JWT claim;
- treat `groups` as optional and available only when Cloudflare Access is explicitly configured to emit them;
- resolve roles and administrator status from CimaSim configuration or internal storage, not from arbitrary headers or untrusted claims;
- reject oversized payloads before parsing large inputs;
- accept only `application/json` for mutable API endpoints in the first version;
- validate `Origin` when browser-originating mutable requests are accepted;
- return stable JSON errors;
- enforce authorization on every job and artifact lookup;
- return `404` for resources owned by other users to avoid enumeration;
- never accept shell commands or simulator executable paths from users.

## Health Endpoints

CimaSim should expose three distinct health surfaces:

- `GET /healthz`: internal liveness only. It requires no authentication, must be reachable only from loopback or a private internal network, does not check dependencies, and returns only `status`, `service`, and `version`.
- `GET /readyz`: internal readiness only. It requires no public exposure, checks critical dependencies such as the metadata store and queue, and returns `503` when any critical dependency is unavailable.
- `GET /api/health`: authenticated frontend health. It is protected by Cloudflare Access, returns limited UI-safe status, and must not reveal topology, host paths, internal versions, dependency names, queue backends, or sensitive configuration.

`/healthz` and `/readyz` must not be exposed through Cloudflare public routes. They should be bound to loopback or an internal CimaSim-only network.

## HTTP Security Boundary

The frontend and API should be served from the same origin for the first backend release. If CORS is ever required, the API must not use `Access-Control-Allow-Origin: *`; it should allow only explicitly configured origins.

The API must not trust `X-Forwarded-*` headers unless the request came from the controlled reverse proxy or tunnel path. Logs must exclude tokens, cookies, complete netlists, private host paths, and sensitive headers.

## Queue and Worker Model

The API service should enqueue job requests after identity, quota, and input validation. Workers should be separate processes or containers with a dedicated UID/GID and no root privileges.

The worker contract should include:

- one isolated temporary directory per job;
- explicit state transitions from `queued` through terminal states;
- hard limits for CPU, memory, elapsed time, process count, output file count, and output byte count;
- subprocess execution with argument lists and `shell=False` when simulator execution is later enabled;
- no interpolation of user-provided text into shell commands;
- controlled cleanup after success, failure, timeout, or cancellation.

Phase 1 must not execute arbitrary netlists. Validation can parse metadata, estimate sweep size, and reject unsafe paths or unsupported files.

## Storage Layout

Recommended dedicated paths:

- `/var/lib/cimasim/api`: API metadata support files if needed.
- `/var/lib/cimasim/jobs`: durable per-job metadata snapshots if used outside the database.
- `/var/lib/cimasim/artifacts`: retained user artifacts.
- `/var/tmp/cimasim/jobs`: temporary per-job working directories.
- `/var/log/cimasim`: service and audit logs.

These paths must be owned by a dedicated CimaSim user and group, for example `cimasim-api` and `cimasim-worker`. They must not overlap with Apollo paths, Docker volumes, PACS storage, DICOM storage, database directories, or Cloudflare tunnel credentials.

## Request Flow

1. Browser reaches `sim.cimasim.online` through Cloudflare Access.
2. Cloudflare Access authenticates the user and forwards the request.
3. The frontend calls backend `/api` routes from the same origin.
4. FastAPI validates the Cloudflare Access JWT and maps claims to a CimaSim identity.
5. FastAPI checks payload size, schema, authorization, quotas, global capacity, and idempotency keys.
6. FastAPI writes job metadata and queues accepted jobs.
7. Worker claims a job, creates a per-job temporary directory, validates inputs, and records lifecycle events.
8. Worker stores permitted artifacts and logs.
9. FastAPI serves job status, logs, and artifacts only to the owning user or authorized administrators.

## Separation From Apollo

CimaSim must remain operationally separate from Apollo:

- no shared Docker Compose projects;
- no shared Docker networks;
- no shared Docker volumes;
- no shared databases;
- no shared credentials;
- no shared service accounts;
- no shared Unix users for workers;
- no access to Apollo DICOM storage, Orthanc storage, PACS databases, or Keycloak data;
- no dependency on Apollo container DNS names or ports.

Apollo must continue running independently if CimaSim is stopped, upgraded, or rolled back.

## Ports and Networks

Current preview:

- frontend preview binds `127.0.0.1:8088`;
- Cloudflare Tunnel publishes `sim.cimasim.online`;
- Apollo ports and networks are out of scope and must not be modified.

Future backend:

- FastAPI should bind only to loopback or a private CimaSim-only network.
- `/healthz` and `/readyz` should be reachable only on loopback or that private internal network.
- The backend must not use `host network`.
- Containers must not mount `/var/run/docker.sock`.
- Containers must not run with `privileged: true`.
- CimaSim networks must use names clearly separate from Apollo, for example `cimasim-backend-internal`.

## Deployment Strategy

Phase 1 should keep deployment reversible and low blast radius:

- introduce backend services behind loopback-only bindings;
- keep frontend preview unchanged until the API endpoint is ready;
- deploy CimaSim backend independently from Apollo;
- use dedicated environment files with no checked-in secrets;
- configure the exact Access AUD separately for staging and production;
- validate configuration with read-only commands before rollout;
- prefer blue/green or side-by-side service introduction where practical;
- roll back by stopping CimaSim backend services only.

No Phase 1 documentation change should rebuild images, restart containers, or change active Cloudflare, Apollo, firewall, Tailscale, SSH, Xyce, or ngspice configuration.

## Logging

Logs should be structured JSON where possible and include:

- request id;
- job id;
- validated user id;
- route and method;
- status code;
- state transition;
- validation decision;
- resource usage summary;
- cleanup result.

Logs must not include:

- Cloudflare Access JWTs;
- session cookies;
- API tokens;
- complete netlist content;
- Apollo credentials or identifiers;
- private host paths outside approved CimaSim directories.

## Observability

Initial observability should include:

- `/healthz` for internal liveness;
- `/readyz` for internal dependency readiness;
- `/api/health` for limited authenticated frontend status;
- queue depth;
- active jobs by state;
- worker availability;
- validation failures by reason;
- cancellations and timeouts;
- artifact storage usage;
- per-user quota usage;
- global capacity usage;
- worker CPU, memory, and disk usage;
- audit event count.

Metrics should identify CimaSim services distinctly and must not scrape or depend on Apollo internals.

## Failure Recovery

The backend should recover predictably from:

- API restart: in-flight HTTP requests can fail, but persisted jobs remain queryable.
- Worker restart: claimed jobs return to `queued`, `failed`, or `timed_out` after lease expiry based on last heartbeat.
- Queue outage: API returns `503` for job creation while read-only job queries continue if metadata storage is available.
- Metadata database outage: API returns `503` and workers stop claiming new jobs.
- Global capacity exhaustion: API rejects new jobs without affecting existing jobs or Apollo.
- Disk pressure: API rejects new jobs before the artifact or temporary paths are exhausted.
- Cleanup failure: jobs remain terminal, cleanup is retried by maintenance tasks, and audit logs record the failure.

Recovery routines must not inspect or modify Apollo resources.
