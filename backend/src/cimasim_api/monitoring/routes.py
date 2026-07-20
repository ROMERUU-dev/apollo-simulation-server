from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response

from cimasim_api.config import Settings, get_app_settings
from cimasim_api.models import Identity
from cimasim_api.monitoring.auth import administrative_identity
from cimasim_api.monitoring.models import (
    CimaSimSummary,
    HostSummary,
    MonitoringHistory,
    MonitoringSummary,
)
from cimasim_api.monitoring.service import MonitoringService, MonitoringUnavailableError

router = APIRouter(prefix="/api/admin/monitoring", tags=["admin-monitoring"])


def _service(
    request: Request, settings: Annotated[Settings, Depends(get_app_settings)]
) -> MonitoringService:
    service = getattr(request.app.state, "monitoring_service", None)
    if not isinstance(service, MonitoringService):
        service = MonitoringService(settings)
        request.app.state.monitoring_service = service
    return service


@router.get("/summary", response_model=MonitoringSummary)
async def summary(
    response: Response,
    _identity: Annotated[Identity, Depends(administrative_identity)],
    service: Annotated[MonitoringService, Depends(_service)],
) -> MonitoringSummary:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await service.summary()
    except MonitoringUnavailableError:
        return MonitoringSummary(
            generated_at=datetime.now(UTC).isoformat(),
            status="unavailable",
            host=HostSummary(
                cpu_percent=0,
                load_1=0,
                memory_percent=0,
                root_disk_percent=0,
                data_disk_percent=0,
                temperature_celsius=None,
                uptime_seconds=0,
            ),
            cimasim=CimaSimSummary(
                backend_up=False,
                spool_ready=False,
                queued=0,
                running=0,
                completed_total=0,
                failed_total=0,
                p95_duration_seconds=None,
            ),
            alerts=[],
        )


@router.get("/history", response_model=MonitoringHistory)
async def history(
    response: Response,
    _identity: Annotated[Identity, Depends(administrative_identity)],
    service: Annotated[MonitoringService, Depends(_service)],
    selected_range: Literal["15m", "1h", "6h", "24h"] = Query("1h", alias="range"),
) -> MonitoringHistory:
    response.headers["Cache-Control"] = "no-store"
    try:
        return await service.history(selected_range)
    except MonitoringUnavailableError:
        return MonitoringHistory(
            generated_at=datetime.now(UTC).isoformat(), range=selected_range, series=[]
        )
