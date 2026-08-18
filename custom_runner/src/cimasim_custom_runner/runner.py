from __future__ import annotations

import argparse
import json
import os
import signal
import stat
import subprocess
from pathlib import Path
from typing import Final

from cimasim_custom_runner import sky130
from cimasim_custom_runner.results import validate_results
from cimasim_custom_runner.validation import revalidate

XYCE: Final = "/opt/xyce/bin/Xyce"
INPUT: Final = Path("/input/netlist.cir")
PARAMS: Final = Path("/input/params.json")
OUTPUT: Final = Path("/output/results.csv")
PREPARED: Final = Path("/tmp/netlist.cir")  # noqa: S108 - private bounded runner tmpfs
TIMEOUT_SECONDS: Final = 60


def prepare_netlist(
    input_path: Path = INPUT,
    prepared_path: Path = PREPARED,
    output_path: Path = OUTPUT,
    expected_analysis: str | None = None,
) -> str:
    info = input_path.stat(follow_symlinks=False)
    if not stat.S_ISREG(info.st_mode) or info.st_size > 64 * 1024:
        raise ValueError("invalid input")
    netlist = input_path.read_text(encoding="utf-8")
    print_lines = [line for line in netlist.splitlines() if line.upper().startswith(".PRINT ")]
    if len(print_lines) != 1:
        raise ValueError("invalid print")
    tokens = print_lines[0].split()
    if len(tokens) < 4 or tokens[2].upper() != "FORMAT=CSV":
        raise ValueError("invalid print")
    requested_outputs = tokens[4:] if tokens[1].upper() == "DC" else tokens[3:]
    analysis = revalidate(netlist, requested_outputs)
    if expected_analysis is not None and analysis != expected_analysis:
        raise ValueError("analysis mismatch")
    if output_path.exists() or output_path.parent.is_symlink() or prepared_path.is_symlink():
        raise ValueError("invalid output")
    fixed_print = f".PRINT {analysis.upper()} FORMAT=CSV FILE={output_path} " + " ".join(tokens[3:])
    prepared = netlist.replace(print_lines[0], fixed_print, 1)
    prepared_path.write_text(prepared, encoding="utf-8")
    os.chmod(prepared_path, 0o600)
    return analysis


def prepare_sky130_netlist(
    params_path: Path = PARAMS,
    prepared_path: Path = PREPARED,
    output_path: Path = OUTPUT,
) -> str:
    """Rebuild the SKY130 netlist from numeric parameters only.

    The netlist is produced here, by trusted runner code, from a revalidated
    parameter set. No netlist, directive or path from the request is used, so
    the free-form netlist policy is irrelevant to this path.
    """
    info = params_path.stat(follow_symlinks=False)
    if not stat.S_ISREG(info.st_mode) or info.st_size > 8 * 1024:
        raise ValueError("invalid params")
    params = sky130.revalidate_parameters(json.loads(params_path.read_text(encoding="utf-8")))
    if output_path.exists() or output_path.parent.is_symlink() or prepared_path.is_symlink():
        raise ValueError("invalid output")
    prepared_path.write_text(
        sky130.build_netlist(params, results=str(output_path)), encoding="utf-8"
    )
    os.chmod(prepared_path, 0o600)
    return "tran"


def run_xyce(input_path: Path = PREPARED) -> int:
    if input_path.is_symlink():
        return 2
    preflight = subprocess.run(  # noqa: S603 - fixed Xyce binary and fixed paths
        [XYCE, "-norun", "-quiet", str(input_path)],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=5,
        check=False,
    )
    if preflight.returncode != 0:
        return 2
    process = subprocess.Popen(  # noqa: S603 - fixed Xyce binary and fixed paths
        [XYCE, "-quiet", str(input_path)],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    try:
        return process.wait(timeout=TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
        return 124


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--analysis", choices=("tran", "dc", "ac"), required=True)
    parser.add_argument("--template", choices=(sky130.TEMPLATE_ID,), default=None)
    args = parser.parse_args()
    try:
        if args.template == sky130.TEMPLATE_ID:
            if args.analysis != "tran":
                raise ValueError("sky130 template is transient only")
            prepare_sky130_netlist()
        else:
            prepare_netlist(expected_analysis=args.analysis)
    except (OSError, UnicodeError, ValueError, json.JSONDecodeError):
        raise SystemExit(2) from None
    result = run_xyce()
    if result == 0:
        validate_results(OUTPUT, args.analysis)
    raise SystemExit(result)


if __name__ == "__main__":
    main()
