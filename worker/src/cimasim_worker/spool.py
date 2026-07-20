from __future__ import annotations

import json
import os
import secrets
import shutil
import stat
from pathlib import Path
from typing import Any, Final

from cimasim_worker.executor import MAX_CAPTURE_BYTES, sanitize_message
from cimasim_worker.job_models import (
    FIXED_TEMPLATE_ID,
    PARAM_TEMPLATE_ID,
    SIMULATOR,
    TERMINAL_STATES,
    SpoolRequest,
    utc_timestamp,
)
from cimasim_worker.rc_parameters import RcParameterError, parse_rc_parameters

MAX_JSON_BYTES: Final = 64 * 1024
MAX_ARTIFACT_BYTES: Final = 5 * 1024 * 1024
JOB_ID_PREFIX: Final = "job_"
SPOOL_DIR_MODE: Final = 0o2770
SPOOL_FILE_MODE: Final = 0o660


class SpoolError(RuntimeError):
    """Raised when the file spool cannot be used safely."""


class FileSpool:
    def __init__(self, root: Path = Path("/spool")) -> None:
        self.root = root
        self.queued = root / "queued"
        self.claimed = root / "claimed"
        self.jobs = root / "jobs"
        self.failed = root / "failed"

    def ensure_available(self) -> None:
        if self.root.exists() and self.root.is_symlink():
            raise SpoolError("spool root is invalid")
        for path in (self.root, self.queued, self.claimed, self.jobs, self.failed):
            _mkdir_spool_dir(path)

    def recover_claimed(self) -> int:
        self.ensure_available()
        recovered = 0
        for marker in sorted(self.claimed.iterdir(), key=lambda item: item.name):
            if marker.is_symlink() or not marker.is_file() or not marker.name.endswith(".json"):
                continue
            job_id = marker.name.removesuffix(".json")
            try:
                request = self.read_request(job_id)
                current = _read_json(self.job_dir(job_id) / "status.json").get("status")
                if current == "queued":
                    self.write_status(job_id, request.user_id, "running")
                self.write_status(job_id, request.user_id, "failed", reason="worker_restarted")
                os.replace(marker, self.failed / marker.name)
                recovered += 1
            except (OSError, SpoolError):
                continue
        return recovered

    def claim_next(self) -> str | None:
        self.ensure_available()
        for marker in sorted(self.queued.iterdir(), key=lambda item: item.name):
            if marker.is_symlink() or not marker.is_file() or not marker.name.endswith(".json"):
                continue
            job_id = marker.name.removesuffix(".json")
            if not _valid_job_id(job_id):
                continue
            destination = self.claimed / marker.name
            try:
                os.replace(marker, destination)
                return job_id
            except OSError:
                continue
        return None

    def read_request(self, job_id: str) -> SpoolRequest:
        data = _read_json(self.job_dir(job_id) / "request.json")
        expected = {
            "job_id",
            "user_id",
            "name",
            "template_id",
            "simulator",
            "timeout_seconds",
            "created_at",
            "idempotency_key_hash",
            "body_hash",
        }
        allowed = expected | {"parameters"}
        if not expected <= set(data) <= allowed:
            raise SpoolError("request schema is invalid")
        if data["job_id"] != job_id:
            raise SpoolError("request job id mismatch")
        template_id = data["template_id"]
        if (
            template_id not in {FIXED_TEMPLATE_ID, PARAM_TEMPLATE_ID}
            or data["simulator"] != SIMULATOR
        ):
            raise SpoolError("unsupported job template")
        parameters = None
        try:
            if template_id == FIXED_TEMPLATE_ID:
                if "parameters" in data:
                    raise SpoolError("fixed template does not accept parameters")
            else:
                if "parameters" not in data:
                    raise SpoolError("parameterized template requires parameters")
                parameters = parse_rc_parameters(data["parameters"])
        except RcParameterError as exc:
            raise SpoolError(str(exc)) from exc
        timeout = data["timeout_seconds"]
        if not isinstance(timeout, int) or timeout <= 0 or timeout > 60:
            raise SpoolError("timeout is invalid")
        return SpoolRequest(
            job_id=job_id,
            user_id=_require_text(data["user_id"]),
            name=_require_text(data["name"]),
            template_id=template_id,
            simulator=SIMULATOR,
            timeout_seconds=timeout,
            created_at=_require_text(data["created_at"]),
            parameters=parameters,
        )

    def write_status(
        self,
        job_id: str,
        user_id: str,
        status: str,
        reason: str | None = None,
    ) -> None:
        job_dir = self.job_dir(job_id)
        current = _read_json(job_dir / "status.json")
        current_status = current.get("status")
        allowed = {
            "queued": {"running"},
            "running": {"succeeded", "failed", "timed_out"},
        }
        if current_status in TERMINAL_STATES:
            raise SpoolError("terminal status is immutable")
        if current_status != status and status not in allowed.get(str(current_status), set()):
            raise SpoolError("status transition is invalid")
        created_at = current.get("created_at", utc_timestamp())
        data: dict[str, object] = {
            "job_id": job_id,
            "user_id": user_id,
            "status": status,
            "created_at": created_at,
            "updated_at": utc_timestamp(),
        }
        if reason:
            data["reason"] = reason[:MAX_CAPTURE_BYTES]
        _atomic_write_json(job_dir / "status.json", data)

    def complete_claim(self, job_id: str, success: bool) -> None:
        marker = self.claimed / f"{job_id}.json"
        if not marker.exists():
            return
        destination = (self.failed if not success else self.claimed) / marker.name
        if success:
            marker.unlink()
        else:
            os.replace(marker, destination)

    def fail_claimed_from_status(self, job_id: str, reason: str) -> None:
        status_path = self.job_dir(job_id) / "status.json"
        current = _read_json(status_path)
        user_id = _require_text(current.get("user_id"))
        current_status = current.get("status")
        if current_status in TERMINAL_STATES:
            return
        if current_status == "queued":
            self.write_status(job_id, user_id, "running")
        self.write_status(job_id, user_id, "failed", reason=reason)

    def copy_executor_outputs(self, job_id: str, executor_output: Path) -> dict[str, Any]:
        job_dir = self.job_dir(job_id)
        artifacts = job_dir / "artifacts"
        _require_directory(artifacts)
        summary = _read_json_source(executor_output / "summary.json")
        source_waveform = executor_output / "waveform.csv"
        if source_waveform.exists():
            _require_regular_source(source_waveform)
            if source_waveform.stat(follow_symlinks=False).st_size > MAX_ARTIFACT_BYTES:
                raise SpoolError("waveform exceeds size limit")
            _atomic_copy(source_waveform, artifacts / "waveform.csv")
        _atomic_write_json(job_dir / "summary.json", summary)
        return summary

    def job_dir(self, job_id: str) -> Path:
        if not _valid_job_id(job_id):
            raise SpoolError("invalid job id")
        path = self.jobs / job_id
        if path.is_symlink() or not path.is_dir():
            raise SpoolError("job directory is invalid")
        return path


