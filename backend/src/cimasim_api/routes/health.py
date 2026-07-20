from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from cimasim_api.auth.dependencies import authenticated_identity
from cimasim_api.config import Settings, get_app_settings
from cimasim_api.jobs.readiness import spool_is_ready
from cimasim_api.models import FrontendHealthResponse, HealthResponse, Identity, ReadinessResponse

router = APIRouter()
SettingsDep = Annotated[Settings, Depends(get_app_settings)]
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
    dependencies = {"auth_configuration": "ok"}
    if settings.jobs_enabled:
        if not spool_is_ready(settings.job_spool_root):
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            dependencies["job_spool"] = "unavailable"
            return ReadinessResponse(
                status="not_ready",
                service="cimasim-api",
                dependencies=dependencies,
            )
        dependencies["job_spool"] = "ok"
    return ReadinessResponse(
        status="ready",
        service="cimasim-api",
        dependencies=dependencies,
    )


@router.get("/api/health", response_model=FrontendHealthResponse)
def api_health(
    response: Response,
    settings: SettingsDep,
    _identity: IdentityDep,
) -> FrontendHealthResponse:
    response.headers["Cache-Control"] = "no-store"
    job_submission = "not_available"
    response_status = "ok"
    if settings.jobs_enabled:
        if spool_is_ready(settings.job_spool_root):
            job_submission = "available"
        else:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            response_status = "degraded"
            job_submission = "temporarily_unavailable"
    return FrontendHealthResponse(
        status=response_status,
        service="cimasim",
        features={"identity": "available", "job_submission": job_submission},
    )
