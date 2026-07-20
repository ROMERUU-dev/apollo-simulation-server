from cimasim_api.errors import ApiError


class JobSpoolUnavailableError(ApiError):
    status_code = 503
    code = "job_spool_unavailable"
    message = "Job spool is unavailable."
    no_store = True


class JobNotFoundError(ApiError):
    status_code = 404
    code = "job_not_found"
    message = "Job was not found."
    no_store = True


class JobLimitExceededError(ApiError):
    status_code = 429
    code = "job_limit_exceeded"
    message = "Job limit exceeded."
    no_store = True


class LegacyTemplateDisabledError(ApiError):
    status_code = 410
    code = "LEGACY_TEMPLATE_DISABLED"
    message = "Legacy RC templates are read-only."
    no_store = True


class CustomNetlistsDisabledError(ApiError):
    status_code = 503
    code = "CUSTOM_NETLISTS_DISABLED"
    message = "Custom netlist execution is not available."
    no_store = True


class IdempotencyConflictError(ApiError):
    status_code = 409
    code = "idempotency_conflict"
    message = "Idempotency-Key was already used with a different request."
    no_store = True


class ArtifactNotFoundError(ApiError):
    status_code = 404
    code = "artifact_not_found"
    message = "Artifact was not found."
    no_store = True
