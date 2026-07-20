from __future__ import annotations

import json
import os
import re
import signal
import subprocess
import tempfile
import time
from importlib.resources import as_file, files
from pathlib import Path
from typing import Final

from cimasim_worker.job_models import FIXED_TEMPLATE_ID, PARAM_TEMPLATE_ID
from cimasim_worker.rc_parameters import RcParameters, render_parameterized_netlist
from cimasim_worker.validation import (
    ValidationError,
    parse_xyce_prn,
    validate_rc_lowpass,
    validate_workdir,
    write_waveform_csv,
)

RUN_ID_RE: Final = re.compile(r"^[a-z0-9][a-z0-9_.-]{0,63}$")
MAX_CAPTURE_BYTES: Final = 16 * 1024
DEFAULT_TIMEOUT_SECONDS: Final = 30.0


class WorkerError(RuntimeError):
    """Raised when the fixed Xyce worker run cannot complete safely."""


def validate_run_id(run_id: str) -> str:
    if not RUN_ID_RE.fullmatch(run_id):
        raise WorkerError(
            "run id must use only lowercase letters, digits, dot, underscore, or dash"
        )
    return run_id


def sanitize_message(message: str, workdir: Path) -> str:
    sanitized = message.replace(str(workdir), "<workdir>")
    sanitized = sanitized.replace("/opt/xyce", "<xyce>")
    sanitized = sanitized.replace("/output", "<output>")
    lines = sanitized.splitlines()
    return "\n".join(lines[:40])[:MAX_CAPTURE_BYTES]


def _limited_text(data: bytes) -> str:
    return data[:MAX_CAPTURE_BYTES].decode("utf-8", errors="replace")


class FixedRcXyceExecutor:
    def __init__(
        self,
        xyce_path: Path = Path("/opt/xyce/bin/Xyce"),
        output_root: Path = Path("/output"),
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        if timeout_seconds <= 0 or timeout_seconds > 60:
            raise WorkerError("timeout must be greater than zero and no more than 60 seconds")
        self.xyce_path = xyce_path
        self.output_root = output_root
        self.timeout_seconds = timeout_seconds

    def run(self, run_id: str, parameters: RcParameters | None = None) -> dict[str, object]:
        run_id = validate_run_id(run_id)
        if not self.xyce_path.is_file():
            raise WorkerError("Xyce executable is not available")

        self.output_root.mkdir(parents=True, exist_ok=True)
        run_output = self.output_root / run_id
        try:
            run_output.mkdir(mode=0o750)
        except FileExistsError as exc:
            raise WorkerError("output run already exists") from exc

        start = time.monotonic()
        with tempfile.TemporaryDirectory(prefix="cimasim-xyce-") as tmp:
            workdir = Path(tmp)
            home = workdir / "home"
            home.mkdir(mode=0o700)
            template_id: str
            if parameters is None:
                template_id = FIXED_TEMPLATE_ID
                template = files("cimasim_worker.templates").joinpath("rc_lowpass_fixed.cir")
                with as_file(template) as template_path:
                    (workdir / "input.cir").write_bytes(template_path.read_bytes())
            else:
                template_id = PARAM_TEMPLATE_ID
                (workdir / "input.cir").write_text(
                    render_parameterized_netlist(parameters), encoding="ascii"
                )

            env = {
                "HOME": str(home),
                "PATH": "/usr/bin:/bin",
                "OMPI_MCA_btl": "self,tcp",
                "OMPI_MCA_btl_tcp_if_include": "lo",
                "OMPI_MCA_oob_tcp_if_include": "lo",
                "OMPI_MCA_orte_base_help_aggregate": "0",
            }
            args = [
                str(self.xyce_path),
                "-quiet",
                "-l",
                "xyce.log",
                "-o",
                "waveform",
                "input.cir",
            ]

            process = subprocess.Popen(
                args,
                cwd=workdir,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                start_new_session=True,
            )
            try:
                stdout, stderr = process.communicate(timeout=self.timeout_seconds)
            except subprocess.TimeoutExpired as exc:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.communicate(timeout=2)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.communicate()
                _write_failure_summary(
                    run_output,
                    "timed_out",
                    "Xyce execution timed out",
                    template_id,
                    parameters,
                )
                raise WorkerError("Xyce execution timed out") from exc

            if process.returncode != 0:
                detail = sanitize_message(_limited_text(stdout + stderr), workdir)
                _write_failure_summary(
                    run_output,
                    "failed",
                    f"Xyce exited with code {process.returncode}: {detail}",
                    template_id,
                    parameters,
                )
                raise WorkerError(f"Xyce exited with code {process.returncode}: {detail}")

            try:
                result_path = validate_workdir(workdir)
                columns, rows = parse_xyce_prn(result_path)
                waveform = validate_rc_lowpass(
                    columns,
                    rows,
                    expected_input_voltage=(
                        parameters.input_voltage_volts if parameters is not None else 1.0
                    ),
                    time_constant_seconds=(
                        parameters.time_constant_seconds if parameters is not None else 1e-3
                    ),
                )
            except ValidationError as exc:
                _write_failure_summary(run_output, "failed", str(exc), template_id, parameters)
                raise WorkerError(str(exc)) from exc

            waveform_csv = run_output / "waveform.csv"
            write_waveform_csv(columns, rows, waveform_csv)
            summary: dict[str, object] = {
                "status": "succeeded",
                "simulator": "xyce",
                "template": template_id,
                "samples": waveform.samples,
                "duration_seconds": round(waveform.duration_seconds, 9),
                "artifacts": [
                    {
                        "filename": "waveform.csv",
                        "content_type": "text/csv",
                        "size_bytes": waveform_csv.stat().st_size,
                    }
                ],
            }
            if parameters is not None:
                summary["parameters"] = parameters.as_dict()
                summary["derived"] = {"time_constant_seconds": parameters.time_constant_seconds}
            (run_output / "summary.json").write_text(
                json.dumps(summary, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )

        elapsed = time.monotonic() - start
        summary["elapsed_seconds"] = round(elapsed, 6)
        (run_output / "summary.json").write_text(
            json.dumps(summary, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        return summary


def _write_failure_summary(
    run_output: Path,
    status: str,
    reason: str,
    template_id: str = FIXED_TEMPLATE_ID,
    parameters: RcParameters | None = None,
) -> None:
    summary: dict[str, object] = {
        "status": status,
        "simulator": "xyce",
        "template": template_id,
        "error": reason[:MAX_CAPTURE_BYTES],
        "artifacts": [],
    }
    if parameters is not None:
        summary["parameters"] = parameters.as_dict()
        summary["derived"] = {"time_constant_seconds": parameters.time_constant_seconds}
    (run_output / "summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
