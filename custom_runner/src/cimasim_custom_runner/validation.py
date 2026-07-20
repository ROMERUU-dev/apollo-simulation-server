from __future__ import annotations

import re
from collections.abc import Sequence

MAX_BYTES = 64 * 1024
MAX_LINES = 2000
MAX_LINE_CHARS = 512
MAX_DEVICES = 512
MAX_OUTPUTS = 64
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
DEVICE_PREFIXES = frozenset("RCLVIDQMJBSEFGHWX")
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
    devices = 0
    depth = 0
    prints = 0
    dc_axis: str | None = None
    for line in lines:
        if len(line) > MAX_LINE_CHARS or any(ord(char) < 32 and char != "\t" for char in line):
            raise ValueError("invalid netlist")
        text = line.strip()
        if not text or text.startswith("*") or text.startswith("+"):
            continue
        tokens = text.split()
        first = tokens[0].upper()
        if any("/" in token or "\\" in token or ".." in token for token in tokens):
            raise ValueError("invalid netlist")
        if first.startswith("."):
            if first not in ALLOWED_DIRECTIVES:
                raise ValueError("invalid netlist")
            if first in {".TRAN", ".DC", ".AC"}:
                analyses.append(first[1:].lower())
                if first == ".DC":
                    if len(tokens) != 5 or not DC_AXIS_RE.fullmatch(tokens[1]):
                        raise ValueError("invalid dc")
                    dc_axis = tokens[1]
            if first == ".SUBCKT":
                depth += 1
                if depth > 8:
                    raise ValueError("invalid netlist")
            if first == ".ENDS":
                depth -= 1
            if first == ".PRINT":
                prints += 1
            continue
        if first[0] not in DEVICE_PREFIXES:
            raise ValueError("invalid netlist")
        devices += 1
    if len(analyses) != 1 or depth != 0 or devices > MAX_DEVICES or prints != 1:
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
