import json
import os
import stat
from collections.abc import Callable
from pathlib import Path

import pytest

from cimasim_custom_runner.dispatcher import (
    Dispatcher,
    _artifact_group,
    _publish_artifact,
    podman_command,
    validate_runner_image_id,
)
from cimasim_custom_runner.results import ResultValidationError, validate_results
from cimasim_custom_runner.runner import prepare_netlist

RUNNER_IMAGE_ID = "sha256:" + "a" * 64
ALT_GROUPS = [group for group in os.getgroups() if group != os.getgid()]
REPO_ROOT = Path(__file__).resolve().parents[2]


def test_podman_command_is_fixed_and_isolated(tmp_path: Path) -> None:
    input_dir = tmp_path / "input"
    output_dir = tmp_path / "output"
    command = podman_command(input_dir, output_dir, "tran", RUNNER_IMAGE_ID)
    joined = " ".join(command)
    assert command[0] == "podman"
    assert command.index("--cgroup-manager=cgroupfs") < command.index("run")
    assert command.count("run") == 1
    assert command[0:4] == ["podman", "--cgroup-manager=cgroupfs", "run", "--rm"]
    assert command.count("--uts=host") == 1
    assert "--hostname" not in command
    assert "--cgroups=disabled" not in command
    assert not any(item.startswith("--cgroup-conf") for item in command)
    assert not any(item.startswith("--cgroup-parent") for item in command)
    assert "--network=none" in command
    assert "--userns=keep-id:uid=10005,gid=10005" in command
    assert "--read-only" in command
    assert "--cap-drop=all" in command
    assert "--security-opt=no-new-privileges" in command
    assert "--memory=1g" in command
    assert "--cpus=1" in command
    assert "--pids-limit=64" in command
    assert "--tmpfs=/tmp:rw,size=64m,noexec,nosuid,nodev" in command
    assert "--ulimit=nofile=256:256" in command
    assert f"--volume={input_dir}:/input:ro,Z" in command
    assert f"--volume={output_dir}:/output:rw,Z" in command
    assert RUNNER_IMAGE_ID in command
    assert command[command.index(RUNNER_IMAGE_ID) + 1 :] == ["--analysis", "tran"]
    assert "docker.sock" not in joined
    assert "--privileged" not in command
    assert "--network=host" not in command


def test_custom_dispatcher_systemd_unit_keeps_validated_hardening() -> None:
    unit = (
        REPO_ROOT / "deploy" / "custom-dispatcher" / "cimasim-custom-dispatcher.service"
    )
    properties: dict[str, list[str]] = {}
    for raw_line in unit.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("[") or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        properties.setdefault(key, []).append(value)

    assert properties["ProtectHome"] == ["no"]
    assert properties["InaccessiblePaths"] == ["/home /root"]
    assert properties["ProtectHostname"] == ["yes"]
    assert properties["ProtectControlGroups"] == ["yes"]
    assert properties["Delegate"] == ["yes"]
    assert properties["CPUAccounting"] == ["yes"]
    assert properties["MemoryAccounting"] == ["yes"]
    assert properties["TasksAccounting"] == ["yes"]
    assert properties["MemoryMax"] == ["1073741824"]
    assert properties["CPUQuota"] == ["100%"]
    assert properties["TasksMax"] == ["64"]
    assert properties["ReadWritePaths"] == [
        "/var/lib/cimasim-custom-spool /var/lib/cimasim-runner /run/user/997"
    ]
    assert set(properties["ReadWritePaths"][0].split()) == {
        "/var/lib/cimasim-custom-spool",
        "/var/lib/cimasim-runner",
        "/run/user/997",
    }

    text = unit.read_text(encoding="utf-8")
    assert "ProtectHome=yes" not in text
    assert "PrivateDevices=no" not in text
    assert "PrivateNetwork=no" not in text
    assert "AmbientCapabilities" not in properties
    assert "RootDirectory" not in properties
    assert "docker.sock" not in text
    assert "network host" not in text
    assert "privileged" not in text
    capability_sets = properties.get("CapabilityBoundingSet", [])
    assert not any(value.strip() and value.strip() != "~" for value in capability_sets)
    bind_paths = " ".join(properties.get("BindPaths", []))
    assert "apollo" not in bind_paths.lower()


