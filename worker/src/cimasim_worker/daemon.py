from __future__ import annotations

import argparse
import signal
import tempfile
import time
from pathlib import Path

from cimasim_worker.executor import FixedRcXyceExecutor, WorkerError
from cimasim_worker.spool import FileSpool, SpoolError, sanitized_error


class WorkerDaemon:
    def __init__(
        self,
        spool: FileSpool,
        poll_seconds: float = 2.0,
        executor: FixedRcXyceExecutor | None = None,
    ) -> None:
        self.spool = spool
        self.poll_seconds = poll_seconds
        self.executor = executor
        self.stop_requested = False

    def request_stop(self, _signum: int, _frame: object) -> None:
        self.stop_requested = True

    def run(self, once: bool = False) -> int:
        self.spool.ensure_available()
        self.spool.recover_claimed()
        while not self.stop_requested:
            job_id = self.spool.claim_next()
            if job_id is None:
                if once:
                    return 0
                time.sleep(self.poll_seconds)
                continue
            self.run_job(job_id)
            if once:
                return 0
        return 0

    def run_job(self, job_id: str) -> None:
        success = False
        try:
            request = self.spool.read_request(job_id)
            self.spool.write_status(job_id, request.user_id, "running")
            with tempfile.TemporaryDirectory(prefix="cimasim-worker-output-") as tmp:
                output_root = Path(tmp)
                executor = self.executor or FixedRcXyceExecutor(output_root=output_root)
                if self.executor is not None:
                    executor.output_root = output_root
                try:
                    executor.run(job_id)
                except WorkerError as exc:
                    executor_output = output_root / job_id
                    if executor_output.exists():
                        self.spool.copy_executor_outputs(job_id, executor_output)
                    status = "timed_out" if "timed out" in str(exc).lower() else "failed"
                    self.spool.write_status(
                        job_id,
                        request.user_id,
                        status,
                        reason=sanitized_error(exc, self.spool.root),
                    )
                    self.spool.complete_claim(job_id, success=False)
                    return
                summary = self.spool.copy_executor_outputs(job_id, output_root / job_id)
            self.spool.write_status(job_id, request.user_id, str(summary["status"]))
            success = True
        except SpoolError as exc:
            try:
                self.spool.fail_claimed_from_status(
                    job_id,
                    reason=sanitized_error(exc, self.spool.root),
                )
            except SpoolError:
                pass
        finally:
            self.spool.complete_claim(job_id, success=success)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Consume one fixed-template CimaSim job at a time."
    )
    parser.add_argument("--spool-root", type=Path, default=Path("/spool"))
    parser.add_argument("--poll-seconds", type=float, default=2.0)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    daemon = WorkerDaemon(FileSpool(args.spool_root), poll_seconds=args.poll_seconds)
    signal.signal(signal.SIGTERM, daemon.request_stop)
    signal.signal(signal.SIGINT, daemon.request_stop)
    return daemon.run(once=args.once)


if __name__ == "__main__":
    raise SystemExit(main())
