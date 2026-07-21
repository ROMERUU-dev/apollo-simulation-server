# CimaSim Job Lifecycle

This phase implements a file spool for two authorized templates:
`rc_lowpass_fixed_v1` and `rc_lowpass_param_v1`. The parameterized template
accepts only resistance, capacitance, input voltage, and duration as bounded SI
JSON numbers. It does not accept user netlists, model files, includes, commands,
paths, expressions, textual units, sweeps, cancellation, deletion, Redis,
PostgreSQL, or parallel workers.

The preview Nginx configuration exposes only the exact authenticated job and
waveform routes. The frontend calls them same-origin through Cloudflare Access.

## Spool Layout

```text
/spool/
├── queued/
├── claimed/
├── jobs/
│   └── <job_id>/
│       ├── request.json
│       ├── status.json
│       ├── summary.json
│       └── artifacts/
│           └── waveform.csv
└── failed/
```

`job_id` is generated only by the backend. Clients cannot supply it. JSON files
are written with a temporary file, fsync, and atomic replace. The backend and
worker reject symlinks, non-regular files, corrupt JSON, unsupported fields, and
paths supplied inside JSON.

## States

- `queued`: accepted by the backend and represented by a marker in `queued/`.
- `running`: claimed by the worker via atomic rename into `claimed/`.
- `succeeded`: Xyce completed and `waveform.csv` plus `summary.json` validated.
- `failed`: validation, execution, artifact collection, or recovery failed.
- `timed_out`: Xyce exceeded the fixed timeout and the process group was stopped.

Terminal states are immutable: `succeeded`, `failed`, and `timed_out`.

## Valid Transitions

| From | To | Trigger |
|---|---|---|
| none | `queued` | Backend accepts an authorized-template request. |
| `queued` | `running` | Worker atomically claims the marker. |
| `running` | `succeeded` | Xyce output validates successfully. |
| `running` | `failed` | Xyce exits non-zero, output validation fails, or artifact collection fails. |
| `running` | `timed_out` | Xyce exceeds the fixed timeout. |

There is no retry in this phase. A failed or timed-out job remains terminal.

## Recovery

On startup the worker inspects `claimed/`. Abandoned jobs are not silently
returned to `queued` and are not executed a second time. The worker marks them
`failed` with reason `worker_restarted` and preserves existing terminal results.

## Artifact Rules

Only `waveform.csv` may be exposed. It must be a regular file, not a symlink, no
larger than 5 MiB, and owned through the job's validated `user_id`. API responses
use `Cache-Control: no-store` and never expose internal paths, hostnames, stdout,
environment variables, or netlist content.

## Current deployment boundary

Backend UID `10001` and worker UID `10002` share only the named CimaSim spool
through supplemental GID `10003`. The single worker has no network or ports.
Cancellation, retention automation, Redis/PostgreSQL, arbitrary inputs, and
multiworker scheduling remain future work.

## Custom review lifecycle

`custom_xyce_netlist_v1` uses a separate spool and dispatcher. Its state names
and terminal immutability match the legacy lifecycle, but it produces
`results.csv` and never runs in the RC worker. The dispatcher atomically claims
one job, writes `running`, launches one fixed rootless runner, validates the
result, and writes `succeeded`, `failed`, or `timed_out`.

The custom feature remains administratively disabled. Legacy requests and
summaries continue to validate and are never moved into the custom spool. See
`custom-runner-architecture.md` and `legacy-rc-migration.md`.
