from typing import Annotated

from fastapi import APIRouter, Depends, Response

from cimasim_api.auth.dependencies import authenticated_identity
from cimasim_api.models import Identity, IdentityResponse

router = APIRouter()
IdentityDep = Annotated[Identity, Depends(authenticated_identity)]

INITIAL_LIMITS = {
    "active_jobs_per_user": 2,
    "max_sweep_runs": 100,
    "job_timeout_seconds": 1800,
    "storage_bytes": 1073741824,
}


@router.get("/api/me", response_model=IdentityResponse, response_model_exclude_none=True)
def me(
    response: Response,
    identity: IdentityDep,
) -> IdentityResponse:
    response.headers["Cache-Control"] = "no-store"
    return IdentityResponse(**identity.public_dump(), limits=INITIAL_LIMITS)
