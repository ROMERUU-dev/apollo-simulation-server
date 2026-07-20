from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response, status
from fastapi.responses import FileResponse

from cimasim_api.auth.dependencies import authenticated_identity
from cimasim_api.config import Settings, get_app_settings
from cimasim_api.jobs.models import (
    ArtifactListResponse,
    JobCreateRequest,
    JobListResponse,
    JobResponse,
)
from cimasim_api.jobs.service import JobService
from cimasim_api.jobs.store import JobStore
from cimasim_api.models import Identity

router = APIRouter(prefix="/api/jobs")
SettingsDep = Annotated[Settings, Depends(get_app_settings)]
IdentityDep = Annotated[Identity, Depends(authenticated_identity)]


@router.post("", response_model=JobResponse)
def create_job(
    request: JobCreateRequest,
    response: Response,
    settings: SettingsDep,
    identity: IdentityDep,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> JobResponse:
    response.headers["Cache-Control"] = "no-store"
    job, status_code = JobService(settings).create_job(identity, request, idempotency_key)
    response.status_code = status_code
    return job


@router.head("", response_model=JobListResponse, include_in_schema=False)
@router.get("", response_model=JobListResponse)
def list_jobs(
    response: Response,
    settings: SettingsDep,
    identity: IdentityDep,
) -> JobListResponse:
    response.headers["Cache-Control"] = "no-store"
    jobs = JobStore(settings).list_jobs(identity.user_id, settings.job_list_limit)
    return JobListResponse(jobs=jobs)


@router.head("/{job_id}", response_model=JobResponse, include_in_schema=False)
@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: str,
    response: Response,
    settings: SettingsDep,
    identity: IdentityDep,
) -> JobResponse:
    response.headers["Cache-Control"] = "no-store"
    return JobStore(settings).get_job(identity.user_id, job_id)


@router.head(
    "/{job_id}/artifacts",
    response_model=ArtifactListResponse,
    include_in_schema=False,
)
@router.get("/{job_id}/artifacts", response_model=ArtifactListResponse)
def list_artifacts(
    job_id: str,
    response: Response,
    settings: SettingsDep,
    identity: IdentityDep,
) -> ArtifactListResponse:
    response.headers["Cache-Control"] = "no-store"
    job = JobStore(settings).get_job(identity.user_id, job_id)
    if job.summary is None:
        return ArtifactListResponse(artifacts=[])
    return ArtifactListResponse(artifacts=job.summary.artifacts)


@router.head("/{job_id}/artifacts/waveform.csv", include_in_schema=False)
@router.get("/{job_id}/artifacts/waveform.csv")
def get_waveform(
    job_id: str,
    settings: SettingsDep,
    identity: IdentityDep,
) -> FileResponse:
    path = JobStore(settings).artifact_path(identity.user_id, job_id, "waveform.csv")
    return FileResponse(
        path,
        media_type="text/csv",
        filename="waveform.csv",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": 'attachment; filename="waveform.csv"',
            "X-Content-Type-Options": "nosniff",
        },
        status_code=status.HTTP_200_OK,
    )
