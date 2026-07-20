from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response, status
from fastapi.responses import FileResponse

from cimasim_api.auth.dependencies import authenticated_identity
from cimasim_api.config import Settings, get_app_settings
from cimasim_api.custom_netlists.parser import parse_netlist
from cimasim_api.jobs.errors import JobNotFoundError
from cimasim_api.jobs.models import (
    CUSTOM_TEMPLATE_ID,
    ArtifactListResponse,
    JobCreateRequest,
    JobListResponse,
    JobResponse,
    NetlistPreflightResponse,
)
from cimasim_api.jobs.service import JobService, store_for
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
    if settings.custom_job_spool_root.is_dir() and not settings.custom_job_spool_root.is_symlink():
        jobs.extend(store_for(settings, True).list_jobs(identity.user_id, settings.job_list_limit))
        jobs.sort(key=lambda job: job.created_at, reverse=True)
    return JobListResponse(jobs=jobs)


@router.post("/preflight", response_model=NetlistPreflightResponse)
def preflight(
    request: JobCreateRequest,
    response: Response,
    _identity: IdentityDep,
    settings: SettingsDep,
) -> NetlistPreflightResponse:
    response.headers["Cache-Control"] = "no-store"
    if request.template_id != CUSTOM_TEMPLATE_ID:
        raise JobNotFoundError
    parsed = parse_netlist(request.netlist or "", request.requested_outputs or [])
    return NetlistPreflightResponse(
        analysis=parsed.analysis,
        devices=parsed.devices,
        nodes=parsed.nodes,
        models=parsed.models,
        subcircuits=parsed.subcircuits,
        outputs=list(parsed.outputs),
        sandbox_ready=settings.custom_netlists_enabled,
    )


@router.head("/{job_id}", response_model=JobResponse, include_in_schema=False)
@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: str,
    response: Response,
    settings: SettingsDep,
    identity: IdentityDep,
) -> JobResponse:
    response.headers["Cache-Control"] = "no-store"
    return _get_job(settings, identity.user_id, job_id)


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
    job = _get_job(settings, identity.user_id, job_id)
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
    path = _artifact_path(settings, identity.user_id, job_id, "waveform.csv")
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


@router.head("/{job_id}/artifacts/results.csv", include_in_schema=False)
@router.get("/{job_id}/artifacts/results.csv")
def get_results(
    job_id: str,
    settings: SettingsDep,
    identity: IdentityDep,
) -> FileResponse:
    path = _artifact_path(settings, identity.user_id, job_id, "results.csv")
    return FileResponse(
        path,
        media_type="text/csv",
        filename="results.csv",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": 'attachment; filename="results.csv"',
            "X-Content-Type-Options": "nosniff",
        },
        status_code=status.HTTP_200_OK,
    )


def _get_job(settings: Settings, user_id: str, job_id: str) -> JobResponse:
    try:
        return JobStore(settings).get_job(user_id, job_id)
    except JobNotFoundError:
        if (
            settings.custom_job_spool_root.is_dir()
            and not settings.custom_job_spool_root.is_symlink()
        ):
            return store_for(settings, True).get_job(user_id, job_id)
        raise


def _artifact_path(settings: Settings, user_id: str, job_id: str, filename: str) -> Path:
    try:
        return JobStore(settings).artifact_path(user_id, job_id, filename)
    except JobNotFoundError:
        if (
            settings.custom_job_spool_root.is_dir()
            and not settings.custom_job_spool_root.is_symlink()
        ):
            return store_for(settings, True).artifact_path(user_id, job_id, filename)
        raise
