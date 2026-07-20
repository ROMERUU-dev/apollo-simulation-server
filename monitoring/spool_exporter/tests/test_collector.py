import json
import os
from pathlib import Path

from cimasim_spool_exporter.collector import inspect_spool


def prepare(root: Path) -> Path:
    for name in ("queued", "claimed", "jobs", "failed"):
        (root / name).mkdir(parents=True, exist_ok=True)
    job = root / "jobs" / ("job_" + "0" * 32)
    (job / "artifacts").mkdir(parents=True)
    (job / "request.json").write_text(json.dumps({"template_id": "rc_lowpass_fixed_v1"}))
    (job / "status.json").write_text(
        json.dumps({"status": "succeeded", "updated_at": "2026-01-01T00:00:00+00:00"})
    )
    (job / "artifacts" / "waveform.csv").write_text("x,y\n0,0\n")
    return job


def test_aggregates_legacy_without_exposing_identity(tmp_path: Path) -> None:
    prepare(tmp_path)
    result = inspect_spool(tmp_path)
    assert result.ready
    assert result.statuses["succeeded"] == 1
    assert result.kinds["legacy_rc_fixed"] == 1
    assert result.artifact_bytes > 0


def test_rejects_symlink(tmp_path: Path) -> None:
    job = prepare(tmp_path)
    (job / "status.json").unlink()
    os.symlink("request.json", job / "status.json")
    result = inspect_spool(tmp_path)
    assert not result.ready
    assert result.errors == 1


def test_counts_invalid_json_without_raising(tmp_path: Path) -> None:
    job = prepare(tmp_path)
    (job / "status.json").write_text("{")
    result = inspect_spool(tmp_path)
    assert not result.ready
    assert result.errors == 1
