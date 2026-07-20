from __future__ import annotations

import os
import secrets
import stat
from pathlib import Path
from typing import Final

EXPECTED_UID: Final = 10002
EXPECTED_GID: Final = 10002
SHARED_GID: Final = 10003
SPOOL_DIRS: Final = ("queued", "claimed", "jobs", "failed")
PROBE_PREFIX: Final = ".worker-health-"


def check_worker_health(root: Path = Path("/spool"), proc_root: Path = Path("/proc")) -> bool:
    if os.geteuid() != EXPECTED_UID or os.getegid() != EXPECTED_GID:
        return False
    if SHARED_GID not in os.getgroups():
        return False
    if not _daemon_is_running(proc_root):
        return False

    source: Path | None = None
    target: Path | None = None
    try:
        _require_real_directory(root)
        for name in SPOOL_DIRS:
            _require_real_directory(root / name)
        token = secrets.token_hex(8)
        source = root / f"{PROBE_PREFIX}{token}.tmp"
        target = root / f"{PROBE_PREFIX}{token}.probe"
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_CLOEXEC
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        fd = os.open(source, flags, 0o660)
        try:
            os.fchmod(fd, 0o660)
            os.write(fd, b"healthy\n")
            os.fsync(fd)
        finally:
            os.close(fd)
        os.replace(source, target)
        source = None
        mode = target.stat(follow_symlinks=False).st_mode
        if not stat.S_ISREG(mode) or mode & stat.S_IRWXO:
            return False
        target.unlink()
        target = None
        return True
    except (OSError, ValueError):
        return False
    finally:
        for path in (source, target):
            if path is not None:
                try:
                    path.unlink(missing_ok=True)
                except OSError:
                    pass


def _require_real_directory(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    if not stat.S_ISDIR(mode) or path.is_symlink():
        raise ValueError("invalid spool directory")


def _daemon_is_running(proc_root: Path) -> bool:
    try:
        entries = proc_root.iterdir()
    except OSError:
        return False
    for entry in entries:
        if not entry.name.isdigit():
            continue
        try:
            argv = (entry / "cmdline").read_bytes().split(b"\0")
        except OSError:
            continue
        for index, value in enumerate(argv[:-1]):
            if value == b"-m" and argv[index + 1] == b"cimasim_worker.daemon":
                return True
    return False


def main() -> int:
    return 0 if check_worker_health() else 1


if __name__ == "__main__":
    raise SystemExit(main())
