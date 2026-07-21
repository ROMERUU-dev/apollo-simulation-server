from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import stat
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Final, cast

from cimasim_custom_runner.results import validate_results
from cimasim_custom_runner.validation import revalidate

JOB_RE: Final = re.compile(r"^job_[0-9a-f]{32}$")
RUNNER_IMAGE_ID_RE: Final = re.compile(r"^sha256:[0-9a-f]{64}$")
HEARTBEAT_NAME: Final = "dispatcher.json"


def validate_runner_image_id(value: str) -> str:
    if not RUNNER_IMAGE_ID_RE.fullmatch(value):
        raise ValueError("runner image must be a full sha256 image id")
    return value


def podman_command(
    input_dir: Path, output_dir: Path, analysis: str, runner_image: str
) -> list[str]:
    image = validate_runner_image_id(runner_image)
    return [
        "podman",
        "run",
        "--rm",
        "--network=none",
        "--userns=keep-id:uid=10005,gid=10005",
        "--read-only",
        "--cap-drop=all",
        "--security-opt=no-new-privileges",
        "--memory=1g",
        "--cpus=1",
        "--pids-limit=64",
        "--tmpfs=/tmp:rw,size=64m,noexec,nosuid,nodev",
        "--ulimit=nofile=256:256",
        f"--volume={input_dir}:/input:ro,Z",
        f"--volume={output_dir}:/output:rw,Z",
        image,
        "--analysis",
        analysis,
    ]


class Dispatcher:
    def __init__(self, spool: Path, runner_image: str, poll_seconds: float = 2.0) -> None:
        self.spool = spool
        self.runner_image = validate_runner_image_id(runner_image)
        self.poll_seconds = poll_seconds
        self.stopping = False
        self.jobs_claimed_total = 0
        self.last_completion_at: str | None = None
        self.last_error_code: str | None = None

    def request_stop(self, _signum: int, _frame: object) -> None:
        self.stopping = True

    def run(self) -> None:
        self._write_heartbeat("idle")
        while not self.stopping:
            marker = self._claim()
            if marker is None:
                self._write_heartbeat("idle")
                time.sleep(self.poll_seconds)
                continue
            self._execute(marker)
        self._write_heartbeat("stopping")

    def _claim(self) -> Path | None:
        queued = self.spool / "queued"
        claimed = self.spool / "claimed"
        for marker in sorted(queued.iterdir(), key=lambda item: item.name):
            if marker.is_symlink() or not marker.is_file() or not marker.name.endswith(".json"):
                continue
            target = claimed / marker.name
            try:
                os.replace(marker, target)
            except FileNotFoundError:
                continue
            self.jobs_claimed_total += 1
            return target
        return None

    def _execute(self, marker: Path) -> None:
        try:
            marker_info = marker.stat(follow_symlinks=False)
        except FileNotFoundError:
            return
        if not stat.S_ISREG(marker_info.st_mode):
            return
        job_id = marker.stem
        if not JOB_RE.fullmatch(job_id):
            marker.unlink(missing_ok=True)
            return
        job = self.spool / "jobs" / job_id
        input_dir, output_dir = job / "runner-input", job / "runner-output"
        request: dict[str, object] | None = None
        analysis: str | None = None
        started = time.monotonic()
        try:
            request = _read_request(job / "request.json", job_id)
            analysis = str(request["analysis"])
            self._write_heartbeat("running")
            input_dir.mkdir(mode=0o2770, exist_ok=False)
            output_dir.mkdir(mode=0o2770, exist_ok=False)
            os.chmod(input_dir, 0o2770)  # noqa: S103 - group-only setgid spool directory
            os.chmod(output_dir, 0o2770)  # noqa: S103 - group-only setgid spool directory
            netlist = input_dir / "netlist.cir"
            netlist.write_text(cast(str, request["netlist"]), encoding="utf-8")
            os.chmod(netlist, 0o640)
            _write_json(job / "status.json", _status(request, "running"))
            returncode = self._run_podman(
                podman_command(input_dir, output_dir, analysis, self.runner_image)
            )
            if returncode != 0:
                final = "timed_out" if returncode == 124 else "failed"
                self.last_error_code = (
                    "simulation_timeout" if returncode == 124 else "podman_failed"
                )
                self._write_terminal(job, request, analysis, final, started)
                return

            source = output_dir / "results.csv"
            samples, columns = validate_results(source, analysis)
            destination = job / "artifacts" / "results.csv"
            os.replace(source, destination)
            os.chmod(destination, 0o660)
            self._write_terminal(
                job,
                request,
                analysis,
                "succeeded",
                started,
                samples=samples,
                columns=columns,
                artifact=destination,
            )
            self.last_error_code = None
        except (OSError, ValueError):
            if request is not None and analysis is not None:
                self.last_error_code = "dispatcher_error"
                self._write_terminal(job, request, analysis, "failed", started)
        finally:
            self.last_completion_at = datetime.now(UTC).isoformat()
            shutil.rmtree(input_dir, ignore_errors=True)
            shutil.rmtree(output_dir, ignore_errors=True)
            marker.unlink(missing_ok=True)
            self._write_heartbeat("idle")

    def _run_podman(self, command: list[str]) -> int:
        process = subprocess.Popen(  # noqa: S603 - fixed Podman binary, image, and arguments
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        deadline = time.monotonic() + 70
        while process.poll() is None:
            if self.stopping or time.monotonic() >= deadline:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)
                return 124
            time.sleep(0.1)
        return cast(int, process.returncode)

    def _write_heartbeat(self, status: str) -> None:
        state = self.spool / "state"
        _require_directory(state)
        _write_json(
            state / HEARTBEAT_NAME,
            {
                "status": status,
                "updated_at": datetime.now(UTC).isoformat(),
                "runner_image_digest": self.runner_image[:19],
                "jobs_claimed_total": self.jobs_claimed_total,
                "last_completion_at": self.last_completion_at,
                "last_error_code": self.last_error_code,
            },
        )

    @staticmethod
    def _write_terminal(
        job: Path,
        request: dict[str, object],
        analysis: str,
        final: str,
        started: float,
        *,
        samples: int | None = None,
        columns: list[str] | None = None,
        artifact: Path | None = None,
    ) -> None:
        artifacts = []
        if artifact is not None:
            artifacts.append(
                {
                    "filename": "results.csv",
                    "content_type": "text/csv",
                    "size_bytes": artifact.stat().st_size,
                }
            )
        _write_json(
            job / "summary.json",
            {
                "status": final,
                "simulator": "xyce",
                "template": "custom_xyce_netlist_v1",
                "analysis": analysis,
                "samples": samples,
                "duration_seconds": None,
                "elapsed_seconds": time.monotonic() - started,
                "error": (
                    None
                    if final == "succeeded"
                    else "simulation_timeout"
                    if final == "timed_out"
                    else "simulation_failed"
                ),
                "columns": columns,
                "artifacts": artifacts,
            },
        )
        _write_json(job / "status.json", _status(request, final))


