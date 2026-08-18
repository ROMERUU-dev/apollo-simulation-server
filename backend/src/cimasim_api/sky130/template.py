"""Server-managed SKY130 floating-bulk oscillator template.

The browser never sends a netlist, a path or a SPICE directive for this
template: it sends allowlisted numeric parameters. The netlist below is built
by trusted server-side code, which is the only place the PDK library path
exists. Nothing here is reachable from the free-form custom netlist parser,
whose policy (no ``.LIB``, no ``.INCLUDE``, no ``/``) stays untouched.
"""

from __future__ import annotations

import math
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TEMPLATE_ID: Final[Literal["sky130_floating_bulk_v1"]] = "sky130_floating_bulk_v1"

# Closed allowlists. Widening these is a deliberate, reviewed change.
DEVICES: Final = frozenset({"sky130_fd_pr__nfet_g5v0d10v5"})
CORNERS: Final = frozenset({"tt"})

# The container-side PDK root. Mounted read-only by the dispatcher. This
# constant is the ONLY source of the library path; it is never accepted from,
# nor echoed to, a request.
PDK_CONTAINER_ROOT: Final = "/pdks/sky130A"
PDK_LIBRARY: Final = f"{PDK_CONTAINER_ROOT}/libs.tech/ngspice/sky130.lib.spice"

OUTPUTS: Final = ("V(vout)", "V(vb)", "V(vg)")


def _num(value: float) -> str:
    """Deterministic formatting so backend and runner emit identical bytes."""
    return format(float(value), ".12g")


class Sky130FloatingBulkParameters(BaseModel):
    """Structured, range-checked parameters. No expressions, no paths, no SPICE."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    device: str = "sky130_fd_pr__nfet_g5v0d10v5"
    corner: str = "tt"

    # geometry, micrometres (the PDK declares .option scale=1.0u)
    l_um: float = Field(default=0.5, gt=0.0, le=100.0)
    w_um: float = Field(default=1.0, gt=0.0, le=100.0)
    nf: int = Field(default=1, ge=1, le=64)

    # sources and passives, SI units
    iin_a: float = Field(default=100e-9, gt=0.0, le=1e-3)
    cpar_f: float = Field(default=1e-12, gt=0.0, le=1e-6)
    rgate_ohm: float = Field(default=1e14, ge=1.0, le=1e18)
    rbulk_ohm: float = Field(default=1e14, ge=1.0, le=1e18)
    cgate_f: float = Field(default=1e-15, gt=0.0, le=1e-6)
    cbulk_f: float = Field(default=10e-15, gt=0.0, le=1e-6)

    temperature_celsius: float = Field(default=27.0, ge=-100.0, le=200.0)
    tstop_seconds: float = Field(default=1e-3, gt=0.0, le=1.0)
    output_interval_seconds: float = Field(default=50e-9, gt=0.0, le=1e-3)

    @field_validator("device")
    @classmethod
    def check_device(cls, value: str) -> str:
        if value not in DEVICES:
            raise ValueError("unsupported device")
        return value

    @field_validator("corner")
    @classmethod
    def check_corner(cls, value: str) -> str:
        if value not in CORNERS:
            raise ValueError("unsupported corner")
        return value

    @field_validator(
        "l_um",
        "w_um",
        "iin_a",
        "cpar_f",
        "rgate_ohm",
        "rbulk_ohm",
        "cgate_f",
        "cbulk_f",
        "temperature_celsius",
        "tstop_seconds",
        "output_interval_seconds",
        mode="before",
    )
    @classmethod
    def check_finite_number(cls, value: object) -> object:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("parameter must be a JSON number")
        if not math.isfinite(float(value)):
            raise ValueError("parameter must be finite")
        return value

    @field_validator("nf", mode="before")
    @classmethod
    def check_integer(cls, value: object) -> object:
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError("nf must be a JSON integer")
        return value


def build_netlist(
    params: Sky130FloatingBulkParameters,
    *,
    library: str = PDK_LIBRARY,
    results: str = "results.csv",
) -> str:
    """Emit the trusted SKY130 netlist. ``library`` is server-side only."""
    if params.output_interval_seconds > params.tstop_seconds:
        raise ValueError("output interval cannot exceed tstop")
    return "".join(
        line + "\n"
        for line in (
            "* CimaSim sky130_floating_bulk_v1 - server-generated, do not edit",
            f'.lib "{library}" {params.corner}',
            "",
            f"IIN   0    vout  DC {_num(params.iin_a)}",
            f"CPAR  vout 0     {_num(params.cpar_f)}",
            "",
            f"XM1   vout vg 0 vb {params.device}",
            f"+ L={_num(params.l_um)} W={_num(params.w_um)} nf={params.nf}",
            "+ ad={int((nf+1)/2) * W/nf * 0.29}",
            "+ as={int((nf+2)/2) * W/nf * 0.29}",
            "",
            f"RGATE vg 0 {_num(params.rgate_ohm)}",
            f"CGATE vg 0 {_num(params.cgate_f)}",
            f"RBULK vb 0 {_num(params.rbulk_ohm)}",
            f"CBULK vb 0 {_num(params.cbulk_f)}",
            "",
            f".OPTIONS DEVICE TEMP={_num(params.temperature_celsius)}",
            f".OPTIONS OUTPUT INITIAL_INTERVAL={_num(params.output_interval_seconds)}",
            f".TRAN {_num(params.output_interval_seconds)} {_num(params.tstop_seconds)} UIC",
            f".PRINT TRAN FORMAT=CSV FILE={results} " + " ".join(OUTPUTS),
            ".END",
        )
    )
