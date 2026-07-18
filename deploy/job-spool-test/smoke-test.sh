#!/usr/bin/env bash
set -euo pipefail

PROJECT=cimasim_job_spool_test
COMPOSE_FILE=deploy/job-spool-test/docker-compose.yml

if [[ -z "${CIMASIM_XYCE_PREFIX:-}" || ! -d "${CIMASIM_XYCE_PREFIX}" ]]; then
  echo "CIMASIM_XYCE_PREFIX must point to the local Xyce prefix" >&2
  exit 2
fi

compose() {
  docker compose -p "${PROJECT}" -f "${COMPOSE_FILE}" "$@"
}

cleanup() {
  compose down --remove-orphans >/dev/null
}
trap cleanup EXIT

compose build backend-test worker-test
compose run --rm spool-init >/dev/null

verify_identity() {
  local service="$1"
  local expected_uid="$2"
  local unexpected_uid="$3"
  local actual_uid
  local groups
  actual_uid="$(compose run --rm --no-deps --entrypoint id "${service}" -u)"
  groups="$(compose run --rm --no-deps --entrypoint id "${service}" -G)"
  if [[ "${actual_uid}" != "${expected_uid}" || "${actual_uid}" == "${unexpected_uid}" ]]; then
    echo "${service} has unexpected UID ${actual_uid}" >&2
    exit 1
  fi
  if [[ " ${groups} " != *" 10003 "* ]]; then
    echo "${service} is missing shared spool group 10003: ${groups}" >&2
    exit 1
  fi
}

verify_identity backend-test 10001 10002
verify_identity worker-test 10002 10001

create_job() {
  local name="$1"
  compose run --rm --no-deps --entrypoint python backend-test - "$name" <<'PY'
import sys
from cimasim_api.config import Settings
from cimasim_api.jobs.models import JobCreateRequest
from cimasim_api.jobs.service import JobService
from cimasim_api.models import Identity

settings = Settings()
identity = Identity(user_id="smoke-user", email="smoke@example.test")
job, status_code = JobService(settings).create_job(
    identity,
    JobCreateRequest(name=sys.argv[1], template_id="rc_lowpass_fixed_v1"),
    None,
)
if status_code != 201:
    raise SystemExit(f"unexpected status {status_code}")
print(job.job_id)
PY
}

inspect_job() {
  local job_id="$1"
  compose run --rm --no-deps --entrypoint python backend-test - "$job_id" <<'PY'
import csv
import json
import math
import sys
from pathlib import Path

job_id = sys.argv[1]
job_dir = Path("/spool/jobs") / job_id
status = json.loads((job_dir / "status.json").read_text(encoding="utf-8"))
summary = json.loads((job_dir / "summary.json").read_text(encoding="utf-8"))
waveform = job_dir / "artifacts" / "waveform.csv"
rows = list(csv.DictReader(waveform.open(encoding="utf-8")))
if status["status"] != "succeeded" or summary["status"] != "succeeded":
    raise SystemExit("job did not succeed")
if summary["samples"] != len(rows) or len(rows) < 2000:
    raise SystemExit("unexpected sample count")
if set(rows[0]) != {"time_seconds", "input_volts", "output_volts"}:
    raise SystemExit("unexpected columns")
last = float(rows[-1]["output_volts"])
if not math.isfinite(last) or last < 0.95:
    raise SystemExit("unexpected RC output")
print(json.dumps({"job_id": job_id, "samples": len(rows), "last_output_volts": round(last, 9)}, sort_keys=True))
PY
}

verify_permissions() {
  compose run --rm --no-deps --entrypoint python backend-test - "$@" <<'PY'
import os
import stat
import sys
from pathlib import Path

root = Path("/spool")
for path in [root, root / "queued", root / "claimed", root / "jobs", root / "failed"]:
    st = path.stat(follow_symlinks=False)
    if not stat.S_ISDIR(st.st_mode):
        raise SystemExit(f"not a directory: {path}")
    if st.st_gid != 10003:
        raise SystemExit(f"wrong gid for {path}: {st.st_gid}")
    if stat.S_IMODE(st.st_mode) != 0o2770:
        raise SystemExit(f"wrong mode for {path}: {oct(stat.S_IMODE(st.st_mode))}")

paths = [root / ".jobs.lock"]
for job_id in sys.argv[1:]:
    job_dir = root / "jobs" / job_id
    paths.extend(
        [
            job_dir,
            job_dir / "artifacts",
            job_dir / "request.json",
            job_dir / "status.json",
            job_dir / "summary.json",
            job_dir / "artifacts" / "waveform.csv",
        ]
    )

for path in paths:
    st = path.stat(follow_symlinks=False)
    mode = stat.S_IMODE(st.st_mode)
    if st.st_gid != 10003:
        raise SystemExit(f"wrong gid for {path}: {st.st_gid}")
    if mode & 0o007:
        raise SystemExit(f"other bits set on {path}: {oct(mode)}")
    if stat.S_ISDIR(st.st_mode):
        if mode != 0o2770:
            raise SystemExit(f"wrong dir mode for {path}: {oct(mode)}")
        continue
    if not stat.S_ISREG(st.st_mode):
        raise SystemExit(f"not regular file: {path}")
    if mode != 0o660:
        raise SystemExit(f"wrong file mode for {path}: {oct(mode)}")
    if path.name != ".jobs.lock" and st.st_uid == 0:
        raise SystemExit(f"persistent file owned by root: {path}")
print("permissions-ok")
PY
}

job_a="$(create_job "Smoke RC A")"
compose run --rm worker-test >/dev/null
summary_a="$(inspect_job "${job_a}")"

job_b="$(create_job "Smoke RC B")"
compose run --rm worker-test >/dev/null
summary_b="$(inspect_job "${job_b}")"
verify_permissions "${job_a}" "${job_b}" >/dev/null

if docker ps --format '{{.Names}}' | grep -q '^cimasim_job_spool_test'; then
  echo "test container remained running" >&2
  exit 1
fi

if pgrep -af '(^|/)Xyce( |$)|orted' >/dev/null; then
  echo "residual Xyce or MPI process found" >&2
  exit 1
fi

echo "${summary_a}"
echo "${summary_b}"