def _valid_job_id(job_id: str) -> bool:
    if not job_id.startswith(JOB_ID_PREFIX):
        return False
    suffix = job_id.removeprefix(JOB_ID_PREFIX)
    return bool(suffix) and len(suffix) <= 64 and all(char in "0123456789abcdef" for char in suffix)


def _require_text(value: object) -> str:
    if not isinstance(value, str) or not value:
        raise SpoolError("expected text")
    return value


def _require_directory(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    if not stat.S_ISDIR(mode):
        raise SpoolError("expected directory")
    if mode & stat.S_IROTH or mode & stat.S_IWOTH or mode & stat.S_IXOTH:
        raise SpoolError("directory is accessible to other")
    if not mode & stat.S_ISGID:
        raise SpoolError("directory does not preserve group inheritance")


def _require_regular_file(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    if not stat.S_ISREG(mode):
        raise SpoolError("expected regular file")
    if mode & stat.S_IROTH or mode & stat.S_IWOTH or mode & stat.S_IXOTH:
        raise SpoolError("file is accessible to other")


def _require_regular_source(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    if not stat.S_ISREG(mode):
        raise SpoolError("expected regular file")


def _read_json(path: Path) -> dict[str, Any]:
    _require_regular_file(path)
    return _load_json(path)


def _read_json_source(path: Path) -> dict[str, Any]:
    _require_regular_source(path)
    return _load_json(path)


def _load_json(path: Path) -> dict[str, Any]:
    if path.stat(follow_symlinks=False).st_size > MAX_JSON_BYTES:
        raise SpoolError("json exceeds size limit")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise SpoolError("json object expected")
    return data


def _atomic_write_json(path: Path, data: dict[str, Any]) -> None:
    payload = json.dumps(data, sort_keys=True, separators=(",", ":")) + "\n"
    parent = path.parent
    tmp = parent / f".{path.name}.{secrets.token_hex(8)}.tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, SPOOL_FILE_MODE)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            os.fchmod(handle.fileno(), SPOOL_FILE_MODE)
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
        os.chmod(path, SPOOL_FILE_MODE)
        _fsync_parent(parent)
    finally:
        if tmp.exists():
            tmp.unlink()


def _atomic_copy(source: Path, destination: Path) -> None:
    tmp = destination.parent / f".{destination.name}.{secrets.token_hex(8)}.tmp"
    shutil.copyfile(source, tmp)
    os.chmod(tmp, SPOOL_FILE_MODE)
    os.replace(tmp, destination)
    os.chmod(destination, SPOOL_FILE_MODE)
    _fsync_parent(destination.parent)


def _mkdir_spool_dir(path: Path) -> None:
    if path.exists():
        _require_directory(path)
        return
    try:
        path.mkdir(mode=SPOOL_DIR_MODE, parents=True, exist_ok=False)
    except FileExistsError:
        _require_directory(path)
        return
    os.chmod(path, SPOOL_DIR_MODE)
    _require_directory(path)


def _fsync_parent(parent: Path) -> None:
    dir_fd = os.open(parent, os.O_RDONLY)
    try:
        os.fsync(dir_fd)
    finally:
        os.close(dir_fd)


def sanitized_error(exc: Exception, root: Path) -> str:
    return sanitize_message(str(exc), root)
