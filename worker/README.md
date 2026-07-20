# CimaSim Xyce Worker

This package consumes CimaSim spool jobs one at a time and executes exactly two
packaged RC low-pass templates: `rc_lowpass_fixed_v1` and
`rc_lowpass_param_v1`.

The worker runs one Xyce process in a temporary working directory, validates the
numeric output, writes a small `summary.json` and normalized `waveform.csv` on
success, and removes temporary files after each run. Failed runs keep a terminal
`summary.json` with `status` set to `failed` or `timed_out` and do not write a
partial `waveform.csv`.

This branch also includes an internal file-spool daemon. The daemon consumes
only backend-generated jobs for either known template, claims one job at a time
with an atomic rename, marks abandoned claims as failed on startup, and writes
only `summary.json` and `waveform.csv`. It still does not implement Redis,
database state, user submissions, parameter sweeps, parallel execution, model
uploads, cancellation, or public endpoints.

For `rc_lowpass_param_v1`, the worker independently revalidates four bounded
finite SI numbers and the duration-to-time-constant ratio. It formats those
numbers in controlled locale-independent scientific notation and substitutes
only internal tokens in a packaged template. User netlist text, units, models,
includes, paths, expressions, commands, simulator arguments, and per-job
timeouts are never accepted. The configurable RC model is educational and is
not a guarantee of universal scientific accuracy.

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
