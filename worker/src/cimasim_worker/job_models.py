from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Final, Literal

TEMPLATE_ID: Final[Literal["rc_lowpass_fixed_v1"]] = "rc_lowpass_fixed_v1"
SIMULATOR: Final[Literal["xyce"]] = "xyce"
TERMINAL_STATES = {"succeeded", "failed", "timed_out"}


@dataclass(frozen=True)
class SpoolRequest:
    job_id: str
    user_id: str
    name: str
    template_id: Literal["rc_lowpass_fixed_v1"]
    simulator: Literal["xyce"]
    timeout_seconds: int
    created_at: str


@dataclass(frozen=True)
class SpoolStatus:
    job_id: str
    user_id: str
    status: Literal["queued", "running", "succeeded", "failed", "timed_out"]
    created_at: str
    updated_at: str
    reason: str | None = None


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat()
