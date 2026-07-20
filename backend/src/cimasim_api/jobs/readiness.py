from __future__ import annotations

import os
import secrets
import stat
from pathlib import Path
from typing import Final

from cimasim_api.jobs.store import SPOOL_DIRS, SPOOL_FILE_MODE

PROBE_PREFIX: Final = ".backend-readiness-"


def spool_is_ready(root: Path) -> bool:
    probe_source: Path | None = None
    probe_target: Path | None = None
    try:
        _require_real_directory(root)
        for name in SPOOL_DIRS:
            _require_real_directory(root / name)

        token = secrets.token_hex(8)
        probe_source = root / f"{PROBE_PREFIX}{token}.tmp"
        probe_target = root / f"{PROBE_PREFIX}{token}.probe"
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_CLOEXEC
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        fd = os.open(probe_source, flags, SPOOL_FILE_MODE)
        try:
            os.fchmod(fd, SPOOL_FILE_MODE)
            os.write(fd, b"ready\n")
            os.fsync(fd)
        finally:
            os.close(fd)
        os.replace(probe_source, probe_target)
        probe_source = None
        _require_regular_private_file(probe_target)
        if probe_target.read_bytes() != b"ready\n":
            return False
        probe_target.unlink()
        probe_target = None
        _fsync_directory(root)
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


def _require_real_directory(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    if not stat.S_ISDIR(mode) or path.is_symlink():
        raise ValueError("invalid spool directory")


def _require_regular_private_file(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    if not stat.S_ISREG(mode) or mode & (stat.S_IRWXO | stat.S_IXGRP):
        raise ValueError("invalid readiness file")


def _fsync_directory(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY | os.O_CLOEXEC)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)
