from __future__ import annotations

import json
import os
import secrets
import stat
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Final

from cimasim_api.jobs.store import SPOOL_FILE_MODE

CUSTOM_SPOOL_DIRS: Final = ("queued", "claimed", "jobs", "state")
HEARTBEAT_NAME: Final = "dispatcher.json"
MAX_HEARTBEAT_BYTES: Final = 4096
PROBE_PREFIX: Final = ".backend-custom-readiness-"


def custom_spool_is_ready(root: Path) -> bool:
    probe_source: Path | None = None
    probe_target: Path | None = None
    try:
        _require_real_directory(root)
        for name in CUSTOM_SPOOL_DIRS:
            _require_real_directory(root / name)
        token = secrets.token_hex(8)
        probe_source = root / f"{PROBE_PREFIX}{token}.tmp"
        probe_target = root / f"{PROBE_PREFIX}{token}.probe"
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_CLOEXEC
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        descriptor = os.open(probe_source, flags, SPOOL_FILE_MODE)
        try:
            os.fchmod(descriptor, SPOOL_FILE_MODE)
            os.write(descriptor, b"ready\n")
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        os.replace(probe_source, probe_target)
        probe_source = None
        _require_regular_private_file(probe_target)
        if probe_target.read_bytes() != b"ready\n":
            return False
        probe_target.unlink()
        probe_target = None
        return True
    except (OSError, ValueError):
        return False
    finally:
        for path in (probe_source, probe_target):
            if path is not None:
                try:
                    path.unlink(missing_ok=True)
                except OSError:
                    pass


def dispatcher_heartbeat_is_ready(root: Path, ttl_seconds: int) -> bool:
    try:
        heartbeat = _read_heartbeat(root / "state" / HEARTBEAT_NAME)
        updated_at = _parse_timestamp(heartbeat.get("updated_at"))
        if updated_at is None:
            return False
        if datetime.now(UTC) - updated_at > timedelta(seconds=ttl_seconds):
            return False
        return heartbeat.get("status") in {"idle", "running", "stopping"}
    except (OSError, ValueError, TypeError):
        return False


def custom_subsystem_is_ready(root: Path, ttl_seconds: int) -> bool:
    return custom_spool_is_ready(root) and dispatcher_heartbeat_is_ready(root, ttl_seconds)


def _read_heartbeat(path: Path) -> dict[str, Any]:
    _require_regular_private_file(path)
    if path.stat(follow_symlinks=False).st_size > MAX_HEARTBEAT_BYTES:
        raise ValueError("heartbeat too large")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("invalid heartbeat")
    return value


def _parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(UTC)


def _require_real_directory(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    if not stat.S_ISDIR(mode) or path.is_symlink():
        raise ValueError("invalid custom spool directory")


def _require_regular_private_file(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    if not stat.S_ISREG(mode) or path.is_symlink() or mode & (stat.S_IRWXO | stat.S_IXGRP):
        raise ValueError("invalid private file")
