# CimaSim Resource Limits Phase 1

## Initial Limits

| Resource | Initial limit | Enforcement point |
|---|---:|---|
| Active jobs per user | 2 | API quota check and worker lease accounting |
| Sweep simulations per job | 100 | API validation and worker validation |
| Wall clock time per job | 30 minutes | Worker timeout and process group termination |
| RAM per worker | 8 GB | cgroup, systemd, or container memory limit |
| Total CimaSim CPU threads | 8 to 16 | Worker pool configuration and host reservation |
| Storage per user | 1 GB | API quota check and artifact storage accounting |
| Retention | 30 days | Scheduled cleanup task |
| Netlist size | 256 KB | API request validation |
| Uploaded support files per job | 20 files | API and worker validation |
| Single support file size | 10 MB | API upload validation |
| Total input bytes per job | 50 MB | API and worker validation |
| Result files per job | 100 files | Worker artifact collection |
| Single result file size | 100 MB | Worker output monitoring |
| Total result bytes per job | 500 MB | Worker output monitoring and artifact store |
| Log bytes returned per request | 256 KB | API pagination |

These defaults are intentionally conservative because the HP Z8 also runs Apollo PACS/DICOM. CimaSim should reserve enough host capacity so Apollo remains stable during CimaSim load.

## CPU

CimaSim should use a fixed worker concurrency configuration and a global CPU budget of 8 to 16 total threads. Workers should not auto-detect and consume all host cores.

Recommended controls:

- worker pool concurrency cap;
- per-job thread cap passed as fixed internal simulator arguments when execution is later enabled;
- cgroup or systemd CPU quota;
- API rejection when global active worker capacity is exhausted.

## Memory

Each worker should be limited to 8 GB RAM. Memory enforcement should happen outside application code where possible, with application monitoring as a secondary signal.

Recommended controls:

- cgroup, systemd, or container memory limit;
- worker-side RSS monitoring;
- terminal `failed` state for memory limit violations;
- audit event with resource-limit reason.

## Time

Each job has a maximum wall clock time of 30 minutes. The worker should terminate the entire process group on timeout and then mark the job `timed_out`.

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

Cleanup rules:

- terminal jobs older than 30 days are eligible for artifact deletion;
- temporary directories are cleaned after terminal state;
- failed cleanup is retried by a maintenance task;
- cleanup never follows symlinks;
- cleanup only removes paths under approved CimaSim roots.

## Input Validation Limits

Netlists and support files must be validated before queuing or execution:

- reject absolute paths;
- reject parent traversal;
- reject symlinks;
- reject unsupported extensions;
- require regular files;
- enforce filename length and character allowlist;
- reject hidden control files;
- reject files that resolve outside the job directory.

Suggested allowed extensions for initial validation:

- `.cir`
- `.sp`
- `.spi`
- `.net`
- `.lib`
- `.mod`
- `.model`
- `.inc`
- `.txt`

The allowlist should be revisited before real execution.

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
