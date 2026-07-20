from __future__ import annotations

import fcntl
import hashlib
import json
import os
import secrets
import stat
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Final

from pydantic import ValidationError

from cimasim_api.config import Settings
from cimasim_api.jobs.errors import (
    ArtifactNotFoundError,
    JobNotFoundError,
    JobSpoolUnavailableError,
)
from cimasim_api.jobs.models import (
    ACTIVE_STATES,
    DerivedMetrics,
    JobCreateRequest,
    JobResponse,
    JobStatus,
    JobSummary,
    StoredJobRequest,
)

JOB_ID_PREFIX: Final = "job_"
MAX_JSON_BYTES: Final = 64 * 1024
MAX_ARTIFACT_BYTES: Final = 5 * 1024 * 1024
MAX_CUSTOM_ARTIFACT_BYTES: Final = 10 * 1024 * 1024
SPOOL_DIRS: Final = ("queued", "claimed", "jobs", "failed")
SPOOL_DIR_MODE: Final = 0o2770
SPOOL_FILE_MODE: Final = 0o660
SPOOL_LOCK_NAME: Final = ".jobs.lock"
_INITIALIZATION_LOCK: Final = threading.Lock()


class JobStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.root = settings.job_spool_root

    def ensure_available(self) -> None:
        if not self.settings.jobs_enabled:
            raise JobSpoolUnavailableError
        with _INITIALIZATION_LOCK:
            if self.root.exists() and self.root.is_symlink():
                raise JobSpoolUnavailableError
            try:
                _mkdir_spool_dir(self.root)
                for name in SPOOL_DIRS:
                    _mkdir_spool_dir(self.root / name)
                _ensure_lock_file(self.root / SPOOL_LOCK_NAME)
            except OSError as exc:
                raise JobSpoolUnavailableError from exc

    @contextmanager
    def exclusive_lock(self) -> Iterator[None]:
        self.ensure_available()
        lock_path = self.root / SPOOL_LOCK_NAME
        fd = os.open(lock_path, os.O_RDWR | os.O_CLOEXEC)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            yield
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)

    def create_job(
        self,
        user_id: str,
        request: JobCreateRequest,
        idempotency_key: str | None,
    ) -> tuple[JobResponse, bool]:
        self.ensure_available()
        created_at = _utc_now()
        body_hash = _body_hash(request)
        key_hash = _key_hash(user_id, idempotency_key) if idempotency_key else None
        job_id = _generate_job_id()
        job_dir = self.root / "jobs" / job_id
        try:
            _mkdir_spool_dir(job_dir, parents=False)
            _mkdir_spool_dir(job_dir / "artifacts", parents=False)
        except OSError as exc:
            raise JobSpoolUnavailableError from exc

        stored_data: dict[str, Any] = {
            "job_id": job_id,
            "user_id": user_id,
            "name": request.name,
            "template_id": request.template_id,
            "timeout_seconds": self.settings.job_timeout_seconds,
            "idempotency_key_hash": key_hash,
            "body_hash": body_hash,
            "created_at": created_at,
        }
        if request.parameters is not None:
            stored_data["parameters"] = request.parameters
        if request.netlist is not None:
            stored_data["netlist"] = request.netlist
        if request.requested_outputs is not None:
            stored_data["requested_outputs"] = request.requested_outputs
        stored = StoredJobRequest.model_validate(stored_data)
        status = JobStatus(
            job_id=job_id,
            user_id=user_id,
            status="queued",
            created_at=created_at,
            updated_at=created_at,
        )
        stored_data = stored.model_dump(mode="json")
        if stored.parameters is None:
            stored_data.pop("parameters")
        if stored.netlist is None:
            stored_data.pop("netlist")
        if stored.requested_outputs is None:
            stored_data.pop("requested_outputs")
        _atomic_write_json(job_dir / "request.json", stored_data)
        _atomic_write_json(job_dir / "status.json", status.model_dump(mode="json"))
        _atomic_write_json(self.root / "queued" / f"{job_id}.json", {"job_id": job_id})
        return self.to_response(stored, status), True

    def find_idempotent(
        self,
        user_id: str,
        request: JobCreateRequest,
        idempotency_key: str,
    ) -> tuple[JobResponse | None, bool]:
        self.ensure_available()
        key_hash = _key_hash(user_id, idempotency_key)
        body_hash = _body_hash(request)
        for stored, status in self.iter_jobs():
            if stored.user_id != user_id or stored.idempotency_key_hash != key_hash:
                continue
            return self.to_response(stored, status), stored.body_hash == body_hash
        return None, True

    def list_jobs(self, user_id: str, limit: int) -> list[JobResponse]:
        self.ensure_available()
        jobs = [
            self.to_response(stored, status)
            for stored, status in self.iter_jobs()
            if stored.user_id == user_id
        ]
        jobs.sort(key=lambda job: job.created_at, reverse=True)
        return jobs[:limit]

    def get_job(self, user_id: str, job_id: str) -> JobResponse:
        self.ensure_available()
        stored, status = self.read_job(job_id)
        if stored.user_id != user_id:
            raise JobNotFoundError
        return self.to_response(stored, status)

    def read_job(self, job_id: str) -> tuple[StoredJobRequest, JobStatus]:
        job_dir = _safe_job_dir(self.root, job_id)
        try:
            stored = StoredJobRequest.model_validate(_read_json(job_dir / "request.json"))
            status = JobStatus.model_validate(_read_json(job_dir / "status.json"))
        except (OSError, ValueError, ValidationError) as exc:
            raise JobNotFoundError from exc
        if stored.job_id != job_id or status.job_id != job_id:
            raise JobNotFoundError
        return stored, status

    def iter_jobs(self) -> list[tuple[StoredJobRequest, JobStatus]]:
        jobs_root = self.root / "jobs"
        try:
            entries = sorted(jobs_root.iterdir(), key=lambda item: item.name)
        except OSError as exc:
            raise JobSpoolUnavailableError from exc
        result: list[tuple[StoredJobRequest, JobStatus]] = []
        for entry in entries:
            if not entry.name.startswith(JOB_ID_PREFIX) or entry.is_symlink() or not entry.is_dir():
                continue
            try:
                result.append(self.read_job(entry.name))
            except JobNotFoundError:
                continue
        return result

    def count_active(self, user_id: str | None = None) -> int:
        total = 0
        for stored, status in self.iter_jobs():
            if status.status in ACTIVE_STATES and (user_id is None or stored.user_id == user_id):
                total += 1
        return total

    def artifact_path(self, user_id: str, job_id: str, filename: str) -> Path:
        if filename not in {"waveform.csv", "results.csv"}:
            raise ArtifactNotFoundError
        response = self.get_job(user_id, job_id)
        if response.status != "succeeded":
            raise ArtifactNotFoundError
        path = _safe_job_dir(self.root, job_id) / "artifacts" / filename
        try:
            _require_regular_file(path)
            limit = MAX_CUSTOM_ARTIFACT_BYTES if filename == "results.csv" else MAX_ARTIFACT_BYTES
            if path.stat(follow_symlinks=False).st_size > limit:
                raise ArtifactNotFoundError
        except OSError as exc:
            raise ArtifactNotFoundError from exc
        return path

    def to_response(self, stored: StoredJobRequest, status: JobStatus) -> JobResponse:
        summary = self._read_summary(stored.job_id)
        return JobResponse(
            job_id=stored.job_id,
            name=stored.name,
            template_id=stored.template_id,
            simulator=stored.simulator,
            status=status.status,
            created_at=status.created_at,
            updated_at=status.updated_at,
            summary=summary,
            parameters=stored.parameters,
            derived=(
                DerivedMetrics(time_constant_seconds=stored.parameters.time_constant_seconds)
                if stored.parameters is not None
                else None
            ),
        )

    def _read_summary(self, job_id: str) -> JobSummary | None:
        path = _safe_job_dir(self.root, job_id) / "summary.json"
        if not path.exists():
            return None
        try:
            return JobSummary.model_validate(_read_json(path))
        except (OSError, ValueError, ValidationError):
            return None


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _generate_job_id() -> str:
    return f"{JOB_ID_PREFIX}{secrets.token_hex(16)}"


