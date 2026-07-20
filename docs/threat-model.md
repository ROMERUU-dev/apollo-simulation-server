# CimaSim Backend Threat Model Phase 1

## Scope and Assets

This threat model covers the planned CimaSim backend API, queue, workers, job storage, logs, artifacts, and host interaction. Apollo PACS/DICOM is an adjacent critical system on the same HP Z8 and is treated as an external asset that CimaSim must not affect.

Primary assets:

- Cloudflare Access identity assertions;
- CimaSim user and job metadata;
- bounded numeric RC parameters and internally generated netlists;
- generated logs and artifacts;
- worker host CPU, RAM, disk, and process table;
- Xyce and ngspice executables on the host;
- Apollo availability, networks, volumes, databases, and credentials.

## Threats and Mitigations

| Threat | Impact | Mitigations |
|---|---|---|
| Authenticated malicious users | Abuse of legitimate access to consume resources, access other users' jobs, or probe backend behavior. | Validate Cloudflare Access JWTs server-side, enforce per-user authorization on every resource, rate limit, audit actions, and apply per-user quotas. |
| Manipulated netlists | Attempted simulator escape, parser abuse, unexpected includes, or hidden references to host files. | Never accept user netlist text. Select one of two exact packaged templates and generate the configurable netlist only from independently validated numbers. |
| Numeric parameter abuse | Non-finite, ambiguous, extreme, or physically useless values consume resources or alter generated syntax. | Require JSON numbers, bounded representation and ranges, validate `tau` and duration/tau in backend and worker, and format with a strict scientific-notation function. |
| Excessive CPU consumption | Worker starvation and impact to Apollo or host services. | Validation phase is capped at 1 worker and 2 total CimaSim threads. Pilot real simulation is capped at 2 workers and 8 to 16 total threads only after load testing and Apollo verification. |
| Excessive RAM consumption | Host memory pressure affecting Apollo or system stability. | Validation phase is capped at 2 GB total worker RAM. Pilot real simulation is capped at 8 GB per worker and 16 GB total. Monitor RSS and terminate jobs exceeding limits. |
| Excessive disk consumption | Filling host disk, breaking CimaSim, Apollo, or OS services. | Enforce 1 GB per user, per-job artifact limits, maximum output file size, 30-day retention, disk watermarks, and cleanup jobs. |
| Hung processes | Worker slots remain occupied indefinitely. | Enforce 30-minute wall clock timeout, process group termination, heartbeat leases, and terminal `timed_out` state. |
| Host file reads | Netlists or artifacts attempt to read `/etc`, home directories, Apollo data, or secrets. | Use per-job directories, reject absolute paths and traversal, run workers as dedicated UID/GID, restrict filesystem permissions, and later consider sandboxing with read-only allowlists. |
| Command execution | User input becomes a shell command or simulator flag escape. | Never accept commands from users. Use fixed executable allowlists. Run `subprocess` with a list of arguments and `shell=False`. Do not interpolate user text into shell strings. |
| Path traversal | Access to files outside job or artifact roots through `../` paths. | Normalize paths, resolve within approved roots, reject paths escaping the root, and test path handling. |
| Symlink attacks | Symlinks point artifacts or includes to host or Apollo files. | Reject symlinks during upload, validation, artifact collection, and cleanup. Use `lstat`, resolve paths, and require regular files. |
| Giant output files | Disk exhaustion or slow downloads. | Set maximum result file size, maximum total artifact bytes per job, streaming size checks, and terminate jobs that exceed output limits. |
| Concurrency abuse | Too many queued or active jobs for one user. | Limit to 2 active jobs per user, cap queued jobs per user, rate limit `POST /api/jobs`, and enforce global worker concurrency. |
| User data leakage | One user reads another user's jobs, logs, or artifacts. | Store owner identity on every job, filter all list/detail/log/artifact endpoints by validated identity, and audit denied access. |
| Secret exposure | Tokens appear in logs, artifacts, errors, or checked-in config. | Never log tokens, redact sensitive headers, keep secrets in deployment-only storage, and avoid writing raw `Cf-Access-Jwt-Assertion` values. |
| Cloudflare header spoofing | Caller forges identity headers behind a misconfigured tunnel. | Validate `Cf-Access-Jwt-Assertion` signature, issuer, configured audience, expiration, and not-before when present. Derive `user_id` from `sub`; do not trust identity headers unless the JWT is valid. |
| Wrong Access audience | A staging token is accepted in production, or a token for another app is accepted. | Configure the exact Application Audience AUD per deployment as secret/configuration. Staging and production AUD values must be explicit and not hard-coded in source. |
| Admin role spoofing | User supplies a header or claim implying administrator access. | Resolve roles and `is_admin` from CimaSim configuration or internal storage after JWT validation. Do not trust arbitrary claims or headers for admin access. |
| Apollo impact | CimaSim consumes resources, joins Apollo networks, reads PACS data, or interferes with containers. | No shared networks, volumes, databases, credentials, Docker socket, or privileged containers. Set CimaSim resource limits and monitor Apollo-independent health. |
| Docker socket abuse | Backend controls host Docker and Apollo containers. | Do not mount `/var/run/docker.sock`. Do not grant Docker group access to CimaSim service users. |
| Privilege escalation | Worker escapes or modifies host files. | Do not run as root, do not use privileged mode, drop capabilities, apply no-new-privileges, dedicated UID/GID, and restrictive file ownership. |
| Artifact download abuse | Large or repeated downloads degrade service or execute active content in the browser. | Paginate artifact lists, require owner/admin authorization, return `404` for invisible artifacts, set `Content-Disposition: attachment`, set `X-Content-Type-Options: nosniff`, rate limit downloads, restrict Range semantics, and block inline HTML, SVG, and JavaScript in the first version. |
| Public health endpoint leakage | Health responses reveal dependency topology, queue implementation, versions, or internal routes. | Keep `/healthz` and `/readyz` internal only. Protect `/api/health` with Cloudflare Access and return only limited frontend-safe status. |
| CORS or proxy header abuse | Browser or proxy headers are used to bypass same-origin or identity assumptions. | Prefer same-origin frontend and API. Do not use wildcard CORS. Validate `Origin` for mutable requests when applicable. Trust `X-Forwarded-*` only from the controlled proxy path. |
| Audit log tampering | Malicious actions cannot be reconstructed. | Write append-oriented audit events with request id, user id, job id, action, result, and timestamp. Exclude tokens and sensitive payloads. |

