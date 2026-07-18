#!/usr/bin/env bash
set -euo pipefail

PROJECT="cimasim_xyce_spike"
COMPOSE_FILE="deploy/worker/docker-compose.yml"
IMAGE_TAG="${CIMASIM_XYCE_IMAGE_TAG:-smoke}"
IMAGE="cimasim-xyce-spike:${IMAGE_TAG}"
RUN_PREFIX="${CIMASIM_XYCE_SMOKE_PREFIX:-smoke}"

if [[ -z "${CIMASIM_XYCE_PREFIX:-}" ]]; then
  echo "CIMASIM_XYCE_PREFIX is required" >&2
  exit 2
fi

export CIMASIM_XYCE_IMAGE_TAG="${IMAGE_TAG}"

docker compose -p "${PROJECT}" -f "${COMPOSE_FILE}" build xyce-spike

if docker volume inspect cimasim-xyce-spike-output >/dev/null 2>&1; then
  existing_runs="$(
    docker run --rm --network none -v cimasim-xyce-spike-output:/output:ro busybox:1.36 \
      sh -c 'find /output -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l'
  )"
else
  existing_runs=0
fi
if (( existing_runs + 2 > 10 )); then
  echo "Output volume contains ${existing_runs} runs; clean it explicitly before adding two more" >&2
  exit 3
fi

RUN_A="${RUN_PREFIX}-a"
RUN_B="${RUN_PREFIX}-b"

for run_id in "${RUN_A}" "${RUN_B}"; do
  if docker run --rm --network none -v cimasim-xyce-spike-output:/output:ro busybox:1.36 \
    test -e "/output/${run_id}"; then
    echo "Output run ${run_id} already exists; remove it explicitly before rerunning" >&2
    exit 4
  fi
  docker compose -p "${PROJECT}" -f "${COMPOSE_FILE}" run --rm xyce-spike --run-id "${run_id}"
done

docker run --rm --network none \
  -e RUN_A="${RUN_A}" \
  -e RUN_B="${RUN_B}" \
  -v cimasim-xyce-spike-output:/output:ro \
  --entrypoint python3 "${IMAGE}" - <<'PY'
import csv
import json
import os
from pathlib import Path

root = Path("/output")
summaries = []
waveforms = []
run_ids = (os.environ["RUN_A"], os.environ["RUN_B"])
for run_id in run_ids:
    summary_path = root / run_id / "summary.json"
    waveform_path = root / run_id / "waveform.csv"
    if not summary_path.is_file() or not waveform_path.is_file():
        raise SystemExit(f"missing artifacts for {run_id}")
    summary = json.loads(summary_path.read_text(encoding="utf-8"))
    if summary["status"] != "succeeded" or summary["samples"] < 100:
        raise SystemExit(f"invalid summary for {run_id}")
    with waveform_path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if len(rows) != summary["samples"]:
        raise SystemExit(f"sample count mismatch for {run_id}")
    summaries.append(summary)
    waveforms.append(rows)

if summaries[0]["samples"] != summaries[1]["samples"]:
    raise SystemExit("sample counts differ")

for key in ("time_seconds", "input_volts", "output_volts"):
    first = [float(row[key]) for row in waveforms[0]]
    second = [float(row[key]) for row in waveforms[1]]
    if len(first) != len(second):
        raise SystemExit(f"{key} length mismatch")
    for a, b in zip(first, second):
        if abs(a - b) > 1e-9:
            raise SystemExit(f"{key} differs outside tolerance")

print(json.dumps({
    "status": "passed",
    "runs": len(summaries),
    "samples": summaries[0]["samples"],
    "duration_seconds": summaries[0]["duration_seconds"],
}, sort_keys=True))
PY

if docker ps --format '{{.Names}}' | grep -qx 'cimasim-xyce-spike'; then
  echo "cimasim-xyce-spike is still running" >&2
  exit 5
fi

if pgrep -af '(^|/)Xyce( |$)' >/dev/null; then
  echo "Residual Xyce process detected" >&2
  exit 6
fi

if docker ps --format '{{.Names}} {{.Ports}}' | grep -E '^cimasim-xyce-spike .*[^ ]'; then
  echo "xyce spike exposed ports" >&2
  exit 7
fi

echo "Xyce spike smoke test PASS"
