from conftest import AUDIENCE, TEAM_DOMAIN, auth_headers, make_token
from fastapi.testclient import TestClient

from cimasim_api.config import Settings, get_settings
from cimasim_api.main import create_app


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
        "dependencies": {"auth_configuration": "ok"},
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
    app.dependency_overrides[get_settings] = lambda: settings

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
        "features": {"identity": "available", "job_submission": "not_available"},
    }
    serialized = response.text.lower()
    assert "cimasim.cloudflareaccess.com" not in serialized
    assert "test-audience" not in serialized