## Security Requirements

- Do not mount `/var/run/docker.sock`.
- Do not use `privileged`.
- Do not use host networking.
- Do not share networks or volumes with Apollo.
- Do not run worker processes as root.
- Do not permit user-provided shell commands.
- Do not interpolate user text into shell commands.
- Use subprocess argument lists with `shell=False` when execution is later introduced.
- Use a separate temporary directory per job.
- Use dedicated UID/GID values for workers.
- Enforce CPU, memory, time, process, and file limits.
- Reject user netlists, models, includes, paths, expressions, and textual units.
- Validate bounded RC numbers independently in the frontend, backend, and worker.
- Block symbolic links.
- Delete temporary jobs through controlled cleanup.
- Verify `Cf-Access-Jwt-Assertion` in the backend.
- Validate JWT signature, issuer, configured audience, expiration, and not-before when present.
- Configure staging and production Cloudflare Access AUD values explicitly through deployment configuration or secret storage.
- Do not trust identity headers without a valid JWT.
- Resolve CimaSim roles internally instead of trusting arbitrary headers or claims.
- Keep `/healthz` and `/readyz` internal; protect `/api/health`.
- Do not use wildcard CORS.
- Accept only `application/json` on mutable v1 API endpoints.
- Return `404` for resources that do not exist or are not visible to the user.
- Record audit events without storing tokens, cookies, full netlists, or private host paths.

## Open Security Questions

- What are the exact Cloudflare Access Application Audience AUD values for staging and production deployment configuration?
- Which exact Xyce and ngspice CLI flags are safe for the first execution phase?
- Should workers run in containers, systemd scopes, or another sandbox mechanism?
- What global host-level resource reservation is required to protect Apollo during heavy CimaSim use?
- What artifact file types should be downloadable in the first execution release?
