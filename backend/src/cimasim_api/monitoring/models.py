from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class HostSummary(BaseModel):
    cpu_percent: float
    load_1: float
    memory_percent: float
    root_disk_percent: float
    data_disk_percent: float
    temperature_celsius: float | None
    uptime_seconds: float


class CimaSimSummary(BaseModel):
    backend_up: bool
    spool_ready: bool
    queued: int
    running: int
    completed_total: int
    failed_total: int
    p95_duration_seconds: float | None


class AlertSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    severity: Literal["warning", "critical"]
    state: Literal["pending", "firing"]


class MonitoringSummary(BaseModel):
    generated_at: str
    status: Literal["healthy", "degraded", "unavailable"]
    host: HostSummary
    cimasim: CimaSimSummary
    alerts: list[AlertSummary]


class HistoryPoint(BaseModel):
    timestamp: str
    value: float


class HistorySeries(BaseModel):
    key: str
    points: list[HistoryPoint]


class MonitoringHistory(BaseModel):
    generated_at: str
    range: Literal["15m", "1h", "6h", "24h"]
    series: list[HistorySeries]
