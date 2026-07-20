import json
from pathlib import Path

import pytest

from cimasim_custom_runner.dispatcher import RUNNER_IMAGE, Dispatcher, podman_command
from cimasim_custom_runner.results import ResultValidationError, validate_results
from cimasim_custom_runner.runner import prepare_netlist


def test_podman_command_is_fixed_and_isolated(tmp_path: Path) -> None:
    command = podman_command(tmp_path / "input", tmp_path / "output", "tran")
    joined = " ".join(command)
    assert command[0:3] == ["podman", "run", "--rm"]
    assert "--network=none" in command
    assert "--userns=keep-id:uid=10005,gid=10005" in command
    assert "--read-only" in command
    assert "--cap-drop=all" in command
    assert "--security-opt=no-new-privileges" in command
    assert "--memory=1g" in command
    assert "--cpus=1" in command
    assert "--pids-limit=64" in command
    assert RUNNER_IMAGE in command
    assert "docker.sock" not in joined
    assert "--privileged" not in command


def test_results_validate_shape_finite_and_axis(tmp_path: Path) -> None:
    result = tmp_path / "results.csv"
    result.write_text("TIME,V(out)\n0,0\n1e-6,0.1\n", encoding="utf-8")
    assert validate_results(result, "tran") == (2, ["TIME", "V(out)"])


def test_results_accept_descending_dc_axis(tmp_path: Path) -> None:
    result = tmp_path / "results.csv"
    result.write_text("V1,V(out)\n1,0.5\n0,0\n", encoding="utf-8")
    assert validate_results(result, "dc") == (2, ["V1", "V(out)"])


def test_runner_adds_only_the_fixed_internal_output_path(tmp_path: Path) -> None:
    source = tmp_path / "source.cir"
    prepared = tmp_path / "prepared.cir"
    output = tmp_path / "output" / "results.csv"
    output.parent.mkdir()
    source.write_text(
        "V1 in 0 1\nR1 in out 1k\n.TRAN 1u 1m\n.PRINT TRAN FORMAT=CSV V(out)\n.END\n",
        encoding="utf-8",
    )
    assert prepare_netlist(source, prepared, output, "tran") == "tran"
    rendered = prepared.read_text(encoding="utf-8")
    assert "FILE=/output/results.csv" in rendered
    assert ".INCLUDE" not in rendered


def test_runner_rejects_analysis_mismatch(tmp_path: Path) -> None:
    source = tmp_path / "source.cir"
    prepared = tmp_path / "prepared.cir"
    output = tmp_path / "output" / "results.csv"
    output.parent.mkdir()
    source.write_text(
        "V1 in 0 1\nR1 in out 1k\n.TRAN 1u 1m\n.PRINT TRAN FORMAT=CSV V(out)\n.END\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="analysis mismatch"):
        prepare_netlist(source, prepared, output, "ac")


def prepare_claimed_job(root: Path) -> tuple[Path, Path]:
    job_id = "job_" + "a" * 32
    for name in ("queued", "claimed", "jobs", "failed"):
        (root / name).mkdir()
    job = root / "jobs" / job_id
    (job / "artifacts").mkdir(parents=True)
    (job / "request.json").write_text(
        json.dumps(
            {
                "job_id": job_id,
                "user_id": "opaque-owner",
                "name": "Custom",
                "template_id": "custom_xyce_netlist_v1",
                "netlist": (
                    "V1 in 0 1\nR1 in out 1k\n.TRAN 1u 1m\n.PRINT TRAN FORMAT=CSV V(out)\n.END\n"
                ),
                "requested_outputs": ["V(out)"],
                "created_at": "2026-07-20T00:00:00+00:00",
            }
        ),
        encoding="utf-8",
    )
    marker = root / "claimed" / f"{job_id}.json"
    marker.write_text("{}", encoding="utf-8")
    return job, marker


def test_dispatcher_writes_success_and_cleans_job_local_mounts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job, marker = prepare_claimed_job(tmp_path)
    dispatcher = Dispatcher(tmp_path)

    def succeed(_command: list[str]) -> int:
        (job / "runner-output" / "results.csv").write_text(
            "TIME,V(out)\n0,0\n1e-6,0.1\n", encoding="utf-8"
        )
        return 0

    monkeypatch.setattr(dispatcher, "_run_podman", succeed)
    dispatcher._execute(marker)
    assert json.loads((job / "status.json").read_text())["status"] == "succeeded"
    assert json.loads((job / "summary.json").read_text())["samples"] == 2
    assert (job / "artifacts" / "results.csv").is_file()
    assert not marker.exists()
    assert not (job / "runner-input").exists()
    assert not (job / "runner-output").exists()


def test_dispatcher_records_timeout_and_does_not_execute_twice(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job, marker = prepare_claimed_job(tmp_path)
    dispatcher = Dispatcher(tmp_path)
    calls = 0

    def time_out(_command: list[str]) -> int:
        nonlocal calls
        calls += 1
        return 124

    monkeypatch.setattr(dispatcher, "_run_podman", time_out)
    dispatcher._execute(marker)
    dispatcher._execute(marker)
    assert calls == 1
    assert json.loads((job / "status.json").read_text())["status"] == "timed_out"
    assert json.loads((job / "summary.json").read_text())["error"] == "simulation_timeout"


@pytest.mark.parametrize(
    "text",
    [
        "TIME,V(out)\n0,nan\n",
        "TIME,V(out)\n0,0\n1,1\n0.5,2\n",
        "TIME,TIME\n0,0\n",
        "TIME,V(out)\n0\n",
        "TIME,V(out)\n",
    ],
)
def test_results_reject_invalid_data(tmp_path: Path, text: str) -> None:
    result = tmp_path / "results.csv"
    result.write_text(text, encoding="utf-8")
    with pytest.raises(ResultValidationError):
        validate_results(result, "tran")
