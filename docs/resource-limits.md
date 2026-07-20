# CimaSim Resource Limits Phase 1

## Initial Limits

| Resource | Initial limit | Enforcement point |
|---|---:|---|
| Active jobs per user | 2 | API quota check and worker lease accounting |
| Global queued jobs | 20 | API quota check before enqueue |
| Templates | 2 exact identifiers | API and worker validation |
| Numeric parameters | 4 exact SI values for `rc_lowpass_param_v1` | API and worker validation |
| Wall clock time per job | 30 seconds | Worker timeout and process group termination |
| Validation-phase workers | 1 concurrent worker | Worker pool configuration |
| Validation-phase CPU | 2 total CimaSim threads | Worker pool and host reservation |
| Validation-phase RAM | 2 GB total | cgroup, systemd, or container memory limit |
| Pilot simulation workers | 2 concurrent workers | Worker pool configuration |
| Pilot RAM per worker | 8 GB | cgroup, systemd, or container memory limit |
| Pilot total worker RAM | 16 GB | global worker budget |
| Pilot total CimaSim CPU threads | 8 to 16 | Worker pool configuration and host reservation |
| Storage per user | 1 GB | API quota check and artifact storage accounting |
| Global retained artifacts | 100 GB | artifact storage accounting and deployment config |
| Retention | 30 days | Scheduled cleanup task |
| User netlist/support files | 0 | Schema rejection |
| Result files per job | 1 (`waveform.csv`) | Worker artifact collection |
| Single result file size | 5 MiB | Worker and API validation |

These defaults are intentionally conservative because the HP Z8 also runs Apollo PACS/DICOM. CimaSim must reserve explicit CPU, RAM, and disk capacity for Apollo and the operating system. New jobs must be rejected when global CimaSim capacity is exhausted, even if the requesting user is still under their personal quota.

## Global Capacity Phases

Validation-only phase:

- 1 concurrent worker;
- 2 total CimaSim CPU threads;
- 2 GB total CimaSim worker RAM;
- maximum 20 jobs globally in queue.

Pilot real-simulation phase:

- maximum 2 concurrent workers;
- maximum 8 GB RAM per worker;
- maximum 16 GB total worker RAM;
- global CPU budget of 8 to 16 threads;
- no increase without load testing and explicit Apollo health verification.

The validation-only limits are the active Phase 1 default. Pilot limits are ceilings for a later controlled rollout, not permission to enable arbitrary simulation execution.

## CPU

CimaSim should use a fixed worker concurrency configuration. The validation phase is limited to 2 total CimaSim CPU threads. The later pilot phase may use 8 to 16 total threads only after load testing and Apollo verification. Workers should not auto-detect and consume all host cores.

Recommended controls:

- worker pool concurrency cap;
- per-job thread cap passed as fixed internal simulator arguments when execution is later enabled;
- cgroup or systemd CPU quota;
- API rejection when global active worker capacity is exhausted.

## Memory

Validation-phase workers have a 2 GB total RAM budget. Pilot simulation workers may use up to 8 GB each with a 16 GB global worker budget. Memory enforcement should happen outside application code where possible, with application monitoring as a secondary signal.

Recommended controls:

- cgroup, systemd, or container memory limit;
- worker-side RSS monitoring;
- terminal `failed` state for memory limit violations;
- audit event with resource-limit reason.

## Time

Each job has a maximum wall clock time of 30 seconds. The worker terminates the entire process group on timeout and then marks the job `timed_out`.

Recommended controls:

- monotonic clock deadline;
- graceful termination;
- forced kill after a short grace period;
- cleanup of temporary directories after process exit.

## Process and File Limits

Workers should enforce limits for:

- child process count;
- open file count;
- output file count;
- maximum single output file size;
- maximum total output bytes.

Later execution must use fixed executable paths and argument lists with `shell=False`.

## Storage and Retention

Each user receives 1 GB of retained storage. Artifacts should be removed after 30 days unless a future policy grants explicit extension.

The artifact store should also enforce:

- warning watermark, initially 70 percent of the configured CimaSim artifact capacity;
- rejection watermark, initially 85 percent of configured CimaSim artifact capacity;
- global retained artifact limit, initially 100 GB or lower if host capacity review requires it;
- rejection of new jobs when per-user or global storage capacity is exhausted.

Cleanup rules:

- terminal jobs older than 30 days are eligible for artifact deletion;
- temporary directories are cleaned after terminal state;
- failed cleanup is retried by a maintenance task;
- cleanup never follows symlinks;
- cleanup only removes paths under approved CimaSim roots.

## Input Validation Limits

The fixed template accepts no parameters. The configurable template accepts
only four finite JSON numbers: resistance 1 to 10,000,000 ohm, capacitance
1e-12 to 1e-2 farad, input voltage 0.001 to 10 volt, and duration 1e-6 to 1
second. The duration must remain between 0.01 and 1000 time constants. The
backend and worker both enforce these bounds. Netlists, support files, models,
includes, paths, expressions, and textual units are rejected.

## Apollo Protection

Resource enforcement must protect Apollo:

- no shared Docker networks or volumes;
- no host networking;
- no privileged containers;
- no Docker socket mount;
- no Apollo credentials or databases;
- no worker access to Apollo storage paths;
- no CimaSim cleanup routine outside CimaSim-owned roots;
- conservative CPU and memory ceilings.

Any future increase to CimaSim limits should include a host capacity review and Apollo health validation.

## Custom netlist review limits

| Resource | Custom limit |
|---|---:|
| Active custom jobs per user | 1 |
| Custom submissions per user | 10 per hour |
| Global custom executions | 1 |
| Wall time | 60 seconds |
| CPU | 1 |
| RAM | 1 GiB |
| PIDs | 64 |
| Netlist | 64 KiB, 2,000 lines |
| Result | 10 MiB, 100,000 rows, 128 columns |
| Retention policy | 30 days |

The 30-day value is policy for a later reviewed maintenance task; this PR does
not add a deletion process. Custom capacity is lower priority than critical host
services and cannot be increased without measurement and Apollo verification.
