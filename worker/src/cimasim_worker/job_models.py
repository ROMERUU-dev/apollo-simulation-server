from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Final, Literal

from cimasim_worker.rc_parameters import RcParameters

FIXED_TEMPLATE_ID: Final[Literal["rc_lowpass_fixed_v1"]] = "rc_lowpass_fixed_v1"
PARAM_TEMPLATE_ID: Final[Literal["rc_lowpass_param_v1"]] = "rc_lowpass_param_v1"
TEMPLATE_ID = FIXED_TEMPLATE_ID
type TemplateId = Literal["rc_lowpass_fixed_v1", "rc_lowpass_param_v1"]
SIMULATOR: Final[Literal["xyce"]] = "xyce"
TERMINAL_STATES = {"succeeded", "failed", "timed_out"}


@dataclass(frozen=True)
class SpoolRequest:
    job_id: str
    user_id: str
    name: str
    template_id: TemplateId
    simulator: Literal["xyce"]
    timeout_seconds: int
    created_at: str
    parameters: RcParameters | None = None


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
