from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from cimasim_custom_runner.results import validate_results


def xyce_710() -> str:
    xyce = shutil.which("Xyce")
    if xyce is None:
        pytest.skip("Xyce is not installed")
    version = subprocess.run(  # noqa: S603 - fixed Xyce binary discovered from PATH for host gate
        [xyce, "-v"],
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
    )
    if "Xyce Release 7.10" not in version.stdout + version.stderr:
        pytest.skip("Xyce 7.10 is not installed")
    return xyce


def run_xyce_real(tmp_path: Path, name: str, netlist: str, analysis: str) -> tuple[int, list[str]]:
    xyce = xyce_710()
    circuit = tmp_path / f"{name}.cir"
    result = tmp_path / f"{name}.csv"
    circuit.write_text(netlist.replace("RESULT_FILE", result.name), encoding="utf-8")
    completed = subprocess.run(  # noqa: S603 - fixed Xyce binary discovered from PATH for host gate
        [xyce, "-quiet", circuit.name],
        cwd=tmp_path,
        check=False,
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    assert "Unrecognized dot line" not in completed.stdout + completed.stderr
    return validate_results(result, analysis)


def test_xyce_real_rc_transient_dc_and_ac(tmp_path: Path) -> None:
    tran_rows, tran_columns = run_xyce_real(
        tmp_path,
        "rc_tran",
        """* real Xyce RC transient
V1 in 0 PULSE(0 1 0 1u 1u 1m 2m)
R1 in out 1k
C1 out 0 1u
.OPTIONS DEVICE TEMP=25
.TRAN 1u 5m
.PRINT TRAN FORMAT=CSV FILE=RESULT_FILE V(out)
.END
""",
        "tran",
    )
    assert tran_rows > 1
    assert tran_columns == ["TIME", "V(OUT)"]

    dc_rows, dc_columns = run_xyce_real(
        tmp_path,
        "rc_dc",
        """* real Xyce DC sweep
V1 in 0 0
R1 in out 1k
R2 out 0 1k
.OPTIONS DEVICE TEMP=25
.DC V1 0 5 0.5
.PRINT DC FORMAT=CSV FILE=RESULT_FILE V1 V(out)
.END
""",
        "dc",
    )
    assert dc_rows == 11
    assert dc_columns == ["V1", "V(OUT)"]

    ac_rows, ac_columns = run_xyce_real(
        tmp_path,
        "rc_ac",
        """* real Xyce AC analysis
V1 in 0 AC 1
R1 in out 1k
C1 out 0 1u
.OPTIONS DEVICE TEMP=25
.AC DEC 5 1 1e3
.PRINT AC FORMAT=CSV FILE=RESULT_FILE V(out)
.END
""",
        "ac",
    )
    assert ac_rows > 1
    assert ac_columns[0] == "FREQ"


@pytest.mark.parametrize("temperature", [25, 85])
def test_xyce_real_mosfet_transient_temperature(tmp_path: Path, temperature: int) -> None:
    rows, columns = run_xyce_real(
        tmp_path,
        f"mos_tran_{temperature}",
        f"""* real Xyce bounded NMOS transient
VDD vdd 0 DC 5
VIN gate 0 PULSE(0 5 0 1n 1n 10n 20n)
M1 out gate 0 0 NMOS_THESIS L=1u W=10u
RLOAD vdd out 10k
CLOAD out 0 1p
.MODEL NMOS_THESIS NMOS (LEVEL=1 VTO=0.7 KP=120u LAMBDA=0.02)
.OPTIONS DEVICE TEMP={temperature}
.TRAN 0.1n 80n
.PRINT TRAN FORMAT=CSV FILE=RESULT_FILE V(out) I(VDD)
.END
""",
        "tran",
    )
    assert rows > 10
    assert columns == ["TIME", "V(OUT)", "I(VDD)"]
