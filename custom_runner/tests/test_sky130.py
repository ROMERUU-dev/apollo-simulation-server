import json
import os
from pathlib import Path

import pytest

from cimasim_custom_runner import sky130
from cimasim_custom_runner.dispatcher import podman_command

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
