from __future__ import annotations

import os
from pathlib import Path

from cimasim_worker import healthcheck
from cimasim_worker.spool import SPOOL_DIR_MODE


def make_spool(root: Path) -> None:
    root.mkdir(mode=SPOOL_DIR_MODE)
    os.chmod(root, SPOOL_DIR_MODE)
    for name in healthcheck.SPOOL_DIRS:
        path = root / name
        path.mkdir(mode=SPOOL_DIR_MODE)
        os.chmod(path, SPOOL_DIR_MODE)


def make_daemon_proc(root: Path) -> None:
    process = root / "42"
    process.mkdir(parents=True)
    (process / "cmdline").write_bytes(b"python3\0-m\0cimasim_worker.daemon\0--spool-root\0/spool\0")


def set_expected_identity(monkeypatch) -> None:
    monkeypatch.setattr(healthcheck.os, "geteuid", lambda: healthcheck.EXPECTED_UID)
    monkeypatch.setattr(healthcheck.os, "getegid", lambda: healthcheck.EXPECTED_GID)
    monkeypatch.setattr(healthcheck.os, "getgroups", lambda: [healthcheck.SHARED_GID])


def test_healthcheck_validates_daemon_identity_and_spool(tmp_path: Path, monkeypatch) -> None:
    spool = tmp_path / "spool"
    proc = tmp_path / "proc"
    make_spool(spool)
    make_daemon_proc(proc)
    set_expected_identity(monkeypatch)

    assert healthcheck.check_worker_health(spool, proc)
    assert sorted(path.name for path in spool.iterdir()) == [
        "claimed",
        "failed",
        "jobs",
        "queued",
    ]


def test_healthcheck_rejects_missing_daemon(tmp_path: Path, monkeypatch) -> None:
    spool = tmp_path / "spool"
    proc = tmp_path / "proc"
    make_spool(spool)
    proc.mkdir()
    set_expected_identity(monkeypatch)

    assert not healthcheck.check_worker_health(spool, proc)


def test_healthcheck_rejects_wrong_identity(tmp_path: Path, monkeypatch) -> None:
    spool = tmp_path / "spool"
    proc = tmp_path / "proc"
    make_spool(spool)
    make_daemon_proc(proc)
    set_expected_identity(monkeypatch)
    monkeypatch.setattr(healthcheck.os, "geteuid", lambda: 10001)

    assert not healthcheck.check_worker_health(spool, proc)


def test_healthcheck_rejects_symlinked_spool_directory(tmp_path: Path, monkeypatch) -> None:
    spool = tmp_path / "spool"
    proc = tmp_path / "proc"
    make_spool(spool)
    make_daemon_proc(proc)
    set_expected_identity(monkeypatch)
    (spool / "queued").rmdir()
    (spool / "queued").symlink_to(spool / "jobs", target_is_directory=True)

    assert not healthcheck.check_worker_health(spool, proc)
