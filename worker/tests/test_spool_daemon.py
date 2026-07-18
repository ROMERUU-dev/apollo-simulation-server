from __future__ import annotations

import json
import os
from pathlib import Path

from cimasim_worker.daemon import WorkerDaemon
from cimasim_worker.executor import WorkerError
from cimasim_worker.spool import SPOOL_DIR_MODE, SPOOL_FILE_MODE, FileSpool


def make_job(root: Path, job_id: str = "job_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") -> str:
    root.mkdir(parents=True, exist_ok=True)
    os.chmod(root, SPOOL_DIR_MODE)
    for name in ("queued", "claimed", "jobs", "failed"):
        (root / name).mkdir(parents=True, exist_ok=True)
        os.chmod(root / name, SPOOL_DIR_MODE)
    job_dir = root / "jobs" / job_id
    (job_dir / "artifacts").mkdir(parents=True)
    os.chmod(job_dir, SPOOL_DIR_MODE)
    os.chmod(job_dir / "artifacts", SPOOL_DIR_MODE)
    request = {
        "job_id": job_id,
        "user_id": "user-1",
        "name": "RC",
        "template_id": "rc_lowpass_fixed_v1",
        "simulator": "xyce",
        "timeout_seconds": 30,
        "idempotency_key_hash": None,
        "body_hash": None,
        "created_at": "2026-01-01T00:00:00+00:00",
    }
    status = {
        "job_id": job_id,
        "user_id": "user-1",
        "status": "queued",
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    (job_dir / "request.json").write_text(json.dumps(request), encoding="utf-8")
    (job_dir / "status.json").write_text(json.dumps(status), encoding="utf-8")
    (root / "queued" / f"{job_id}.json").write_text(
        json.dumps({"job_id": job_id}),
        encoding="utf-8",
    )
    for path in (
        job_dir / "request.json",
        job_dir / "status.json",
        root / "queued" / f"{job_id}.json",
    ):
        os.chmod(path, SPOOL_FILE_MODE)
    return job_id


class FakeExecutor:
    def __init__(self, status: str = "succeeded") -> None:
        self.status = status
        self.calls: list[str] = []

    def run(self, run_id: str) -> dict[str, object]:
        self.calls.append(run_id)
        output = Path(self.output_root) / run_id  # type: ignore[attr-defined]
        output.mkdir(parents=True)
        summary = {
            "status": self.status,
            "simulator": "xyce",
            "template": "rc_lowpass_fixed_v1",
            "samples": 2013,
            "duration_seconds": 0.005,
            "artifacts": [
                {"filename": "waveform.csv", "content_type": "text/csv", "size_bytes": 12}
            ],
        }
        (output / "summary.json").write_text(json.dumps(summary), encoding="utf-8")
        (output / "waveform.csv").write_text("time,v\n0,0\n", encoding="utf-8")
        return summary


class FailingExecutor:
    def __init__(self, timeout: bool = False) -> None:
        self.timeout = timeout

    def run(self, run_id: str) -> dict[str, object]:
        output = Path(self.output_root) / run_id  # type: ignore[attr-defined]
        output.mkdir(parents=True)
        status = "timed_out" if self.timeout else "failed"
        (output / "summary.json").write_text(
            json.dumps(
                {
                    "status": status,
                    "simulator": "xyce",
                    "template": "rc_lowpass_fixed_v1",
                    "error": "controlled",
                    "artifacts": [],
                }
            ),
            encoding="utf-8",
        )
        raise WorkerError("Xyce execution timed out" if self.timeout else "failed")


def test_claim_next_is_ordered_and_atomic(tmp_path: Path) -> None:
    make_job(tmp_path, "job_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
    first = make_job(tmp_path, "job_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    spool = FileSpool(tmp_path)
    assert spool.claim_next() == first
    assert not (tmp_path / "queued" / f"{first}.json").exists()
    assert (tmp_path / "claimed" / f"{first}.json").is_file()


def test_successful_daemon_job_writes_terminal_state(tmp_path: Path, monkeypatch) -> None:
    job_id = make_job(tmp_path)
    executor = FakeExecutor()
    monkeypatch.setattr(executor, "output_root", tmp_path / "unused", raising=False)
    daemon = WorkerDaemon(FileSpool(tmp_path), executor=executor)  # type: ignore[arg-type]
    daemon.run(once=True)
    status = json.loads((tmp_path / "jobs" / job_id / "status.json").read_text())
    assert status["status"] == "succeeded"
    assert (tmp_path / "jobs" / job_id / "artifacts" / "waveform.csv").is_file()
    assert not (tmp_path / "claimed" / f"{job_id}.json").exists()
    assert executor.calls == [job_id]


def test_worker_failure_and_timeout_are_terminal(tmp_path: Path, monkeypatch) -> None:
    for timeout, expected in ((False, "failed"), (True, "timed_out")):
        root = tmp_path / expected
        job_id = make_job(root)
        executor = FailingExecutor(timeout=timeout)
        monkeypatch.setattr(executor, "output_root", root / "unused", raising=False)
        WorkerDaemon(FileSpool(root), executor=executor).run(once=True)  # type: ignore[arg-type]
        status = json.loads((root / "jobs" / job_id / "status.json").read_text())
        assert status["status"] == expected
        assert not (root / "jobs" / job_id / "artifacts" / "waveform.csv").exists()


def test_recovery_marks_claimed_failed(tmp_path: Path) -> None:
    job_id = make_job(tmp_path)
    (tmp_path / "queued" / f"{job_id}.json").rename(tmp_path / "claimed" / f"{job_id}.json")
    assert FileSpool(tmp_path).recover_claimed() == 1
    status = json.loads((tmp_path / "jobs" / job_id / "status.json").read_text())
    assert status["status"] == "failed"
    assert status["reason"] == "worker_restarted"


def test_invalid_request_is_not_executed(tmp_path: Path) -> None:
    job_id = make_job(tmp_path)
    request_path = tmp_path / "jobs" / job_id / "request.json"
    request = json.loads(request_path.read_text())
    request["template_id"] = "other"
    request_path.write_text(json.dumps(request), encoding="utf-8")
    executor = FakeExecutor()
    WorkerDaemon(FileSpool(tmp_path), executor=executor).run(once=True)  # type: ignore[arg-type]
    status = json.loads((tmp_path / "jobs" / job_id / "status.json").read_text())
    assert executor.calls == []
    assert status["status"] == "failed"
    assert status["reason"] == "unsupported job template"
    assert (tmp_path / "failed" / f"{job_id}.json").is_file()
