import json
import os
from pathlib import Path

import pytest

from cimasim_custom_runner import sky130
from cimasim_custom_runner.dispatcher import Dispatcher, _read_request, podman_command

RUNNER_IMAGE_ID = "sha256:" + "a" * 64

BASELINE = {
    "device": "sky130_fd_pr__nfet_g5v0d10v5",
    "corner": "tt",
    "l_um": 0.5,
    "w_um": 1.0,
    "nf": 1,
    "iin_a": 100e-9,
    "cpar_f": 1e-12,
    "rgate_ohm": 1e14,
    "rbulk_ohm": 1e14,
    "cgate_f": 1e-15,
    "cbulk_f": 10e-15,
    "temperature_celsius": 27.0,
    "tstop_seconds": 1e-3,
    "output_interval_seconds": 50e-9,
}

# Golden netlist: pinned so drift between the backend and runner generators,
# or an accidental change to the trusted library path, fails a test.
GOLDEN = """* CimaSim sky130_floating_bulk_v1 - server-generated, do not edit
.lib "/pdks/sky130A/libs.tech/ngspice/sky130.lib.spice" tt

IIN   0    vout  DC 1e-07
CPAR  vout 0     1e-12

XM1   vout vg 0 vb sky130_fd_pr__nfet_g5v0d10v5
+ L=0.5 W=1 nf=1
+ ad={int((nf+1)/2) * W/nf * 0.29}
+ as={int((nf+2)/2) * W/nf * 0.29}

RGATE vg 0 1e+14
CGATE vg 0 1e-15
RBULK vb 0 1e+14
CBULK vb 0 1e-14

.OPTIONS DEVICE TEMP=27
.OPTIONS OUTPUT INITIAL_INTERVAL=5e-08
.TRAN 5e-08 0.001 UIC
.PRINT TRAN FORMAT=CSV FILE=/output/results.csv V(vout) V(vb) V(vg)
.END
"""


def test_baseline_netlist_is_byte_exact() -> None:
    params = sky130.revalidate_parameters(dict(BASELINE))
    assert sky130.build_netlist(params, results="/output/results.csv") == GOLDEN


def test_netlist_never_contains_a_host_path() -> None:
    params = sky130.revalidate_parameters(dict(BASELINE))
    netlist = sky130.build_netlist(params, results="/output/results.csv")
    assert "/home/" not in netlist
    directives = [ln for ln in netlist.splitlines() if ln.upper().startswith(".LIB")]
    assert len(directives) == 1
    assert sky130.PDK_CONTAINER_ROOT in netlist


@pytest.mark.parametrize(
    "override",
    [
        {"device": "sky130_fd_pr__nfet_01v8"},  # dispositivo no permitido
        {"corner": "ss"},  # corner no permitido
        {"corner": "../../etc/passwd"},  # intento de path por el corner
        {"l_um": float("inf")},
        {"l_um": float("nan")},
        {"w_um": "1"},  # string en vez de numero
        {"w_um": 0.0},  # exclusive minimum
        {"nf": 0},
        {"nf": True},  # bool no es int valido
        {"nf": 1.0},  # float no es int
        {"iin_a": 1.0},  # fuera de rango
        {"rbulk_ohm": -1.0},
        {"temperature_celsius": 500.0},
        {"tstop_seconds": 10.0},
        {"output_interval_seconds": 2e-3},  # > tstop
    ],
)
def test_revalidate_rejects_bad_parameters(override: dict) -> None:
    raw = dict(BASELINE) | override
    with pytest.raises(ValueError):
        sky130.revalidate_parameters(raw)


def test_revalidate_rejects_unexpected_and_missing_keys() -> None:
    with pytest.raises(ValueError):
        sky130.revalidate_parameters(dict(BASELINE) | {"netlist": ".lib /etc/passwd tt"})
    incomplete = dict(BASELINE)
    del incomplete["l_um"]
    with pytest.raises(ValueError):
        sky130.revalidate_parameters(incomplete)
    with pytest.raises(ValueError):
        sky130.revalidate_parameters("not a dict")


def test_podman_command_mounts_the_pdk_read_only_and_keeps_hardening() -> None:
    command = podman_command(
        Path("/in"),
        Path("/out"),
        "tran",
        RUNNER_IMAGE_ID,
        template=sky130.TEMPLATE_ID,
        pdk_root=Path("/home/romeruu/pdk/sky130A"),
    )
    joined = " ".join(command)
    assert f"--volume=/home/romeruu/pdk/sky130A:{sky130.PDK_CONTAINER_ROOT}:ro,Z" in command
    mounts = [item for item in command if item.startswith("--volume=")]
    assert sum(1 for m in mounts if m.endswith(":ro,Z")) == 2  # /input y el PDK
    assert sum(1 for m in mounts if ":rw" in m) == 1  # solo /output
    # el hardening validado no cambia
    for flag in (
        "--network=none",
        "--read-only",
        "--cap-drop=all",
        "--security-opt=no-new-privileges",
        "--memory=1g",
        "--cpus=1",
        "--pids-limit=64",
        "--uts=host",
        "--cgroup-manager=cgroupfs",
    ):
        assert flag in command
    assert "--privileged" not in joined
    assert "--cap-add" not in joined
    assert command[-2:] == ["--template", sky130.TEMPLATE_ID]


