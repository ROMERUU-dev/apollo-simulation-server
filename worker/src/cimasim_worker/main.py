from __future__ import annotations

import argparse
import json
import sys

from cimasim_worker.executor import FixedRcXyceExecutor, WorkerError


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the fixed internal CimaSim Xyce spike")
    parser.add_argument("--run-id", required=True, help="controlled output identifier")
    parser.add_argument("--timeout-seconds", type=float, default=30.0)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        summary = FixedRcXyceExecutor(timeout_seconds=args.timeout_seconds).run(args.run_id)
    except WorkerError as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}, sort_keys=True), file=sys.stderr)
        return 1
    print(json.dumps(summary, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
