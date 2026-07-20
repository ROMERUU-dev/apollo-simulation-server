from __future__ import annotations

import json
import stat
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Final

from prometheus_client.core import GaugeMetricFamily, HistogramMetricFamily, Metric

MAX_JSON_BYTES: Final = 64 * 1024
EXPECTED_ROOT_ENTRIES: Final = {"queued", "claimed", "jobs", "failed", ".jobs.lock"}
STATUSES: Final = ("queued", "running", "succeeded", "failed", "timed_out")


@dataclass(frozen=True)
class Aggregate:
    statuses: Counter[str]
    kinds: Counter[str]
    artifact_bytes: int
    latest_completion: float
    durations: tuple[float, ...]
    errors: int
    ready: bool


class SpoolCollector:
    def __init__(self, root: Path) -> None:
        self.root = root

    def collect(self) -> list[Metric]:
        aggregate = inspect_spool(self.root)
        ready = GaugeMetricFamily("cimasim_spool_ready", "Whether the spool structure is valid.")
        ready.add_metric([], 1 if aggregate.ready else 0)
        total = GaugeMetricFamily("cimasim_spool_jobs_total", "Total jobs in the spool.")
        total.add_metric([], sum(aggregate.statuses.values()))
        statuses = GaugeMetricFamily(
            "cimasim_spool_jobs", "Jobs by terminal or active status.", labels=["status"]
        )
        for status in STATUSES:
            statuses.add_metric([status], aggregate.statuses[status])
        kinds = GaugeMetricFamily(
            "cimasim_spool_jobs_by_kind", "Jobs by bounded kind.", labels=["job_kind"]
        )
        for kind in ("legacy_rc_fixed", "legacy_rc_param", "custom_netlist"):
            kinds.add_metric([kind], aggregate.kinds[kind])
        artifacts = GaugeMetricFamily("cimasim_job_artifact_bytes", "Aggregate artifact bytes.")
        artifacts.add_metric([], aggregate.artifact_bytes)
        last = GaugeMetricFamily(
            "cimasim_worker_last_completion_timestamp_seconds", "Newest terminal job update."
        )
        last.add_metric([], aggregate.latest_completion)
        errors = GaugeMetricFamily(
            "cimasim_spool_validation_errors", "Spool entries rejected during inspection."
        )
        errors.add_metric([], aggregate.errors)
        active = GaugeMetricFamily("cimasim_jobs_active", "Active jobs.")
        active.add_metric([], aggregate.statuses["queued"] + aggregate.statuses["running"])
        queued = GaugeMetricFamily("cimasim_jobs_queued", "Queued jobs.")
        queued.add_metric([], aggregate.statuses["queued"])
        running = GaugeMetricFamily("cimasim_jobs_running", "Running jobs.")
        running.add_metric([], aggregate.statuses["running"])
        terminal: list[Metric] = []
        for status in ("succeeded", "failed", "timed_out"):
            family = GaugeMetricFamily(f"cimasim_jobs_{status}_total", f"Jobs ending as {status}.")
            family.add_metric([], aggregate.statuses[status])
            terminal.append(family)
        duration = HistogramMetricFamily(
            "cimasim_job_duration_seconds", "Observed terminal job elapsed time."
        )
        buckets: list[tuple[str, int]] = []
        for boundary in (0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60):
            buckets.append((str(boundary), sum(value <= boundary for value in aggregate.durations)))
        buckets.append(("+Inf", len(aggregate.durations)))
        duration.add_metric([], buckets, sum(aggregate.durations))
        return [
            ready,
            total,
            statuses,
            kinds,
            artifacts,
            last,
            errors,
            active,
            queued,
            running,
            *terminal,
            duration,
        ]


def inspect_spool(root: Path) -> Aggregate:
    statuses: Counter[str] = Counter()
    kinds: Counter[str] = Counter()
    errors = 0
    artifact_bytes = 0
    latest_completion = 0.0
    durations: list[float] = []
    try:
        _require_dir(root)
        entries = {entry.name for entry in root.iterdir()}
        if entries - EXPECTED_ROOT_ENTRIES:
            errors += len(entries - EXPECTED_ROOT_ENTRIES)
        jobs_root = root / "jobs"
        for required in ("queued", "claimed", "jobs", "failed"):
            _require_dir(root / required)
        job_entries = list(jobs_root.iterdir())
    except (OSError, ValueError):
        return Aggregate(statuses, kinds, 0, 0, (), errors + 1, False)
    for job_dir in job_entries:
        try:
            _require_dir(job_dir)
            request = _read_json(job_dir / "request.json")
            status = _read_json(job_dir / "status.json")
            template = request.get("template_id")
            current = status.get("status")
            if template == "rc_lowpass_fixed_v1":
                kinds["legacy_rc_fixed"] += 1
            elif template == "rc_lowpass_param_v1":
                kinds["legacy_rc_param"] += 1
            elif template == "custom_xyce_netlist_v1":
                kinds["custom_netlist"] += 1
            else:
                raise ValueError("unknown job kind")
            if current not in STATUSES:
                raise ValueError("unknown status")
            statuses[str(current)] += 1
            if current in {"succeeded", "failed", "timed_out"}:
                updated = status.get("updated_at")
                if isinstance(updated, str):
                    latest_completion = max(
                        latest_completion, datetime.fromisoformat(updated).timestamp()
                    )
                summary_path = job_dir / "summary.json"
                if summary_path.exists():
                    summary = _read_json(summary_path)
                    elapsed = summary.get("elapsed_seconds")
                    if isinstance(elapsed, int | float) and elapsed >= 0:
                        durations.append(float(elapsed))
            artifacts = job_dir / "artifacts"
            _require_dir(artifacts)
            for artifact in artifacts.iterdir():
                info = artifact.stat(follow_symlinks=False)
                if not stat.S_ISREG(info.st_mode):
                    raise ValueError("invalid artifact")
                artifact_bytes += info.st_size
        except (OSError, ValueError, json.JSONDecodeError):
            errors += 1
    return Aggregate(
        statuses,
        kinds,
        artifact_bytes,
        latest_completion,
        tuple(durations),
        errors,
        errors == 0,
    )


def _require_dir(path: Path) -> None:
    info = path.stat(follow_symlinks=False)
    if not stat.S_ISDIR(info.st_mode):
        raise ValueError("directory required")


def _read_json(path: Path) -> dict[str, object]:
    info = path.stat(follow_symlinks=False)
    if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_JSON_BYTES:
        raise ValueError("regular bounded JSON required")
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("object required")
    return value
