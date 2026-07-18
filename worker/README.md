# CimaSim Xyce Worker Spike

This package is an internal, isolated spike. It is not connected to the API or
frontend, does not receive user data, and executes only the fixed RC low-pass
netlist bundled with the package.

The worker runs one Xyce process in a temporary working directory, validates the
numeric output, writes a small `summary.json` and normalized `waveform.csv` on
success, and removes temporary files after each run. Failed runs keep a terminal
`summary.json` with `status` set to `failed` or `timed_out` and do not write a
partial `waveform.csv`.

It is not the production worker. It does not implement queues, Redis, database
state, user submissions, parameter sweeps, parallel execution, model uploads, or
public endpoints.

Run local unit checks from this directory:

```bash
python -m pytest
ruff check .
mypy src
python -m build
```

The unit tests use fake executables and do not require Docker or Xyce.