@pytest.mark.parametrize(
    "value",
    [
        "",
        "localhost/cimasim-custom-runner:review",
        "localhost/cimasim-custom-runner:fd34449",
        "sha256:" + "a" * 63,
        "sha256:" + "g" * 64,
        "sha256:" + "a" * 64 + " --privileged",
        " sha256:" + "a" * 64,
        "sha256:" + "a" * 64 + "\n",
    ],
)
def test_runner_image_must_be_full_sha256_id(value: str) -> None:
    with pytest.raises(ValueError):
        validate_runner_image_id(value)


def test_runner_image_accepts_full_sha256_id() -> None:
    assert validate_runner_image_id(RUNNER_IMAGE_ID) == RUNNER_IMAGE_ID


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
    source.write_text(
        "V1 in 0 1\nR1 in out 1k\n.OPTIONS DEVICE TEMP=25\n"
        ".TRAN 1u 1m\n.PRINT TRAN FORMAT=CSV V(out)\n.END\n",
        encoding="utf-8",
    )
    assert prepare_netlist(source, prepared, expected_analysis="tran") == "tran"
    rendered = prepared.read_text(encoding="utf-8")
    assert "FILE=/output/results.csv" in rendered
    assert ".INCLUDE" not in rendered


def test_runner_honors_explicit_output_path_for_host_gate(tmp_path: Path) -> None:
    source = tmp_path / "source.cir"
    prepared = tmp_path / "prepared.cir"
    output = tmp_path / "output" / "results.csv"
    output.parent.mkdir()
    source.write_text(
        "V1 in 0 1\nR1 in out 1k\n.OPTIONS DEVICE TEMP=25\n"
        ".TRAN 1u 1m\n.PRINT TRAN FORMAT=CSV V(out)\n.END\n",
        encoding="utf-8",
    )
    assert prepare_netlist(source, prepared, output, "tran") == "tran"
    assert f"FILE={output}" in prepared.read_text(encoding="utf-8")


def test_runner_rejects_analysis_mismatch(tmp_path: Path) -> None:
    source = tmp_path / "source.cir"
    prepared = tmp_path / "prepared.cir"
    output = tmp_path / "output" / "results.csv"
    output.parent.mkdir()
    source.write_text(
        "V1 in 0 1\nR1 in out 1k\n.OPTIONS DEVICE TEMP=25\n"
        ".TRAN 1u 1m\n.PRINT TRAN FORMAT=CSV V(out)\n.END\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="analysis mismatch"):
        prepare_netlist(source, prepared, output, "ac")


def prepare_claimed_job(root: Path) -> tuple[Path, Path]:
    job_id = "job_" + "a" * 32
    for name in ("queued", "claimed", "jobs", "state"):
        path = root / name
        path.mkdir()
        os.chmod(path, 0o2770)  # noqa: S103 - mirrors group-only production spool mode
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
                    "V1 in 0 1\nR1 in out 1k\n.OPTIONS DEVICE TEMP=25\n"
                    ".TRAN 1u 1m\n.PRINT TRAN FORMAT=CSV V(out)\n.END\n"
                ),
                "requested_outputs": ["V(out)"],
                "temperature_celsius": 25.0,
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
    dispatcher = Dispatcher(tmp_path, RUNNER_IMAGE_ID)

    def succeed(_command: list[str]) -> int:
        (job / "runner-output" / "results.csv").write_text(
            "TIME,V(out)\n0,0\n1e-6,0.1\n", encoding="utf-8"
        )
        return 0

    monkeypatch.setattr(dispatcher, "_run_podman", succeed)
    dispatcher._execute(marker)
    assert json.loads((job / "status.json").read_text())["status"] == "succeeded"
    assert json.loads((job / "summary.json").read_text())["samples"] == 2
    assert json.loads((job / "summary.json").read_text())["temperature_celsius"] == 25.0
    assert (job / "artifacts" / "results.csv").is_file()
    assert not marker.exists()
    assert not (job / "runner-input").exists()
    assert not (job / "runner-output").exists()
    heartbeat = json.loads((tmp_path / "state" / "dispatcher.json").read_text())
    assert heartbeat["status"] == "idle"
    assert heartbeat["runner_image_id"] == RUNNER_IMAGE_ID
    assert heartbeat["jobs_claimed_total"] == 0
    assert heartbeat["last_error_code"] is None


