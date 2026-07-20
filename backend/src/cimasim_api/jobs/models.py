from __future__ import annotations

import math
from datetime import datetime
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

FIXED_TEMPLATE_ID: Final[Literal["rc_lowpass_fixed_v1"]] = "rc_lowpass_fixed_v1"
PARAM_TEMPLATE_ID: Final[Literal["rc_lowpass_param_v1"]] = "rc_lowpass_param_v1"
TEMPLATE_ID = FIXED_TEMPLATE_ID
type TemplateId = Literal["rc_lowpass_fixed_v1", "rc_lowpass_param_v1"]
SIMULATOR: Final[Literal["xyce"]] = "xyce"
TERMINAL_STATES = {"succeeded", "failed", "timed_out"}
ACTIVE_STATES = {"queued", "running"}
MIN_DURATION_TAU_RATIO: Final = 0.01
MAX_DURATION_TAU_RATIO: Final = 1000.0
MAX_NUMERIC_REPRESENTATION: Final = 32


class RcParameters(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    resistance_ohms: float = Field(strict=True, ge=1.0, le=10_000_000.0)
    capacitance_farads: float = Field(strict=True, ge=1e-12, le=1e-2)
    input_voltage_volts: float = Field(strict=True, ge=0.001, le=10.0)
    duration_seconds: float = Field(strict=True, ge=1e-6, le=1.0)

    @field_validator("*", mode="before")
    @classmethod
    def reject_ambiguous_numbers(cls, value: object) -> object:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("parameter must be a JSON number")
        if len(str(value)) > MAX_NUMERIC_REPRESENTATION:
            raise ValueError("numeric representation is too long")
        if not math.isfinite(float(value)):
            raise ValueError("parameter must be finite")
        return value

    @model_validator(mode="after")
    def validate_physical_ratio(self) -> RcParameters:
        tau = self.resistance_ohms * self.capacitance_farads
        ratio = self.duration_seconds / tau
        if not math.isfinite(tau) or tau <= 0:
            raise ValueError("RC time constant is invalid")
        if not MIN_DURATION_TAU_RATIO <= ratio <= MAX_DURATION_TAU_RATIO:
            raise ValueError("simulation duration is outside the supported RC range")
        return self

    @property
    def time_constant_seconds(self) -> float:
        return self.resistance_ohms * self.capacitance_farads


class DerivedMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    time_constant_seconds: float


class JobCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    name: str = Field(default="RC low-pass simulation", max_length=120)
    template_id: TemplateId
    parameters: RcParameters | None = None

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

    @model_validator(mode="after")
    def validate_template_parameters(self) -> JobCreateRequest:
        supplied = "parameters" in self.model_fields_set
        if self.template_id == FIXED_TEMPLATE_ID and supplied:
            raise ValueError("fixed template does not accept parameters")
        if self.template_id == PARAM_TEMPLATE_ID and self.parameters is None:
            raise ValueError("parameterized template requires parameters")
        return self


class StoredJobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    user_id: str
    name: str
    template_id: TemplateId
    simulator: Literal["xyce"] = SIMULATOR
    timeout_seconds: int
    parameters: RcParameters | None = None
    idempotency_key_hash: str | None = None
    body_hash: str | None = None
    created_at: datetime

    @model_validator(mode="after")
    def validate_stored_template_parameters(self) -> StoredJobRequest:
        supplied = "parameters" in self.model_fields_set
        if self.template_id == FIXED_TEMPLATE_ID and supplied:
            raise ValueError("fixed stored request does not accept parameters")
        if self.template_id == PARAM_TEMPLATE_ID and self.parameters is None:
            raise ValueError("parameterized stored request requires parameters")
        return self


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
    template: TemplateId
    samples: int | None = None
    duration_seconds: float | None = None
    elapsed_seconds: float | None = None
    error: str | None = None
    artifacts: list[ArtifactInfo] = Field(default_factory=list)
    parameters: RcParameters | None = None
    derived: DerivedMetrics | None = None


class JobResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    name: str
    template_id: TemplateId
    simulator: Literal["xyce"]
    status: str
    created_at: datetime
    updated_at: datetime
    summary: JobSummary | None = None
    parameters: RcParameters | None = None
    derived: DerivedMetrics | None = None


class JobListResponse(BaseModel):
    jobs: list[JobResponse]


class ArtifactListResponse(BaseModel):
    artifacts: list[ArtifactInfo]
