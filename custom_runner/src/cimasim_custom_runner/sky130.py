"""Runner-side SKY130 template: independent validation and netlist generation.

Deliberate mirror of ``cimasim_api.sky130.template``. The runner never trusts a
netlist produced elsewhere for this template: it revalidates the numeric
parameters and rebuilds the netlist from them, exactly as the free-form custom
path revalidates with :mod:`cimasim_custom_runner.validation`. The library path
is a constant here too and is never read from the request.
"""

from __future__ import annotations

import math
from typing import Any, Final

TEMPLATE_ID: Final = "sky130_floating_bulk_v1"
DEVICES: Final = frozenset({"sky130_fd_pr__nfet_g5v0d10v5"})
CORNERS: Final = frozenset({"tt"})

PDK_CONTAINER_ROOT: Final = "/pdks/sky130A"
PDK_LIBRARY: Final = f"{PDK_CONTAINER_ROOT}/libs.tech/ngspice/sky130.lib.spice"
OUTPUTS: Final = ("V(vout)", "V(vb)", "V(vg)")

# name -> (minimum, maximum, exclusive_minimum)
BOUNDS: Final[dict[str, tuple[float, float, bool]]] = {
    "l_um": (0.0, 100.0, True),
    "w_um": (0.0, 100.0, True),
    "iin_a": (0.0, 1e-3, True),
    "cpar_f": (0.0, 1e-6, True),
    "rgate_ohm": (1.0, 1e18, False),
    "rbulk_ohm": (1.0, 1e18, False),
    "cgate_f": (0.0, 1e-6, True),
    "cbulk_f": (0.0, 1e-6, True),
    "temperature_celsius": (-100.0, 200.0, False),
    "tstop_seconds": (0.0, 1.0, True),
    "output_interval_seconds": (0.0, 1e-3, True),
}


def _num(value: float) -> str:
    return format(float(value), ".12g")


def revalidate_parameters(raw: object) -> dict[str, Any]:
    """Re-check the stored parameters. Raises ValueError on anything unexpected."""
    if not isinstance(raw, dict):
        raise ValueError("invalid sky130 parameters")
    expected = set(BOUNDS) | {"device", "corner", "nf"}
    if set(raw) != expected:
        raise ValueError("invalid sky130 parameters")
    if raw["device"] not in DEVICES or raw["corner"] not in CORNERS:
        raise ValueError("invalid sky130 parameters")
    nf = raw["nf"]
    if isinstance(nf, bool) or not isinstance(nf, int) or not 1 <= nf <= 64:
        raise ValueError("invalid sky130 parameters")
    clean: dict[str, Any] = {"device": raw["device"], "corner": raw["corner"], "nf": nf}
    for name, (low, high, exclusive) in BOUNDS.items():
        value = raw[name]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("invalid sky130 parameters")
        number = float(value)
        if not math.isfinite(number):
            raise ValueError("invalid sky130 parameters")
        if number > high or (number <= low if exclusive else number < low):
            raise ValueError("invalid sky130 parameters")
        clean[name] = number
    if clean["output_interval_seconds"] > clean["tstop_seconds"]:
        raise ValueError("invalid sky130 parameters")
    return clean


def build_netlist(params: dict[str, Any], *, library: str = PDK_LIBRARY, results: str) -> str:
    """Rebuild the trusted netlist from revalidated parameters."""
    return "".join(
        line + "\n"
        for line in (
            "* CimaSim sky130_floating_bulk_v1 - server-generated, do not edit",
            f'.lib "{library}" {params["corner"]}',
            "",
            f"IIN   0    vout  DC {_num(params['iin_a'])}",
            f"CPAR  vout 0     {_num(params['cpar_f'])}",
            "",
            f"XM1   vout vg 0 vb {params['device']}",
            f"+ L={_num(params['l_um'])} W={_num(params['w_um'])} nf={params['nf']}",
            "+ ad={int((nf+1)/2) * W/nf * 0.29}",
            "+ as={int((nf+2)/2) * W/nf * 0.29}",
            "",
            f"RGATE vg 0 {_num(params['rgate_ohm'])}",
            f"CGATE vg 0 {_num(params['cgate_f'])}",
            f"RBULK vb 0 {_num(params['rbulk_ohm'])}",
            f"CBULK vb 0 {_num(params['cbulk_f'])}",
            "",
            f".OPTIONS DEVICE TEMP={_num(params['temperature_celsius'])}",
            f".OPTIONS OUTPUT INITIAL_INTERVAL={_num(params['output_interval_seconds'])}",
            f".TRAN {_num(params['output_interval_seconds'])} {_num(params['tstop_seconds'])} UIC",
            f".PRINT TRAN FORMAT=CSV FILE={results} " + " ".join(OUTPUTS),
            ".END",
        )
    )
