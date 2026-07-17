# CimaSim Job Lifecycle Phase 1

## States

- `queued`: job request has been accepted and is waiting for a worker.
- `validating`: worker is checking schema, limits, filenames, paths, sweep size, and safety rules.
- `running`: worker is executing approved work. Phase 1 should not enter this state for arbitrary netlist execution.
- `succeeded`: job completed successfully and permitted artifacts are available.
- `failed`: job stopped because validation or execution failed.
- `timed_out`: job exceeded wall clock or resource timeout.
- `cancelled`: user or administrator cancelled the job.

Terminal states:

- `succeeded`
- `failed`
- `timed_out`
- `cancelled`

## Valid Transitions

| From | To | Trigger |
|---|---|---|
| none | `queued` | API accepts a new job after identity, quota, and request validation. |
| `queued` | `validating` | Worker claims the job. |
| `queued` | `cancelled` | User or admin cancels before validation starts. |
| `validating` | `running` | Input validation passes and execution is permitted. |
| `validating` | `failed` | Validation rejects unsafe, unsupported, or malformed input. |
| `validating` | `cancelled` | Cancellation request is honored during validation. |
| `validating` | `timed_out` | Validation exceeds its allowed time. |
| `running` | `succeeded` | Worker completes all approved runs and stores artifacts. |
| `running` | `failed` | Worker detects execution failure, limit violation, or artifact collection failure. |
| `running` | `timed_out` | Job exceeds wall clock limit. |
| `running` | `cancelled` | Worker terminates the job after cancellation request. |

## Invalid Transitions

| From | Invalid To | Reason |
|---|---|---|
| `queued` | `succeeded` | A job cannot succeed without worker validation. |
| `queued` | `running` | Worker must validate before running. |
| `validating` | `queued` | Requeue should be represented by a lease retry event without rewinding visible state unless the worker never claimed the job durably. |
| `running` | `validating` | Validation cannot be repeated after execution starts. |
| `succeeded` | any non-terminal state | Terminal states are immutable except for retention metadata. |
| `failed` | any non-terminal state | Retry must create a new job. |
| `timed_out` | any non-terminal state | Retry must create a new job. |
| `cancelled` | any non-terminal state | Cancelled jobs cannot resume. |

## Cancellation Semantics

Cancellation is best effort until a terminal state is recorded.

- Cancelling `queued` jobs should be immediate.
- Cancelling `validating` jobs should stop validation before execution.
- Cancelling `running` jobs should terminate the process group and mark the job `cancelled` only after cleanup is attempted.
- Cancelling terminal jobs is invalid. A later delete operation may remove retained data according to retention policy.

## Timeout Semantics

The worker owns timeout enforcement and must record `timed_out` when:

- wall clock time exceeds 30 minutes;
- validation does not complete within its configured limit;
- process termination after timeout succeeds or requires forced cleanup.

Timeout cleanup failures should be logged as audit events without changing the terminal state away from `timed_out`.

## Retry Semantics

Retries should create a new job with a new `job_id` and a reference to the source job. Terminal job state should remain immutable.

Retry metadata should include:

- `retry_of_job_id`;
- user id;
- copied request parameters;
- new idempotency key if supplied.

## State Transition Audit

Each transition should record:

- previous state;
- next state;
- timestamp;
- actor type: `api`, `worker`, `system`, or `admin`;
- validated user id when applicable;
- reason code;
- request id or worker id.

Audit logs must not include JWTs, secrets, or raw user payloads.
