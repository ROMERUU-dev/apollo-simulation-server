from __future__ import annotations

import math
import re
from collections.abc import Sequence

MAX_BYTES = 64 * 1024
MAX_LINES = 2000
MAX_LINE_CHARS = 512
MAX_DEVICES = 512
MAX_MODEL_PARAMS = 32
MAX_OUTPUTS = 64
MAX_MODELS = 64
MAX_NODES = 256
MAX_SUBCIRCUITS = 32
ALLOWED_DIRECTIVES = {
    ".TRAN",
    ".DC",
    ".AC",
    ".MODEL",
    ".PARAM",
    ".FUNC",
    ".SUBCKT",
    ".ENDS",
    ".IC",
    ".NODESET",
    ".OPTIONS",
    ".PRINT",
    ".END",
}
BLOCKED_DIRECTIVES = {
    ".INCLUDE",
    ".INC",
    ".LIB",
    ".CONTROL",
    ".ENDC",
    ".LOAD",
    ".PLUGIN",
    ".PREPROCESS",
    ".DATA",
}
DEVICE_PREFIXES = frozenset("RCLVIDQMJBSEFGHWX")
SAFE_OPTIONS = frozenset({"TIMEINT", "NONLIN"})
MODEL_FAMILIES = frozenset({"NMOS", "PMOS"})
MODEL_PARAMS = frozenset(
    {
        "CBD",
        "CBS",
        "CGBO",
        "CGDO",
        "CGSO",
        "CJ",
        "CJSW",
        "FC",
        "GAMMA",
        "IS",
        "JS",
        "KP",
        "LAMBDA",
        "LD",
        "LEVEL",
        "MJ",
        "MJSW",
        "NSUB",
        "NSS",
        "PB",
        "PHI",
        "RD",
        "RS",
        "TOX",
        "TPG",
        "UO",
        "VTO",
        "WD",
        "XJ",
    }
)
MODEL_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_.$:+-]{0,63}$")
OUTPUT_RE = re.compile(
    r"^(?:V\([A-Za-z0-9_.$:+-]+(?:,[A-Za-z0-9_.$:+-]+)?\)|I\([A-Za-z0-9_.$:+-]+\))$",
    re.IGNORECASE,
)
DC_AXIS_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_.$:+-]{0,127}$")


def revalidate(netlist: str, outputs: Sequence[object]) -> str:
    if len(netlist.encode("utf-8")) > MAX_BYTES or "\x00" in netlist:
        raise ValueError("invalid netlist")
    lines = netlist.splitlines()
    if not 1 <= len(lines) <= MAX_LINES:
        raise ValueError("invalid netlist")
    analyses: list[str] = []
    nodes: set[str] = set()
    devices = 0
    models = 0
    subcircuits = 0
    depth = 0
    prints = 0
    temps = 0
    dc_axis: str | None = None
    for line in lines:
        if len(line) > MAX_LINE_CHARS or any(ord(char) < 32 and char != "\t" for char in line):
            raise ValueError("invalid netlist")
        text = line.strip()
        if not text or text.startswith("*") or text.startswith("+"):
            continue
        tokens = text.split()
        first = tokens[0].upper()
        lowered_tokens = [token.lower() for token in tokens]
        if any(
            "/" in token or "\\" in token or ".." in token or "://" in token
            for token in lowered_tokens
        ):
            raise ValueError("invalid netlist")
        if first.startswith("."):
            if first in BLOCKED_DIRECTIVES or first not in ALLOWED_DIRECTIVES:
                raise ValueError("invalid netlist")
            if first in {".TRAN", ".DC", ".AC"}:
                analyses.append(first[1:].lower())
                if first == ".DC":
                    if len(tokens) != 5 or not DC_AXIS_RE.fullmatch(tokens[1]):
                        raise ValueError("invalid dc")
                    dc_axis = tokens[1]
            if first == ".MODEL":
                models += 1
                _validate_model(tokens)
            if first == ".SUBCKT":
                subcircuits += 1
                depth += 1
                if len(tokens) < 3:
                    raise ValueError("invalid netlist")
                nodes.update(token.lower() for token in tokens[2:] if "=" not in token)
                if depth > 8:
                    raise ValueError("invalid netlist")
            if first == ".ENDS":
                depth -= 1
                if depth < 0:
                    raise ValueError("invalid netlist")
            if first == ".OPTIONS":
                if _is_temperature_option(tokens):
                    temps += 1
                    _validate_temp_option(tokens)
                elif len(tokens) < 2 or tokens[1].upper() not in SAFE_OPTIONS:
                    raise ValueError("invalid netlist")
            if first == ".PRINT":
                prints += 1
            continue
        if first[0] not in DEVICE_PREFIXES:
            raise ValueError("invalid netlist")
        nodes.update(_device_nodes(first[0], tokens))
        devices += 1
    if (
        len(analyses) != 1
        or depth != 0
        or devices > MAX_DEVICES
        or len(nodes) > MAX_NODES
        or models > MAX_MODELS
        or subcircuits > MAX_SUBCIRCUITS
        or prints != 1
        or temps > 1
    ):
        raise ValueError("invalid netlist")
    if not 1 <= len(outputs) <= MAX_OUTPUTS:
        raise ValueError("invalid outputs")
    if any(not isinstance(item, str) or not OUTPUT_RE.fullmatch(item) for item in outputs):
        raise ValueError("invalid outputs")
    printed = ([dc_axis] if analyses[0] == "dc" and dc_axis else []) + [
        str(item) for item in outputs
    ]
    expected_print = f".PRINT {analyses[0].upper()} FORMAT=CSV " + " ".join(printed)
    if expected_print not in lines:
        raise ValueError("invalid normalized print")
    return analyses[0]


