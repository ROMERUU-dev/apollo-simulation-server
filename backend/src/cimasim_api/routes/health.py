from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from cimasim_api.auth.dependencies import authenticated_identity
from cimasim_api.config import Settings, get_settings
from cimasim_api.models import FrontendHealthResponse, HealthResponse, Identity, ReadinessResponse

router = APIRouter()
SettingsDep = Annotated[Settings, Depends(get_settings)]
IdentityDep = Annotated[Identity, Depends(authenticated_identity)]


@router.get("/healthz", response_model=HealthResponse)
def healthz() -> HealthResponse:
    return HealthResponse(status="ok", service="cimasim-api", version="v1")


@router.get("/readyz", response_model=ReadinessResponse, status_code=status.HTTP_200_OK)
def readyz(
    response: Response,
    settings: SettingsDep,
) -> ReadinessResponse:
    if not settings.is_auth_configured:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadinessResponse(
            status="not_ready",
            service="cimasim-api",
            dependencies={"auth_configuration": "unavailable"},
        )
    return ReadinessResponse(
        status="ready",
        service="cimasim-api",
        dependencies={"auth_configuration": "ok"},
    )


@router.get("/api/health", response_model=FrontendHealthResponse)
def api_health(
    response: Response,
    _identity: IdentityDep,
) -> FrontendHealthResponse:
    response.headers["Cache-Control"] = "no-store"
    return FrontendHealthResponse(
        status="ok",
        service="cimasim",
        features={"identity": "available", "job_submission": "not_available"},
    )
