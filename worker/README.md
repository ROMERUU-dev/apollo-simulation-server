# CimaSim Xyce Worker Spike

This package is an internal, isolated spike. It is not connected to the API or
frontend, does not receive user data, and executes only the fixed RC low-pass
netlist bundled with the package.

The worker runs one Xyce process in a temporary working directory, validates the
numeric output, writes a small `summary.json` and normalized `waveform.csv` on
success, and removes temporary files after each run. Failed runs keep a terminal
`summary.json` with `status` set to `failed` or `timed_out` and do not write a
partial `waveform.csv`.

This branch also includes an internal file-spool daemon. The daemon consumes
only backend-generated jobs for `rc_lowpass_fixed_v1`, claims one job at a time
with an atomic rename, marks abandoned claims as failed on startup, and writes
only `summary.json` and `waveform.csv`. It still does not implement Redis,
database state, user submissions, parameter sweeps, parallel execution, model
uploads, cancellation, or public endpoints.

Run local unit checks from this directory:

```bash
python -m pytest
ruff check .
mypy src
python -m build
```

The unit tests use fake executables and do not require Docker or Xyce.

Run the isolated real-Xyce spool smoke test from the repository root:

```bash
export CIMASIM_XYCE_PREFIX=/path/to/xyce-prefix
deploy/job-spool-test/smoke-test.sh
```
