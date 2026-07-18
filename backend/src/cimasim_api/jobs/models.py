from __future__ import annotations

from datetime import datetime
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

TEMPLATE_ID: Final[Literal["rc_lowpass_fixed_v1"]] = "rc_lowpass_fixed_v1"
SIMULATOR: Final[Literal["xyce"]] = "xyce"
TERMINAL_STATES = {"succeeded", "failed", "timed_out"}
ACTIVE_STATES = {"queued", "running"}


class JobCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(default="RC low-pass simulation", max_length=120)
    template_id: Literal["rc_lowpass_fixed_v1"]

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        if any(ord(char) < 32 or ord(char) == 127 for char in value):
            raise ValueError("name must not contain control characters")
        normalized = " ".join(value.strip().split())
        if not normalized:
            return "RC low-pass simulation"
        return normalized


class StoredJobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    user_id: str
    name: str
    template_id: Literal["rc_lowpass_fixed_v1"]
    simulator: Literal["xyce"] = SIMULATOR
    timeout_seconds: int
    idempotency_key_hash: str | None = None
    body_hash: str | None = None
    created_at: datetime


class JobStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    user_id: str
    status: Literal["queued", "running", "succeeded", "failed", "timed_out"]
    created_at: datetime
    updated_at: datetime
    reason: str | None = None


class ArtifactInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: Literal["waveform.csv"]
    content_type: Literal["text/csv"] = "text/csv"
    size_bytes: int


class JobSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["succeeded", "failed", "timed_out"]
    simulator: Literal["xyce"]
    template: Literal["rc_lowpass_fixed_v1"]
    samples: int | None = None
    duration_seconds: float | None = None
    elapsed_seconds: float | None = None
    error: str | None = None
    artifacts: list[ArtifactInfo] = Field(default_factory=list)


class JobResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    name: str
    template_id: Literal["rc_lowpass_fixed_v1"]
    simulator: Literal["xyce"]
    status: str
    created_at: datetime
    updated_at: datetime
    summary: JobSummary | None = None


class JobListResponse(BaseModel):
    jobs: list[JobResponse]


class ArtifactListResponse(BaseModel):
    artifacts: list[ArtifactInfo]
