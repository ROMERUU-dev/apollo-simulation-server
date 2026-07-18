from __future__ import annotations

import json
import stat
import subprocess
import sys
from pathlib import Path

import pytest

from cimasim_worker.executor import FixedRcXyceExecutor, WorkerError, sanitize_message
from cimasim_worker.validation import parse_xyce_prn, validate_rc_lowpass


def write_fake_xyce(path: Path, body: str) -> Path:
    path.write_text(body, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    return path


def valid_prn(samples: int = 2001) -> str:
    lines = ["Index       TIME              V(IN)            V(OUT)"]
    for index in range(samples):
        time_value = index * 2.5e-6
        vin = min(1.0, time_value / 1e-6) if time_value < 1e-6 else 1.0
        vout = 1.0 - pow(2.718281828459045, -time_value / 1e-3)
        lines.append(f"{index} {time_value:.8e} {vin:.8e} {vout:.8e}")
    return "\n".join(lines) + "\n"


def fake_script(write_prn: str, extra: str = "", exit_code: int = 0) -> str:
    return f"""#!{sys.executable}
from pathlib import Path
Path("xyce.log").write_text("log\\n", encoding="utf-8")
Path("waveform.prn").write_text({write_prn!r}, encoding="utf-8")
{extra}
raise SystemExit({exit_code})
"""


def run_executor(tmp_path: Path, script: str, run_id: str = "run-a") -> dict[str, object]:
    xyce = write_fake_xyce(tmp_path / "fake-xyce", script)
    output = tmp_path / "output"
    return FixedRcXyceExecutor(xyce_path=xyce, output_root=output, timeout_seconds=2).run(run_id)


def test_success_writes_summary_and_waveform(tmp_path: Path) -> None:
    summary = run_executor(tmp_path, fake_script(valid_prn()))

    assert summary["status"] == "succeeded"
    assert summary["samples"] == 2001
    assert (tmp_path / "output" / "run-a" / "summary.json").is_file()
    assert (tmp_path / "output" / "run-a" / "waveform.csv").is_file()


def test_exit_code_failure_is_reported(tmp_path: Path) -> None:
    with pytest.raises(WorkerError, match="exited with code 7"):
        run_executor(tmp_path, fake_script(valid_prn(), exit_code=7))
    summary = json.loads((tmp_path / "output" / "run-a" / "summary.json").read_text())
    assert summary["status"] == "failed"
    assert not (tmp_path / "output" / "run-a" / "waveform.csv").exists()


def test_missing_waveform_fails(tmp_path: Path) -> None:
    script = f"""#!{sys.executable}
from pathlib import Path
Path("xyce.log").write_text("log\\n", encoding="utf-8")
raise SystemExit(0)
"""
    with pytest.raises(WorkerError, match="was not produced"):
        run_executor(tmp_path, script)


def test_large_waveform_fails(tmp_path: Path) -> None:
    huge = "Index TIME V(IN) V(OUT)\\n" + ("0 0 0 0\\n" * 700000)
    with pytest.raises(WorkerError, match="exceeds size limit"):
        run_executor(tmp_path, fake_script(huge))


def test_invalid_header_fails(tmp_path: Path) -> None:
    with pytest.raises(WorkerError, match="header"):
        run_executor(tmp_path, fake_script("bad\\n1 2 3\\n"))


def test_nan_or_inf_fails(tmp_path: Path) -> None:
    data = "Index TIME V(IN) V(OUT)\n0 0 0 0\n1 1e-6 1 NaN\n"
    with pytest.raises(WorkerError, match="too few samples|NaN|Inf"):
        run_executor(tmp_path, fake_script(data))


def test_non_monotonic_time_fails(tmp_path: Path) -> None:
    rows = valid_prn().splitlines()
    rows[10] = "9 1.00000000e-06 1.00000000e+00 1.00000000e-03"
    rows[11] = "10 1.00000000e-06 1.00000000e+00 1.10000000e-03"
    with pytest.raises(WorkerError, match="monotonic"):
        run_executor(tmp_path, fake_script("\n".join(rows) + "\n"))


def test_unexpected_files_fail(tmp_path: Path) -> None:
    with pytest.raises(WorkerError, match="unexpected"):
        run_executor(tmp_path, fake_script(valid_prn(), 'Path("extra.txt").write_text("x")'))


def test_temporary_workdir_is_cleaned(tmp_path: Path) -> None:
    before = {p for p in Path("/tmp").glob("cimasim-xyce-*")}
    run_executor(tmp_path, fake_script(valid_prn()))
    after = {p for p in Path("/tmp").glob("cimasim-xyce-*")}
    assert after == before


def test_timeout_terminates_process_group(tmp_path: Path) -> None:
    script = f"""#!{sys.executable}
import time
time.sleep(10)
"""
    with pytest.raises(WorkerError, match="timed out"):
        run_executor(tmp_path, script)
    summary = json.loads((tmp_path / "output" / "run-a" / "summary.json").read_text())
    assert summary["status"] == "timed_out"
    assert not (tmp_path / "output" / "run-a" / "waveform.csv").exists()


def test_rejects_existing_run_directory(tmp_path: Path) -> None:
    script = fake_script(valid_prn())
    run_executor(tmp_path, script)
    with pytest.raises(WorkerError, match="already exists"):
        run_executor(tmp_path, script)


def test_sanitizes_internal_paths(tmp_path: Path) -> None:
    message = sanitize_message(f"failed at {tmp_path} and /opt/xyce/bin/Xyce", tmp_path)
    assert str(tmp_path) not in message
    assert "/opt/xyce" not in message


def test_subprocess_arguments_do_not_use_shell(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    xyce = write_fake_xyce(tmp_path / "fake-xyce", fake_script(valid_prn()))
    output = tmp_path / "output"
    seen: dict[str, object] = {}
    original_popen = subprocess.Popen

    def recording_popen(*args: object, **kwargs: object) -> subprocess.Popen[bytes]:
        seen["args"] = args
        seen["kwargs"] = kwargs
        return original_popen(*args, **kwargs)

    monkeypatch.setattr(subprocess, "Popen", recording_popen)
    FixedRcXyceExecutor(xyce_path=xyce, output_root=output, timeout_seconds=2).run("run-a")

    assert isinstance(seen["args"], tuple)
    assert isinstance(seen["args"][0], list)
    assert seen["kwargs"].get("shell") is None


def test_validate_rc_lowpass_accepts_expected_shape(tmp_path: Path) -> None:
    waveform = tmp_path / "waveform.prn"
    waveform.write_text(valid_prn(), encoding="utf-8")
    columns, rows = parse_xyce_prn(waveform)
    summary = validate_rc_lowpass(columns, rows)
    assert summary.samples == 2001