def _read_request(path: Path, job_id: str) -> dict[str, object]:
    info = path.stat(follow_symlinks=False)
    if not stat.S_ISREG(info.st_mode) or info.st_size > 128 * 1024:
        raise ValueError("invalid request")
    value = json.loads(path.read_text(encoding="utf-8"))
    required = {"job_id", "user_id", "template_id", "netlist", "requested_outputs", "created_at"}
    if not isinstance(value, dict) or not required <= value.keys():
        raise ValueError("invalid request")
    if value["job_id"] != job_id or value["template_id"] != "custom_xyce_netlist_v1":
        raise ValueError("invalid request")
    if not isinstance(value["netlist"], str) or not isinstance(value["requested_outputs"], list):
        raise ValueError("invalid request")
    value["analysis"] = revalidate(value["netlist"], value["requested_outputs"])
    return value


def _status(request: dict[str, object], status: str) -> dict[str, object]:
    return {
        "job_id": request["job_id"],
        "user_id": request["user_id"],
        "status": status,
        "created_at": request["created_at"],
        "updated_at": datetime.now(UTC).isoformat(),
        "reason": None,
    }


def _write_json(path: Path, value: dict[str, object]) -> None:
    temporary = path.parent / f".{path.name}.{os.getpid()}.tmp"
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o660)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            os.fchmod(handle.fileno(), 0o660)
            json.dump(value, handle, sort_keys=True, separators=(",", ":"))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        os.chmod(path, 0o660)
    finally:
        temporary.unlink(missing_ok=True)


def _require_directory(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    if not stat.S_ISDIR(mode) or path.is_symlink() or mode & stat.S_IRWXO:
        raise ValueError("invalid spool directory")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spool-root", type=Path, default=Path("/var/lib/cimasim-custom"))
    parser.add_argument(
        "--runner-image-id",
        default=os.environ.get("CIMASIM_CUSTOM_RUNNER_IMAGE_ID", ""),
    )
    parser.add_argument("--poll-seconds", type=float, default=2.0)
    args = parser.parse_args()
    dispatcher = Dispatcher(
        args.spool_root,
        validate_runner_image_id(args.runner_image_id),
        args.poll_seconds,
    )
    signal.signal(signal.SIGTERM, dispatcher.request_stop)
    signal.signal(signal.SIGINT, dispatcher.request_stop)
    dispatcher.run()


if __name__ == "__main__":
    main()