def test_pdk_is_not_mounted_for_the_free_form_custom_path() -> None:
    command = podman_command(Path("/in"), Path("/out"), "tran", RUNNER_IMAGE_ID)
    joined = " ".join(command)
    assert "/pdks" not in joined
    assert "--template" not in joined
    assert sum(1 for item in command if item.startswith("--volume=")) == 2


def test_runner_builds_from_params_and_ignores_any_supplied_netlist(tmp_path: Path) -> None:
    from cimasim_custom_runner import runner

    params = tmp_path / "params.json"
    params.write_text(json.dumps(BASELINE), encoding="utf-8")
    prepared, out = tmp_path / "prepared.cir", tmp_path / "results.csv"
    # una netlist hostil en /input no puede influir: el runner no la lee
    (tmp_path / "netlist.cir").write_text(".lib /etc/shadow tt\n.END\n", encoding="utf-8")
    assert runner.prepare_sky130_netlist(params, prepared, out) == "tran"
    text = prepared.read_text()
    assert "/etc/shadow" not in text
    assert text == GOLDEN.replace("/output/results.csv", str(out))
    assert oct(os.stat(prepared).st_mode)[-3:] == "600"


def prepare_claimed_sky130_job(root: Path) -> tuple[Path, Path]:
    """Mirrors test_security.prepare_claimed_job, but for a real sky130 job:
    a request.json holding the actual server-generated netlist (with .lib),
    exercised through the real Dispatcher._execute -> _read_request path.
    This is the integration point the bug lived in: _read_request used to
    revalidate() *every* netlist through the free-form custom validator,
    which blocks .lib unconditionally -- so every sky130 job silently died
    inside _read_request before "request" was even assigned, leaving the job
    stuck at "queued" forever with no error surfaced anywhere.
    """
    job_id = "job_" + "b" * 32
    for name in ("queued", "claimed", "jobs", "state"):
        path = root / name
        path.mkdir(exist_ok=True)
        os.chmod(path, 0o2770)  # noqa: S103 - mirrors group-only production spool mode
    job = root / "jobs" / job_id
    (job / "artifacts").mkdir(parents=True)
    params = dict(BASELINE)
    netlist = sky130.build_netlist(sky130.revalidate_parameters(params), results="results.csv")
    (job / "request.json").write_text(
        json.dumps(
            {
                "job_id": job_id,
                "user_id": "opaque-owner",
                "name": "Oscilador",
                "template_id": sky130.TEMPLATE_ID,
                "netlist": netlist,
                "requested_outputs": list(sky130.OUTPUTS),
                "temperature_celsius": params["temperature_celsius"],
                "sky130_parameters": params,
                "created_at": "2026-07-20T00:00:00+00:00",
            }
        ),
        encoding="utf-8",
    )
    marker = root / "claimed" / f"{job_id}.json"
    marker.write_text("{}", encoding="utf-8")
    return job, marker


def test_read_request_does_not_revalidate_sky130_netlist_through_custom_parser(
    tmp_path: Path,
) -> None:
    """The netlist contains .lib, which BLOCKED_DIRECTIVES forbids for the
    free-form path. _read_request must not run it through revalidate()."""
    job, _marker = prepare_claimed_sky130_job(tmp_path)
    value = json.loads((job / "request.json").read_text())
    assert ".lib" in value["netlist"] or ".LIB" in value["netlist"].upper()
    parsed = _read_request(job / "request.json", job.name)
    assert parsed["analysis"] == "tran"


def test_sky130_job_reaches_succeeded_through_the_real_dispatcher(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """End-to-end through Dispatcher._execute, not just sky130.py/runner.py
    in isolation -- this is exactly the path the original bug hid in."""
    job, marker = prepare_claimed_sky130_job(tmp_path)
    dispatcher = Dispatcher(tmp_path, RUNNER_IMAGE_ID, pdk_root=Path("/pdks/sky130A"))

    def succeed(_command: list[str]) -> int:
        (job / "runner-output" / "results.csv").write_text(
            "TIME,V(VOUT),V(VB),V(VG)\n0,0,0,0\n5e-08,0.1,0.01,0.02\n",
            encoding="utf-8",
        )
        return 0

    monkeypatch.setattr(dispatcher, "_run_podman", succeed)
    dispatcher._execute(marker)

    status = json.loads((job / "status.json").read_text())
    assert status["status"] == "succeeded"
    summary = json.loads((job / "summary.json").read_text())
    assert summary["error"] is None
    assert summary["samples"] == 2
    assert (job / "artifacts" / "results.csv").is_file()
    assert not marker.exists()
    heartbeat = json.loads((tmp_path / "state" / "dispatcher.json").read_text())
    assert heartbeat["status"] == "idle"
    assert heartbeat["last_error_code"] is None


def test_sky130_job_fails_closed_when_dispatcher_lacks_pdk_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job, marker = prepare_claimed_sky130_job(tmp_path)
    dispatcher = Dispatcher(tmp_path, RUNNER_IMAGE_ID)  # no pdk_root

    def unexpected_call(_command: list[str]) -> int:
        raise AssertionError("podman must not run without a configured pdk_root")

    monkeypatch.setattr(dispatcher, "_run_podman", unexpected_call)
    dispatcher._execute(marker)

    status = json.loads((job / "status.json").read_text())
    assert status["status"] == "failed"
