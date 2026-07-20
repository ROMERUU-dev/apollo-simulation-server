from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime, timedelta
from typing import Any, Final, Literal

import httpx

from cimasim_api.config import Settings
from cimasim_api.monitoring.models import (
    AlertSummary,
    CimaSimSummary,
    HistoryPoint,
    HistorySeries,
    HostSummary,
    MonitoringHistory,
    MonitoringSummary,
)

RANGES: Final = {"15m": 900, "1h": 3600, "6h": 21600, "24h": 86400}
SUMMARY_QUERIES: Final = {
    "cpu": '100 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100',
    "load": "node_load1",
    "memory": "(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100",
    "root_disk": (
        '100 * (1 - node_filesystem_avail_bytes{mountpoint="/"} '
        '/ node_filesystem_size_bytes{mountpoint="/"})'
    ),
    "data_disk": (
        '100 * (1 - node_filesystem_avail_bytes{mountpoint="/srv/apollo-data"} '
        '/ node_filesystem_size_bytes{mountpoint="/srv/apollo-data"})'
    ),
    "temperature": "max(node_hwmon_temp_celsius)",
    "uptime": "time() - node_boot_time_seconds",
    "backend_up": 'up{job="backend"}',
    "spool_ready": "cimasim_spool_ready",
    "queued": 'cimasim_spool_jobs{status="queued"}',
    "running": 'cimasim_spool_jobs{status="running"}',
    "completed": 'sum(cimasim_spool_jobs{status=~"succeeded|failed|timed_out"})',
    "failed": 'sum(cimasim_spool_jobs{status=~"failed|timed_out"})',
    "p95": "histogram_quantile(0.95, sum by (le) (rate(cimasim_job_duration_seconds_bucket[1h])))",
}
HISTORY_QUERIES: Final = {
    "cpu_percent": SUMMARY_QUERIES["cpu"],
    "memory_percent": SUMMARY_QUERIES["memory"],
    "queued": SUMMARY_QUERIES["queued"],
    "running": SUMMARY_QUERIES["running"],
    "p95_duration_seconds": SUMMARY_QUERIES["p95"],
}


class MonitoringUnavailableError(RuntimeError):
    pass


class MonitoringService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._cache: dict[str, tuple[float, object]] = {}
        self._lock = asyncio.Lock()

    async def summary(self) -> MonitoringSummary:
        cached = self._get_cached("summary")
        if isinstance(cached, MonitoringSummary):
            return cached
        async with self._lock:
            cached = self._get_cached("summary")
            if isinstance(cached, MonitoringSummary):
                return cached
            values = await asyncio.gather(*(self._instant(q) for q in SUMMARY_QUERIES.values()))
            data = dict(zip(SUMMARY_QUERIES, values, strict=True))
            alerts = await self._alerts()
            summary = MonitoringSummary(
                generated_at=datetime.now(UTC).isoformat(),
                status="degraded" if alerts or not _bool(data["backend_up"]) else "healthy",
                host=HostSummary(
                    cpu_percent=_number(data["cpu"]),
                    load_1=_number(data["load"]),
                    memory_percent=_number(data["memory"]),
                    root_disk_percent=_number(data["root_disk"]),
                    data_disk_percent=_number(data["data_disk"]),
                    temperature_celsius=_optional_number(data["temperature"]),
                    uptime_seconds=_number(data["uptime"]),
                ),
                cimasim=CimaSimSummary(
                    backend_up=_bool(data["backend_up"]),
                    spool_ready=_bool(data["spool_ready"]),
                    queued=int(_number(data["queued"])),
                    running=int(_number(data["running"])),
                    completed_total=int(_number(data["completed"])),
                    failed_total=int(_number(data["failed"])),
                    p95_duration_seconds=_optional_number(data["p95"]),
                ),
                alerts=alerts,
            )
            self._put_cached("summary", summary)
            return summary

    async def history(self, selected_range: Literal["15m", "1h", "6h", "24h"]) -> MonitoringHistory:
        seconds = RANGES[selected_range]
        cache_key = f"history:{selected_range}"
        cached = self._get_cached(cache_key)
        if isinstance(cached, MonitoringHistory):
            return cached
        end = datetime.now(UTC)
        start = end - timedelta(seconds=seconds)
        step = max(5, (seconds + 199) // 200)
        values = await asyncio.gather(
            *(
                self._range(query, start.timestamp(), end.timestamp(), step)
                for query in HISTORY_QUERIES.values()
            )
        )
        history = MonitoringHistory(
            generated_at=end.isoformat(),
            range=selected_range,
            series=[
                HistorySeries(key=key, points=points)
                for key, points in zip(HISTORY_QUERIES, values, strict=True)
            ],
        )
        self._put_cached(cache_key, history)
        return history

    def _get_cached(self, key: str) -> object | None:
        entry = self._cache.get(key)
        if entry is None or entry[0] <= time.monotonic():
            return None
        return entry[1]

    def _put_cached(self, key: str, value: object) -> None:
        self._cache[key] = (time.monotonic() + self.settings.monitoring_cache_seconds, value)

    async def _request(self, path: str, params: dict[str, str | int | float]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(
                timeout=self.settings.prometheus_timeout_seconds
            ) as client:
                response = await client.get(
                    f"{self.settings.prometheus_url.rstrip('/')}{path}", params=params
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise MonitoringUnavailableError from exc
        if not isinstance(payload, dict) or payload.get("status") != "success":
            raise MonitoringUnavailableError
        data = payload.get("data")
        if not isinstance(data, dict):
            raise MonitoringUnavailableError
        return data

    async def _instant(self, query: str) -> str | None:
        data = await self._request("/api/v1/query", {"query": query})
        result = data.get("result")
        if not isinstance(result, list) or not result:
            return None
        value = result[0].get("value") if isinstance(result[0], dict) else None
        return (
            value[1]
            if isinstance(value, list) and len(value) == 2 and isinstance(value[1], str)
            else None
        )

    async def _range(self, query: str, start: float, end: float, step: int) -> list[HistoryPoint]:
        data = await self._request(
            "/api/v1/query_range", {"query": query, "start": start, "end": end, "step": step}
        )
        result = data.get("result")
        if not isinstance(result, list) or not result:
            return []
        values = result[0].get("values") if isinstance(result[0], dict) else None
        points: list[HistoryPoint] = []
        if isinstance(values, list):
            for item in values[:200]:
                if isinstance(item, list) and len(item) == 2:
                    points.append(
                        HistoryPoint(
                            timestamp=datetime.fromtimestamp(float(item[0]), UTC).isoformat(),
                            value=float(item[1]),
                        )
                    )
        return points

    async def _alerts(self) -> list[AlertSummary]:
        data = await self._request("/api/v1/alerts", {})
        raw = data.get("alerts")
        if not isinstance(raw, list):
            return []
        alerts: list[AlertSummary] = []
        for item in raw[:50]:
            if not isinstance(item, dict) or item.get("state") not in {"pending", "firing"}:
                continue
            labels = item.get("labels")
            if not isinstance(labels, dict):
                continue
            name, severity = labels.get("alertname"), labels.get("severity")
            if isinstance(name, str) and severity in {"warning", "critical"}:
                alerts.append(AlertSummary(name=name[:80], severity=severity, state=item["state"]))
        return alerts


def _number(value: str | None) -> float:
    result = _optional_number(value)
    return result if result is not None else 0.0


def _optional_number(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        result = float(value)
    except ValueError:
        return None
    return result if result == result and abs(result) != float("inf") else None


def _bool(value: str | None) -> bool:
    return (_optional_number(value) or 0) > 0
