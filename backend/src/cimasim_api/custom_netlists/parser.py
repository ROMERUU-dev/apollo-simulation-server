from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Final, Literal

MAX_BYTES: Final = 64 * 1024
MAX_LINES: Final = 2000
MAX_LINE_CHARS: Final = 512
MAX_DEVICES: Final = 512
MAX_NODES: Final = 256
MAX_MODELS: Final = 64
MAX_SUBCIRCUITS: Final = 32
MAX_SUBCIRCUIT_DEPTH: Final = 8
MAX_OUTPUTS: Final = 64
DEVICE_PREFIXES: Final = frozenset("RCLVIDQMJBSEFGHWX")
SAFE_DIRECTIVES: Final = frozenset(
    {
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
)
BLOCKED_DIRECTIVES: Final = frozenset(
    {".INCLUDE", ".INC", ".LIB", ".CONTROL", ".ENDC", ".LOAD", ".PLUGIN", ".PREPROCESS", ".DATA"}
)
SAFE_OPTIONS: Final = frozenset({"TIMEINT", "NONLIN"})
OUTPUT_RE: Final = re.compile(
    r"^(?:V\([A-Za-z0-9_.$:+-]+(?:,[A-Za-z0-9_.$:+-]+)?\)|"
    r"I\([A-Za-z0-9_.$:+-]+\))$",
    re.IGNORECASE,
)
SAFE_TOKEN_RE: Final = re.compile(r"^[A-Za-z0-9_.$:+*(){}=,?<>!&|%\-^]+$")
DC_AXIS_RE: Final = re.compile(r"^[A-Za-z][A-Za-z0-9_.$:+-]{0,127}$")


class NetlistValidationError(ValueError):
    def __init__(self, code: str, line: int | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.line = line


@dataclass(frozen=True)
class Statement:
    line: int
    kind: str
    tokens: tuple[str, ...]


@dataclass(frozen=True)
class ParsedNetlist:
    normalized: str
    analysis: Literal["tran", "dc", "ac"]
    devices: int
    nodes: int
    models: int
    subcircuits: int
    outputs: tuple[str, ...]
    statements: tuple[Statement, ...]


def parse_netlist(netlist: str, requested_outputs: list[str]) -> ParsedNetlist:
    if not isinstance(netlist, str):
        raise NetlistValidationError("NETLIST_TYPE")
    try:
        size = len(netlist.encode("utf-8", errors="strict"))
    except UnicodeError as exc:
        raise NetlistValidationError("NETLIST_UTF8") from exc
    if size == 0 or size > MAX_BYTES or "\x00" in netlist:
        raise NetlistValidationError("NETLIST_SIZE")
    outputs = _validate_outputs(requested_outputs)
    logical = _logical_lines(netlist.replace("\r\n", "\n").replace("\r", "\n"))
    statements: list[Statement] = []
    analyses: list[str] = []
    nodes: set[str] = set()
    device_count = model_count = subckt_count = depth = 0
    dc_axis: str | None = None
    normalized_lines: list[str] = []

    for line_number, text in logical:
        tokens = _tokenize(text, line_number)
        if not tokens:
            continue
        first = tokens[0]
        upper = first.upper()
        if upper.startswith("."):
            if upper in BLOCKED_DIRECTIVES or upper not in SAFE_DIRECTIVES:
                raise NetlistValidationError("DIRECTIVE_BLOCKED", line_number)
            if upper in {".TRAN", ".DC", ".AC"}:
                analyses.append(upper[1:].lower())
                if upper == ".DC":
                    if len(tokens) != 5 or not DC_AXIS_RE.fullmatch(tokens[1]):
                        raise NetlistValidationError("DC_SYNTAX", line_number)
                    dc_axis = tokens[1]
            elif upper == ".MODEL":
                model_count += 1
            elif upper == ".SUBCKT":
                subckt_count += 1
                depth += 1
                if len(tokens) < 3:
                    raise NetlistValidationError("SUBCIRCUIT_SYNTAX", line_number)
                nodes.update(token.lower() for token in tokens[2:] if "=" not in token)
                if depth > MAX_SUBCIRCUIT_DEPTH:
                    raise NetlistValidationError("SUBCIRCUIT_DEPTH", line_number)
            elif upper == ".ENDS":
                depth -= 1
                if depth < 0:
                    raise NetlistValidationError("SUBCIRCUIT_STRUCTURE", line_number)
            elif upper == ".OPTIONS":
                if len(tokens) < 2 or tokens[1].upper() not in SAFE_OPTIONS:
                    raise NetlistValidationError("OPTION_BLOCKED", line_number)
            statements.append(Statement(line_number, upper, tuple(tokens)))
            if upper != ".PRINT":
                normalized_lines.append(" ".join(tokens))
            continue

        prefix = first[0].upper()
        if prefix not in DEVICE_PREFIXES:
            raise NetlistValidationError("DEVICE_BLOCKED", line_number)
        device_count += 1
        for node in _device_nodes(prefix, tokens, line_number):
            if node != "0":
                nodes.add(node.lower())
        statements.append(Statement(line_number, prefix, tuple(tokens)))
        normalized_lines.append(" ".join(tokens))

    if len(analyses) != 1:
        raise NetlistValidationError("ANALYSIS_COUNT")
    if depth != 0:
        raise NetlistValidationError("SUBCIRCUIT_STRUCTURE")
    if device_count > MAX_DEVICES or len(nodes) > MAX_NODES:
        raise NetlistValidationError("TOPOLOGY_LIMIT")
    if model_count > MAX_MODELS or subckt_count > MAX_SUBCIRCUITS:
        raise NetlistValidationError("DEFINITION_LIMIT")
    if not normalized_lines or normalized_lines[-1].upper() != ".END":
        raise NetlistValidationError("END_REQUIRED")
    printed = ((dc_axis,) if analyses[0] == "dc" and dc_axis else ()) + outputs
    normalized_lines.insert(-1, f".PRINT {analyses[0].upper()} FORMAT=CSV " + " ".join(printed))
    return ParsedNetlist(
        normalized="\n".join(normalized_lines) + "\n",
        analysis=analyses[0],  # type: ignore[arg-type]
        devices=device_count,
        nodes=len(nodes),
        models=model_count,
        subcircuits=subckt_count,
        outputs=outputs,
        statements=tuple(statements),
    )


def _logical_lines(netlist: str) -> list[tuple[int, str]]:
    physical = netlist.split("\n")
    if len(physical) > MAX_LINES:
        raise NetlistValidationError("LINE_LIMIT")
    result: list[tuple[int, str]] = []
    for number, raw in enumerate(physical, start=1):
        if len(raw) > MAX_LINE_CHARS:
            raise NetlistValidationError("LINE_LENGTH", number)
        if any(ord(char) < 32 and char != "\t" for char in raw):
            raise NetlistValidationError("CONTROL_CHARACTER", number)
        stripped = raw.strip()
        if not stripped or stripped.startswith("*"):
            continue
        if stripped.startswith("+"):
            if not result:
                raise NetlistValidationError("CONTINUATION", number)
            original, previous = result[-1]
            result[-1] = (original, f"{previous} {stripped[1:].strip()}")
        else:
            result.append((number, stripped))
    return result


def _tokenize(text: str, line: int) -> list[str]:
    tokens = text.split()
    for token in tokens:
        lowered = token.lower()
        if (
            not SAFE_TOKEN_RE.fullmatch(token)
            or "/" in token
            or "\\" in token
            or ".." in token
            or "://" in lowered
        ):
            raise NetlistValidationError("TOKEN_BLOCKED", line)
    return tokens


def _device_nodes(prefix: str, tokens: list[str], line: int) -> list[str]:
    minimum = 3
    if len(tokens) < minimum:
        raise NetlistValidationError("DEVICE_SYNTAX", line)
    if prefix == "X":
        positional = [
            token for token in tokens[1:] if "=" not in token and token.upper() != "PARAMS:"
        ]
        if len(positional) < 2:
            raise NetlistValidationError("DEVICE_SYNTAX", line)
        return positional[:-1]
    counts = {"Q": 3, "M": 4, "J": 3, "S": 4, "W": 2, "E": 4, "G": 4, "F": 2, "H": 2}
    count = counts.get(prefix, 2)
    if len(tokens) < count + 2:
        raise NetlistValidationError("DEVICE_SYNTAX", line)
    return tokens[1 : count + 1]


def _validate_outputs(outputs: list[str]) -> tuple[str, ...]:
    if not isinstance(outputs, list) or not 1 <= len(outputs) <= MAX_OUTPUTS:
        raise NetlistValidationError("OUTPUT_LIMIT")
    normalized: list[str] = []
    seen: set[str] = set()
    for output in outputs:
        if not isinstance(output, str) or not OUTPUT_RE.fullmatch(output):
            raise NetlistValidationError("OUTPUT_INVALID")
        key = output.upper()
        if key in seen:
            raise NetlistValidationError("OUTPUT_DUPLICATE")
        seen.add(key)
        normalized.append(output)
    return tuple(normalized)
