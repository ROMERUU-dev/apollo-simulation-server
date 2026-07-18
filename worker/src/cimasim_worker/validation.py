from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from pathlib import Path

MAX_RESULT_BYTES = 5 * 1024 * 1024
MIN_SAMPLES = 100
EXPECTED_COLUMNS = ("TIME", "V(IN)", "V(OUT)")


class ValidationError(RuntimeError):
    """Raised when Xyce output is missing, unsafe, or not the expected RC result."""


@dataclass(frozen=True)
class WaveformSummary:
    samples: int
    input_final: float
    output_final: float
    duration_seconds: float


def validate_workdir(workdir: Path, result_name: str = "waveform.prn") -> Path:
    allowed = {"input.cir", result_name, "xyce.log"}
    actual = {path.name for path in workdir.iterdir() if path.is_file()}
    unexpected = actual - allowed
    if unexpected:
        names = ", ".join(sorted(unexpected))
        raise ValidationError(f"unexpected Xyce output files: {names}")
    result_path = workdir / result_name
    if not result_path.is_file():
        raise ValidationError("expected Xyce waveform output was not produced")
    size = result_path.stat().st_size
    if size <= 0:
        raise ValidationError("Xyce waveform output is empty")
    if size > MAX_RESULT_BYTES:
        raise ValidationError("Xyce waveform output exceeds size limit")
    return result_path


def parse_xyce_prn(path: Path) -> tuple[list[str], list[list[float]]]:
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    if not lines:
        raise ValidationError("Xyce waveform output is empty")

    header = lines[0].split()
    if len(header) < 4 or header[0] != "Index":
        raise ValidationError("Xyce waveform header is not recognized")

    data_columns = header[1:]
    for column in EXPECTED_COLUMNS:
        if column not in data_columns:
            raise ValidationError(f"Xyce waveform is missing column {column}")

    rows: list[list[float]] = []
    for line in lines[1:]:
        if not line.strip():
            continue
        if line.startswith("End of Xyce"):
            break
        parts = line.split()
        if not parts[0].isdigit():
            raise ValidationError("Xyce waveform row has an invalid index")
        if len(parts) != len(header):
            raise ValidationError("Xyce waveform row has an unexpected column count")
        values = [float(value) for value in parts[1:]]
        if not all(math.isfinite(value) for value in values):
            raise ValidationError("Xyce waveform contains NaN or Inf")
        rows.append(values)

    if len(rows) < MIN_SAMPLES:
        raise ValidationError("Xyce waveform contains too few samples")

    return data_columns, rows


def validate_rc_lowpass(columns: list[str], rows: list[list[float]]) -> WaveformSummary:
    time_idx = columns.index("TIME")
    vin_idx = columns.index("V(IN)")
    vout_idx = columns.index("V(OUT)")

    times = [row[time_idx] for row in rows]
    vins = [row[vin_idx] for row in rows]
    vouts = [row[vout_idx] for row in rows]

    if any(curr <= prev for prev, curr in zip(times, times[1:], strict=False)):
        raise ValidationError("Xyce waveform time is not strictly monotonic")

    if abs(vouts[0]) > 1e-6:
        raise ValidationError("RC output does not start near zero")
    if vins[-1] < 0.99:
        raise ValidationError("RC input did not settle high")
    if vouts[-1] < 0.95:
        raise ValidationError("RC output did not charge as expected")
    if max(vouts) > 1.02 or min(vouts) < -1e-6:
        raise ValidationError("RC output is outside expected bounds")
    if any(curr + 1e-6 < prev for prev, curr in zip(vouts, vouts[1:], strict=False)):
        raise ValidationError("RC output is not monotonically charging")

    return WaveformSummary(
        samples=len(rows),
        input_final=vins[-1],
        output_final=vouts[-1],
        duration_seconds=times[-1] - times[0],
    )


def write_waveform_csv(columns: list[str], rows: list[list[float]], destination: Path) -> None:
    with destination.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["time_seconds", "input_volts", "output_volts"])
        time_idx = columns.index("TIME")
        vin_idx = columns.index("V(IN)")
        vout_idx = columns.index("V(OUT)")
        for row in rows:
            writer.writerow(
                [
                    f"{row[time_idx]:.12g}",
                    f"{row[vin_idx]:.12g}",
                    f"{row[vout_idx]:.12g}",
                ]
            )