def _body_hash(request: JobCreateRequest) -> str:
    payload: dict[str, Any] = {"name": request.name, "template_id": request.template_id}
    if request.parameters is not None:
        payload["parameters"] = request.parameters.model_dump(mode="json")
    if request.netlist is not None:
        payload["netlist"] = request.netlist
    if request.requested_outputs is not None:
        payload["requested_outputs"] = request.requested_outputs
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    return hashlib.sha256(raw).hexdigest()


def _key_hash(user_id: str, idempotency_key: str | None) -> str:
    raw = f"{user_id}\0{idempotency_key or ''}".encode()
    return hashlib.sha256(raw).hexdigest()


def _safe_job_dir(root: Path, job_id: str) -> Path:
    if not job_id.startswith(JOB_ID_PREFIX) or "/" in job_id or "\x00" in job_id:
        raise JobNotFoundError
    path = root / "jobs" / job_id
    if path.is_symlink() or not path.is_dir():
        raise JobNotFoundError
    return path


def _require_directory(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    if not stat.S_ISDIR(mode):
        raise JobSpoolUnavailableError
    if mode & stat.S_IROTH or mode & stat.S_IWOTH or mode & stat.S_IXOTH:
        raise JobSpoolUnavailableError
    if not mode & stat.S_ISGID:
        raise JobSpoolUnavailableError


def _require_regular_file(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    if not stat.S_ISREG(mode):
        raise ArtifactNotFoundError
    if mode & stat.S_IROTH or mode & stat.S_IWOTH or mode & stat.S_IXOTH:
        raise ArtifactNotFoundError


def _read_json(path: Path) -> dict[str, Any]:
    _require_regular_file(path)
    if path.stat(follow_symlinks=False).st_size > MAX_JSON_BYTES:
        raise ValueError("json too large")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("json object expected")
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
        dir_fd = os.open(parent, os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    finally:
        if tmp.exists():
            tmp.unlink()


def _mkdir_spool_dir(path: Path, *, parents: bool = True) -> None:
    if path.exists():
        _require_directory(path)
        return
    try:
        path.mkdir(mode=SPOOL_DIR_MODE, parents=parents, exist_ok=False)
    except FileExistsError:
        _require_directory(path)
        return
    os.chmod(path, SPOOL_DIR_MODE)
    _require_directory(path)


def _ensure_lock_file(path: Path) -> None:
    if path.exists():
        mode = path.stat(follow_symlinks=False).st_mode
        if not stat.S_ISREG(mode):
            raise JobSpoolUnavailableError
        if mode & stat.S_IROTH or mode & stat.S_IWOTH or mode & stat.S_IXOTH:
            raise JobSpoolUnavailableError
        return
    fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_EXCL, SPOOL_FILE_MODE)
    try:
        os.fchmod(fd, SPOOL_FILE_MODE)
        os.fsync(fd)
    finally:
        os.close(fd)