def test_dispatcher_records_timeout_and_does_not_execute_twice(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job, marker = prepare_claimed_job(tmp_path)
    dispatcher = Dispatcher(tmp_path, RUNNER_IMAGE_ID)
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
    heartbeat = json.loads((tmp_path / "state" / "dispatcher.json").read_text())
    assert heartbeat["last_error_code"] == "simulation_timeout"


def test_dispatcher_requires_existing_spool_state(tmp_path: Path) -> None:
    for name in ("queued", "claimed", "jobs"):
        path = tmp_path / name
        path.mkdir()
        os.chmod(path, 0o2770)  # noqa: S103 - mirrors group-only production spool mode
    os.chmod(tmp_path, 0o2770)  # noqa: S103 - mirrors group-only production spool mode
    dispatcher = Dispatcher(tmp_path, RUNNER_IMAGE_ID)
    with pytest.raises(ValueError):
        dispatcher.run()


@pytest.mark.parametrize(
    "netlist",
    [
        "V1 in 0 1\nR1 in out 1k\n.OPTIONS DEVICE TEMP=25\n"
        ".OPTIONS DEVICE TEMP=30\n.TRAN 1u 1m\n"
        ".PRINT TRAN FORMAT=CSV V(out)\n.END\n",
        "V1 in 0 1\nR1 in out 1k\n.MODEL N NMOS (LEVEL=1 UNKNOWN=1)\n.TRAN 1u 1m\n"
        ".PRINT TRAN FORMAT=CSV V(out)\n.END\n",
        "V1 in 0 1\nR1 in out 1k\n.INCLUDE secret.cir\n.TRAN 1u 1m\n"
        ".PRINT TRAN FORMAT=CSV V(out)\n.END\n",
    ],
)
def test_runner_revalidates_scientific_subset(netlist: str, tmp_path: Path) -> None:
    source = tmp_path / "source.cir"
    prepared = tmp_path / "prepared.cir"
    output = tmp_path / "output" / "results.csv"
    output.parent.mkdir()
    source.write_text(netlist, encoding="utf-8")
    with pytest.raises(ValueError):
        prepare_netlist(source, prepared, output, "tran")


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


RESULTS_CSV = "TIME,V(out)\n0,0\n1e-6,0.1\n"


def succeeding_run(job: Path) -> Callable[[list[str]], int]:
    def run(_command: list[str]) -> int:
        (job / "runner-output" / "results.csv").write_text(RESULTS_CSV, encoding="utf-8")
        return 0

    return run


@pytest.mark.skipif(not ALT_GROUPS, reason="requires a second group to retarget the artifact")
def test_published_artifact_adopts_artifacts_directory_group(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Reproduces the bug: os.replace kept the runner-output group, locking the API out."""
    job, marker = prepare_claimed_job(tmp_path)
    artifacts = job / "artifacts"
    os.chown(artifacts, -1, ALT_GROUPS[0])
    dispatcher = Dispatcher(tmp_path, RUNNER_IMAGE_ID)
    monkeypatch.setattr(dispatcher, "_run_podman", succeeding_run(job))

    dispatcher._execute(marker)

    published = artifacts / "results.csv"
    info = published.stat(follow_symlinks=False)
    assert json.loads((job / "status.json").read_text())["status"] == "succeeded"
    assert stat.S_ISREG(info.st_mode)
    assert info.st_gid == ALT_GROUPS[0] != os.getgid()
    assert stat.S_IMODE(info.st_mode) == 0o660
    assert published.read_text(encoding="utf-8") == RESULTS_CSV


def test_artifact_group_selects_the_artifacts_directory_group(tmp_path: Path) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    assert _artifact_group(artifacts) == artifacts.stat().st_gid


def test_artifact_group_rejects_symlinked_artifacts_directory(tmp_path: Path) -> None:
    real = tmp_path / "real"
    real.mkdir()
    link = tmp_path / "artifacts"
    link.symlink_to(real, target_is_directory=True)
    with pytest.raises(ValueError, match="invalid artifacts directory"):
        _artifact_group(link)


def test_artifact_group_rejects_group_the_dispatcher_is_not_in(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    monkeypatch.setattr(os, "getgid", lambda: artifacts.stat().st_gid + 1)
    monkeypatch.setattr(os, "getgroups", list)
    with pytest.raises(ValueError, match="does not belong to the artifact group"):
        _artifact_group(artifacts)


def test_publish_artifact_rejects_non_regular_destination(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    source = tmp_path / "results.csv"
    source.write_text(RESULTS_CSV, encoding="utf-8")
    destination = artifacts / "results.csv"
    real_fstat = os.fstat

    def fifo_shaped(descriptor: int) -> os.stat_result:
        info = real_fstat(descriptor)
        return os.stat_result((stat.S_IFIFO | 0o660, *tuple(info)[1:]))

    monkeypatch.setattr(os, "fstat", fifo_shaped)
    with pytest.raises(ValueError, match="not a regular file"):
        _publish_artifact(source, destination, artifacts.stat().st_gid)
    assert not destination.exists()


def test_dispatcher_fails_closed_when_group_change_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job, marker = prepare_claimed_job(tmp_path)
    dispatcher = Dispatcher(tmp_path, RUNNER_IMAGE_ID)
    monkeypatch.setattr(dispatcher, "_run_podman", succeeding_run(job))

    def denied(*_args: int) -> None:
        raise PermissionError("group change denied")

    monkeypatch.setattr(os, "fchown", denied)
    dispatcher._execute(marker)

    assert json.loads((job / "status.json").read_text())["status"] == "failed"
    assert json.loads((job / "summary.json").read_text())["error"] == "simulation_failed"
    assert json.loads((job / "summary.json").read_text())["artifacts"] == []
    assert not (job / "artifacts" / "results.csv").exists()
    heartbeat = json.loads((tmp_path / "state" / "dispatcher.json").read_text())
    assert heartbeat["last_error_code"] == "dispatcher_error"
    assert heartbeat["status"] == "idle"


def test_dispatcher_fails_closed_when_mode_change_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job, marker = prepare_claimed_job(tmp_path)
    dispatcher = Dispatcher(tmp_path, RUNNER_IMAGE_ID)
    monkeypatch.setattr(dispatcher, "_run_podman", succeeding_run(job))
    real_fchmod = os.fchmod
    real_fchown = os.fchown
    armed = False

    def arm(descriptor: int, uid: int, group: int) -> None:
        nonlocal armed
        armed = True
        real_fchown(descriptor, uid, group)

    def denied_once(descriptor: int, mode: int) -> None:
        nonlocal armed
        if armed:
            armed = False
            raise PermissionError("mode change denied")
        real_fchmod(descriptor, mode)

    monkeypatch.setattr(os, "fchown", arm)
    monkeypatch.setattr(os, "fchmod", denied_once)
    dispatcher._execute(marker)

    assert json.loads((job / "status.json").read_text())["status"] == "failed"
    assert json.loads((job / "summary.json").read_text())["artifacts"] == []
    assert not (job / "artifacts" / "results.csv").exists()
