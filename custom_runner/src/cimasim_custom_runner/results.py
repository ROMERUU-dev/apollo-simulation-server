from __future__ import annotations

import csv
import math
import os
import stat
from pathlib import Path
from typing import Final

MAX_RESULTS_BYTES: Final = 10 * 1024 * 1024
MAX_ROWS: Final = 100_000
MAX_COLUMNS: Final = 128


class ResultValidationError(ValueError):
    pass


def validate_results(path: Path, analysis: str) -> tuple[int, list[str]]:
    info = path.stat(follow_symlinks=False)
    if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_RESULTS_BYTES:
        raise ResultValidationError("RESULT_FILE_INVALID")
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        try:
            headers = next(reader)
        except StopIteration as exc:
            raise ResultValidationError("RESULT_EMPTY") from exc
        if not 1 < len(headers) <= MAX_COLUMNS or len(set(headers)) != len(headers):
            raise ResultValidationError("RESULT_HEADERS")
        if any(not header or header.startswith(("=", "+", "-", "@")) for header in headers):
            raise ResultValidationError("RESULT_HEADERS")
        previous: float | None = None
        direction = 0
        rows = 0
        for row in reader:
            rows += 1
            if rows > MAX_ROWS or len(row) != len(headers):
                raise ResultValidationError("RESULT_SHAPE")
            try:
                values = [float(value) for value in row]
            except ValueError as exc:
                raise ResultValidationError("RESULT_NUMBER") from exc
            if not all(math.isfinite(value) for value in values):
                raise ResultValidationError("RESULT_NUMBER")
            axis = values[0]
            if previous is not None and axis != previous:
                current_direction = 1 if axis > previous else -1
                if direction and current_direction != direction:
                    raise ResultValidationError("RESULT_AXIS")
                direction = current_direction
            previous = axis
        if rows == 0:
            raise ResultValidationError("RESULT_EMPTY")
    os.chmod(path, 0o660)
    return rows, headers
