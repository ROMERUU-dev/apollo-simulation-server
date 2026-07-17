from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class ReadinessResponse(BaseModel):
    status: str
    service: str
    dependencies: dict[str, str]


class FrontendHealthResponse(BaseModel):
    status: str
    service: str
    features: dict[str, str]


class Identity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    email: str
    name: str | None = None
    roles: list[str] = Field(default_factory=lambda: ["user"])
    is_admin: bool = False
    groups: list[str] | None = None

    def public_dump(self) -> dict[str, object]:
        data = self.model_dump(exclude_none=True)
        return data


class IdentityResponse(Identity):
    limits: dict[str, int]


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str
