from __future__ import annotations

import re
from pathlib import Path
from typing import Any, cast
from unittest.mock import AsyncMock

from conftest import FakeJwksFetcher, KeyMaterial, auth_headers, make_client, make_token

from cimasim_api.config import Settings
from cimasim_api.metrics import METRICS_REGISTRY
from cimasim_api.monitoring.auth import _read_allowlist
from cimasim_api.monitoring.models import CimaSimSummary, HostSummary, MonitoringSummary
from cimasim_api.monitoring.service import MonitoringService, MonitoringUnavailableError


def _allowlist(path: Path, email: str = "usuario@uabc.edu.mx") -> Path:
    path.write_text(f"{email}\n", encoding="utf-8")
    path.chmod(0o600)
    return path


def _summary() -> MonitoringSummary:
    return MonitoringSummary(
        generated_at="2026-07-20T00:00:00+00:00",
        status="healthy",
        host=HostSummary(
            cpu_percent=10,
            load_1=1,
            memory_percent=20,
            root_disk_percent=30,
            data_disk_percent=40,
            temperature_celsius=None,
            uptime_seconds=100,
        ),
        cimasim=CimaSimSummary(
            backend_up=True,
            spool_ready=True,
            queued=0,
            running=0,
            completed_total=5,
            failed_total=0,
            p95_duration_seconds=None,
        ),
        alerts=[],
    )


def test_allowlist_requires_private_regular_file(tmp_path: Path) -> None:
    path = _allowlist(tmp_path / "admins")
    assert _read_allowlist(path) == {"usuario@uabc.edu.mx"}
    path.chmod(0o644)
    assert not _read_allowlist(path)
    assert not _read_allowlist(tmp_path / "missing")


def test_admin_summary_authorized(
    settings: Settings,
    fetcher: FakeJwksFetcher,
    key_material: KeyMaterial,
    tmp_path: Path,
) -> None:
    settings.admin_email_allowlist_file = _allowlist(tmp_path / "admins")
    with make_client(settings, fetcher) as client:
        service = MonitoringService(settings)
        service.summary = AsyncMock(return_value=_summary())  # type: ignore[method-assign]
        cast(Any, client.app).state.monitoring_service = service
        response = client.get(
            "/api/admin/monitoring/summary", headers=auth_headers(make_token(key_material))
        )
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["cimasim"]["completed_total"] == 5
    assert "hostname" not in response.text


def test_admin_summary_forbidden_when_absent(
    settings: Settings,
    fetcher: FakeJwksFetcher,
    key_material: KeyMaterial,
) -> None:
    settings.admin_email_allowlist_file = None
    with make_client(settings, fetcher) as client:
        response = client.get(
            "/api/admin/monitoring/summary", headers=auth_headers(make_token(key_material))
        )
    assert response.status_code == 403
    assert "usuario@" not in response.text


def test_prometheus_failure_is_sanitized(
    settings: Settings,
    fetcher: FakeJwksFetcher,
    key_material: KeyMaterial,
    tmp_path: Path,
) -> None:
    settings.admin_email_allowlist_file = _allowlist(tmp_path / "admins")
    with make_client(settings, fetcher) as client:
        service = MonitoringService(settings)
        service.summary = AsyncMock(side_effect=MonitoringUnavailableError)  # type: ignore[method-assign]
        cast(Any, client.app).state.monitoring_service = service
        response = client.get(
            "/api/admin/monitoring/summary", headers=auth_headers(make_token(key_material))
        )
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"
    assert settings.prometheus_url not in response.text


def test_invalid_history_range_is_rejected_before_query(
    settings: Settings,
    fetcher: FakeJwksFetcher,
    key_material: KeyMaterial,
    tmp_path: Path,
) -> None:
    settings.admin_email_allowlist_file = _allowlist(tmp_path / "admins")
    with make_client(settings, fetcher) as client:
        response = client.get(
            "/api/admin/monitoring/history?range=7d",
            headers=auth_headers(make_token(key_material)),
        )
    assert response.status_code == 422


def test_metrics_omit_high_cardinality_identity(client: object) -> None:
    # Registry exposition is aggregate and cannot contain request or user identifiers.
    from prometheus_client import generate_latest

    payload = generate_latest(METRICS_REGISTRY).decode("utf-8")
    assert "user_id" not in payload
    assert re.search(r"job_[0-9a-f]{32}", payload) is None
    assert "email" not in payload
    assert "PULSE(" not in payload
