# CimaSim Fixed-Template Job Lifecycle

This phase implements an internal file spool for one authorized template:
`rc_lowpass_fixed_v1`. It does not accept user netlists, model files,
parameters, sweeps, cancellation, deletion, Redis, PostgreSQL, or parallel
workers.

The backend endpoints exist under `/api/jobs`, but they are not exposed through
the preview Nginx configuration yet and the frontend does not call them yet.

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
| none | `queued` | Backend accepts a fixed-template request. |
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

## Next Phase

Future work can add an authenticated public route, deployment wiring, queue
metrics, cancellation, retention, Redis/PostgreSQL, and multiworker scheduling.
Those features are deliberately absent here.