def _device_nodes(prefix: str, tokens: list[str]) -> list[str]:
    if len(tokens) < 3:
        raise ValueError("invalid netlist")
    if prefix == "X":
        positional = [
            token for token in tokens[1:] if "=" not in token and token.upper() != "PARAMS:"
        ]
        if len(positional) < 2:
            raise ValueError("invalid netlist")
        return positional[:-1]
    counts = {"Q": 3, "M": 4, "J": 3, "S": 4, "W": 2, "E": 4, "G": 4, "F": 2, "H": 2}
    count = counts.get(prefix, 2)
    if len(tokens) < count + 2:
        raise ValueError("invalid netlist")
    return tokens[1 : count + 1]


def _is_temperature_option(tokens: list[str]) -> bool:
    return (
        len(tokens) == 3
        and tokens[0].upper() == ".OPTIONS"
        and tokens[1].upper() == "DEVICE"
        and tokens[2].upper().startswith("TEMP=")
    )


def _validate_temp_option(tokens: list[str]) -> None:
    if not _is_temperature_option(tokens):
        raise ValueError("invalid temp")
    _name, _separator, raw = tokens[2].partition("=")
    try:
        value = float(raw)
    except ValueError as exc:
        raise ValueError("invalid temp") from exc
    if not math.isfinite(value) or not -100.0 <= value <= 200.0:
        raise ValueError("invalid temp")


def _validate_model(tokens: list[str]) -> None:
    if len(tokens) < 4 or not MODEL_NAME_RE.fullmatch(tokens[1]):
        raise ValueError("invalid model")
    if tokens[2].upper() not in MODEL_FAMILIES:
        raise ValueError("invalid model")
    params = _model_params(tokens[3:])
    if not 1 <= len(params) <= MAX_MODEL_PARAMS:
        raise ValueError("invalid model")
    seen: set[str] = set()
    for name, value in params:
        upper = name.upper()
        if upper in seen or upper not in MODEL_PARAMS:
            raise ValueError("invalid model")
        seen.add(upper)
        _validate_model_value(value)


def _model_params(tokens: list[str]) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    for token in tokens:
        item = token
        while item.startswith("("):
            item = item[1:]
        while item.endswith(")"):
            item = item[:-1]
        if not item:
            continue
        name, separator, value = item.partition("=")
        if not separator:
            raise ValueError("invalid model")
        result.append((name, value))
    return result


def _validate_model_value(value: str) -> None:
    if not value or len(value) > 64 or any(char in value for char in "{}?<>!&|%"):
        raise ValueError("invalid model")
    try:
        numeric = float(_strip_spice_suffix(value))
    except ValueError as exc:
        raise ValueError("invalid model") from exc
    if not math.isfinite(numeric):
        raise ValueError("invalid model")


def _strip_spice_suffix(value: str) -> str:
    lowered = value.lower()
    for suffix in ("meg", "mil"):
        if lowered.endswith(suffix):
            return value[: -len(suffix)]
    if lowered[-1:] in {"t", "g", "k", "m", "u", "n", "p", "f", "a"}:
        return value[:-1]
    return value
