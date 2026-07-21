from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from ipaddress import ip_address, ip_network

from fastapi import APIRouter, HTTPException, Request
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

METRICS_REGISTRY = CollectorRegistry()

HTTP_REQUESTS = Counter(
    "cimasim_http_requests_total",
    "CimaSim API requests by normalized route.",
    ("method", "route", "status_class"),
    registry=METRICS_REGISTRY,
)
HTTP_DURATION = Histogram(
    "cimasim_http_request_duration_seconds",
    "CimaSim API request duration by normalized route.",
    ("method", "route"),
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5),
    registry=METRICS_REGISTRY,
)
JOBS_CREATED = Counter(
    "cimasim_jobs_created_total",
    "Jobs accepted by the API.",
    ("job_kind",),
    registry=METRICS_REGISTRY,
)
CUSTOM_DISPATCHER_UP = Gauge(
    "cimasim_custom_dispatcher_up",
    "Whether the custom dispatcher heartbeat is currently fresh.",
    registry=METRICS_REGISTRY,
)
CUSTOM_DISPATCHER_HEARTBEAT_AGE = Gauge(
    "cimasim_custom_dispatcher_heartbeat_age_seconds",
    "Age of the sanitized custom dispatcher heartbeat.",
    registry=METRICS_REGISTRY,
)


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.url.path == "/metrics":
            return await call_next(request)
        started = time.perf_counter()
        response = await call_next(request)
        route = request.scope.get("route")
        route_path = getattr(route, "path", "unmatched")
        if not isinstance(route_path, str):
            route_path = "unmatched"
        method = request.method if request.method in {"GET", "HEAD", "POST"} else "OTHER"
        HTTP_REQUESTS.labels(method, route_path, f"{response.status_code // 100}xx").inc()
        HTTP_DURATION.labels(method, route_path).observe(time.perf_counter() - started)
        return response


metrics_router = APIRouter(include_in_schema=False)


@metrics_router.get("/metrics")
def metrics(request: Request) -> Response:
    client = request.client
    try:
        allowed = ip_network(request.app.state.settings.metrics_allowed_cidr, strict=True)
        address = ip_address(client.host if client is not None else "")
    except ValueError as exc:
        raise HTTPException(status_code=404) from exc
    if address not in allowed:
        raise HTTPException(status_code=404)
    _update_custom_dispatcher_metrics(request)
    return Response(generate_latest(METRICS_REGISTRY), media_type=CONTENT_TYPE_LATEST)


def record_job_created(template_id: str) -> None:
    kind = {
        "rc_lowpass_fixed_v1": "legacy_rc_fixed",
        "rc_lowpass_param_v1": "legacy_rc_param",
        "custom_xyce_netlist_v1": "custom_netlist",
    }.get(template_id, "custom_netlist")
    JOBS_CREATED.labels(kind).inc()


def _update_custom_dispatcher_metrics(request: Request) -> None:
    settings = request.app.state.settings
    if not getattr(settings, "custom_netlists_enabled", False):
        CUSTOM_DISPATCHER_UP.set(0)
        CUSTOM_DISPATCHER_HEARTBEAT_AGE.set(float("nan"))
        return
    heartbeat = settings.custom_job_spool_root / "state" / "dispatcher.json"
    try:
        import json

        data = json.loads(heartbeat.read_text(encoding="utf-8"))
        updated_at = datetime.fromisoformat(str(data["updated_at"]).replace("Z", "+00:00"))
        age = (datetime.now(UTC) - updated_at.astimezone(UTC)).total_seconds()
        CUSTOM_DISPATCHER_HEARTBEAT_AGE.set(max(age, 0.0))
        CUSTOM_DISPATCHER_UP.set(
            1
            if age <= settings.custom_dispatcher_heartbeat_ttl_seconds
            and data.get("status") in {"idle", "running", "stopping"}
            else 0
        )
    except (OSError, ValueError, KeyError, TypeError):
        CUSTOM_DISPATCHER_UP.set(0)
        CUSTOM_DISPATCHER_HEARTBEAT_AGE.set(float("nan"))
