from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Final

from cimasim_api.config import Settings
from cimasim_api.jobs.errors import (
    CustomNetlistsDisabledError,
    IdempotencyConflictError,
    JobLimitExceededError,
    LegacyTemplateDisabledError,
)
from cimasim_api.jobs.models import CUSTOM_TEMPLATE_ID, JobCreateRequest, JobResponse
from cimasim_api.jobs.store import JobStore
from cimasim_api.metrics import record_job_created
from cimasim_api.models import Identity

IDEMPOTENCY_KEY_RE: Final = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


class JobService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.store = JobStore(settings)

    def create_job(
        self,
        identity: Identity,
        request: JobCreateRequest,
        idempotency_key: str | None,
    ) -> tuple[JobResponse, int]:
        key = _normalize_idempotency_key(idempotency_key)
        is_custom = request.template_id == CUSTOM_TEMPLATE_ID
        if is_custom and not self.settings.custom_netlists_enabled:
            raise CustomNetlistsDisabledError
        if not is_custom and not self.settings.allow_legacy_rc_submission:
            raise LegacyTemplateDisabledError
        self.store = store_for(self.settings, is_custom)
        self.store.ensure_available()
        with self.store.exclusive_lock():
            if key is not None:
                existing, same_body = self.store.find_idempotent(identity.user_id, request, key)
                if existing is not None:
                    if not same_body:
                        raise IdempotencyConflictError
                    return existing, 200
            per_user_limit = (
                self.settings.custom_job_active_per_user_limit
                if is_custom
                else self.settings.job_active_per_user_limit
            )
            if self.store.count_active(identity.user_id) >= per_user_limit:
                raise JobLimitExceededError
            if self.store.count_active() >= self.settings.job_active_global_limit:
                raise JobLimitExceededError
            if is_custom:
                cutoff = datetime.now(UTC) - timedelta(hours=1)
                recent = sum(
                    stored.user_id == identity.user_id and status.created_at >= cutoff
                    for stored, status in self.store.iter_jobs()
                )
                if recent >= self.settings.custom_job_hourly_per_user_limit:
                    raise JobLimitExceededError
            job, _created = self.store.create_job(identity.user_id, request, key)
            record_job_created(request.template_id)
            return job, 201


def _normalize_idempotency_key(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    key = value.strip()
    if not IDEMPOTENCY_KEY_RE.fullmatch(key):
        raise IdempotencyConflictError
    return key


def store_for(settings: Settings, custom: bool) -> JobStore:
    if not custom:
        return JobStore(settings)
    return JobStore(
        settings.model_copy(
            update={
                "jobs_enabled": True,
                "job_spool_root": settings.custom_job_spool_root,
            }
        )
    )
