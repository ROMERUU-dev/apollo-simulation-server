from __future__ import annotations

import math
import re
from dataclasses import asdict, dataclass
from importlib.resources import files
from typing import Final

MIN_DURATION_TAU_RATIO: Final = 0.01
MAX_DURATION_TAU_RATIO: Final = 1000.0
MAX_NUMERIC_REPRESENTATION: Final = 32
PARAMETER_KEYS: Final = {
    "resistance_ohms",
    "capacitance_farads",
    "input_voltage_volts",
    "duration_seconds",
}
SAFE_NUMBER_RE: Final = re.compile(r"^[+-]?[0-9]+\.[0-9]+e[+-][0-9]+$")


class RcParameterError(ValueError):
    """Raised when bounded RC parameters are invalid."""


@dataclass(frozen=True)
class RcParameters:
    resistance_ohms: float
    capacitance_farads: float
    input_voltage_volts: float
    duration_seconds: float

    @property
    def time_constant_seconds(self) -> float:
        return self.resistance_ohms * self.capacitance_farads

    @property
    def time_step_seconds(self) -> float:
        return self.duration_seconds / 2000.0

    def as_dict(self) -> dict[str, float]:
        return asdict(self)


def parse_rc_parameters(value: object) -> RcParameters:
    if not isinstance(value, dict) or set(value) != PARAMETER_KEYS:
        raise RcParameterError("parameter schema is invalid")
    parsed: dict[str, float] = {}
    for key in PARAMETER_KEYS:
        raw = value[key]
        if isinstance(raw, bool) or not isinstance(raw, (int, float)):
            raise RcParameterError("parameters must be JSON numbers")
        if len(str(raw)) > MAX_NUMERIC_REPRESENTATION or not math.isfinite(float(raw)):
            raise RcParameterError("parameter is not a bounded finite number")
        parsed[key] = float(raw)

    parameters = RcParameters(**parsed)
    limits = {
        "resistance_ohms": (1.0, 10_000_000.0),
        "capacitance_farads": (1e-12, 1e-2),
        "input_voltage_volts": (0.001, 10.0),
        "duration_seconds": (1e-6, 1.0),
    }
    for key, (minimum, maximum) in limits.items():
        if not minimum <= getattr(parameters, key) <= maximum:
            raise RcParameterError("parameter is outside the supported range")

    tau = parameters.time_constant_seconds
    ratio = parameters.duration_seconds / tau
    if not math.isfinite(tau) or tau <= 0:
        raise RcParameterError("RC time constant is invalid")
    if not MIN_DURATION_TAU_RATIO <= ratio <= MAX_DURATION_TAU_RATIO:
        raise RcParameterError("simulation duration is outside the supported RC range")
    if not math.isfinite(parameters.time_step_seconds) or parameters.time_step_seconds < 5e-10:
        raise RcParameterError("simulation time step is outside the supported range")
    return parameters


def format_scientific(value: float) -> str:
    if not math.isfinite(value):
        raise RcParameterError("numeric value must be finite")
    formatted = f"{value:.12e}"
    if not SAFE_NUMBER_RE.fullmatch(formatted):
        raise RcParameterError("numeric value could not be formatted safely")
    return formatted


def render_parameterized_netlist(parameters: RcParameters) -> str:
    template = (
        files("cimasim_worker.templates")
        .joinpath("rc_lowpass_param.cir")
        .read_text(encoding="ascii")
    )
    replacements = {
        "@RESISTANCE@": format_scientific(parameters.resistance_ohms),
        "@CAPACITANCE@": format_scientific(parameters.capacitance_farads),
        "@INPUT_VOLTAGE@": format_scientific(parameters.input_voltage_volts),
        "@DURATION@": format_scientific(parameters.duration_seconds),
        "@TIME_STEP@": format_scientific(parameters.time_step_seconds),
        "@PULSE_WIDTH@": format_scientific(parameters.duration_seconds * 2.0),
        "@PULSE_PERIOD@": format_scientific(parameters.duration_seconds * 4.0),
    }
    rendered = template
    for token, number in replacements.items():
        if token not in rendered:
            raise RcParameterError("internal RC template is invalid")
        rendered = rendered.replace(token, number)
    if "@" in rendered:
        raise RcParameterError("internal RC template contains an unknown token")
    return rendered
