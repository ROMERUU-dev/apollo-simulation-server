import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

from conftest import AUDIENCE, TEAM_DOMAIN, auth_headers, make_client, make_token
from fastapi.testclient import TestClient

from cimasim_api.config import Settings
from cimasim_api.jobs.store import SPOOL_DIR_MODE
from cimasim_api.main import create_app


def make_spool(root: Path) -> None:
    root.mkdir(mode=SPOOL_DIR_MODE)
    os.chmod(root, SPOOL_DIR_MODE)
    for name in ("queued", "claimed", "jobs", "failed"):
        path = root / name
        path.mkdir(mode=SPOOL_DIR_MODE)
        os.chmod(path, SPOOL_DIR_MODE)


def test_healthz_responds_without_authentication(client: TestClient) -> None:
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "cimasim-api", "version": "v1"}


def test_readyz_responds_200_with_valid_configuration(client: TestClient) -> None:
    response = client.get("/readyz")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "service": "cimasim-api",
        "dependencies": {"auth_configuration": "ok", "custom_subsystem": "disabled"},
    }


def test_readyz_responds_503_with_incomplete_configuration() -> None:
    settings = Settings(
        env="test",
        cf_team_domain=TEAM_DOMAIN,
        cf_aud="",
        allowed_email_domains=["uabc.edu.mx"],
        enable_docs=False,
    )
    app = create_app(settings)

    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "service": "cimasim-api",
        "dependencies": {"auth_configuration": "unavailable"},
    }


def test_api_health_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


def test_api_health_returns_limited_authenticated_status(client, key_material) -> None:
    token = make_token(key_material, audience=AUDIENCE)

    response = client.get("/api/health", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {
        "status": "ok",
        "service": "cimasim",
        "features": {
            "identity": "available",
            "job_submission": "not_available",
            "custom_netlists": "disabled",
        },
    }
    serialized = response.text.lower()
    assert "cimasim.cloudflareaccess.com" not in serialized
    assert "test-audience" not in serialized


def test_create_app_custom_settings_control_readyz_without_overrides() -> None:
    valid_settings = Settings(
        env="test",
        cf_team_domain=TEAM_DOMAIN,
        cf_aud=AUDIENCE,
        allowed_email_domains=["uabc.edu.mx"],
    )
    invalid_settings = Settings(
        env="test",
        cf_team_domain=TEAM_DOMAIN,
        cf_aud="",
        allowed_email_domains=["uabc.edu.mx"],
    )

    with TestClient(create_app(valid_settings)) as valid_client:
        assert valid_client.get("/readyz").status_code == 200
    with TestClient(create_app(invalid_settings)) as invalid_client:
        assert invalid_client.get("/readyz").status_code == 503


def test_readiness_and_verifier_share_app_settings_instance() -> None:
    settings = Settings(
        env="test",
        cf_team_domain=TEAM_DOMAIN,
        cf_aud=AUDIENCE,
        allowed_email_domains=["uabc.edu.mx"],
    )
    app = create_app(settings)

    assert app.state.settings is settings
    assert app.state.auth_verifier.settings is settings
    with TestClient(app) as client:
        assert client.get("/readyz").status_code == 200


def test_readyz_probes_complete_job_spool_without_leaving_files(
    settings: Settings, tmp_path: Path
) -> None:
    spool = tmp_path / "spool"
    make_spool(spool)
    app = create_app(settings.model_copy(update={"jobs_enabled": True, "job_spool_root": spool}))

    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 200
    assert response.json()["dependencies"]["job_spool"] == "ok"
    assert sorted(path.name for path in spool.iterdir()) == [
        "claimed",
        "failed",
        "jobs",
        "queued",
    ]


def test_readyz_rejects_symlinked_spool_subdirectory(settings: Settings, tmp_path: Path) -> None:
    spool = tmp_path / "spool"
    make_spool(spool)
    (spool / "queued").rmdir()
    (spool / "queued").symlink_to(spool / "jobs", target_is_directory=True)
    app = create_app(settings.model_copy(update={"jobs_enabled": True, "job_spool_root": spool}))

    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json()["dependencies"]["job_spool"] == "unavailable"
    assert str(spool) not in response.text


def test_api_health_degrades_when_enabled_spool_is_unavailable(
    settings: Settings, fetcher, key_material, tmp_path: Path
) -> None:
    spool = tmp_path / "missing"
    enabled = settings.model_copy(update={"jobs_enabled": True, "job_spool_root": spool})
    token = make_token(key_material, audience=AUDIENCE)

    with make_client(enabled, fetcher) as client:
        response = client.get("/api/health", headers=auth_headers(token))

    assert response.status_code == 503
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {
        "status": "degraded",
        "service": "cimasim",
        "features": {
            "identity": "available",
            "job_submission": "temporarily_unavailable",
            "custom_netlists": "disabled",
        },
    }
    assert str(spool) not in response.text


def test_api_health_reports_jobs_available_after_spool_probe(
    settings: Settings, fetcher, key_material, tmp_path: Path
) -> None:
    spool = tmp_path / "spool"
    make_spool(spool)
    enabled = settings.model_copy(update={"jobs_enabled": True, "job_spool_root": spool})
    token = make_token(key_material, audience=AUDIENCE)

    with make_client(enabled, fetcher) as client:
        response = client.get("/api/health", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["features"]["job_submission"] == "available"


def make_custom_spool(root: Path, *, heartbeat_age_seconds: int = 0) -> None:
    make_spool(root)
    failed = root / "failed"
    if failed.exists():
        failed.rmdir()
    state = root / "state"
    state.mkdir(mode=SPOOL_DIR_MODE)
    os.chmod(state, SPOOL_DIR_MODE)
    updated_at = datetime.now(UTC) - timedelta(seconds=heartbeat_age_seconds)
    (state / "dispatcher.json").write_text(
        json.dumps(
            {
                "status": "idle",
                "updated_at": updated_at.isoformat(),
                "runner_image_digest": "sha256:aaaaaaaaaaaa",
                "jobs_claimed_total": 0,
                "last_completion_at": None,
                "last_error_code": None,
            }
        ),
        encoding="utf-8",
    )
    os.chmod(state / "dispatcher.json", 0o660)


def test_readyz_requires_recent_dispatcher_heartbeat_when_custom_enabled(
    settings: Settings, tmp_path: Path
) -> None:
    custom = tmp_path / "custom"
    make_custom_spool(custom, heartbeat_age_seconds=120)
    app = create_app(
        settings.model_copy(
            update={
                "custom_netlists_enabled": True,
                "custom_job_spool_root": custom,
                "custom_dispatcher_heartbeat_ttl_seconds": 30,
            }
        )
    )

    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 503
    assert response.json()["dependencies"]["custom_subsystem"] == "unavailable"


def test_readyz_accepts_recent_dispatcher_heartbeat_when_custom_enabled(
    settings: Settings, tmp_path: Path
) -> None:
    custom = tmp_path / "custom"
    make_custom_spool(custom)
    app = create_app(
        settings.model_copy(
            update={"custom_netlists_enabled": True, "custom_job_spool_root": custom}
        )
    )

    with TestClient(app) as client:
        response = client.get("/readyz")

    assert response.status_code == 200
    assert response.json()["dependencies"]["custom_subsystem"] == "ok"
