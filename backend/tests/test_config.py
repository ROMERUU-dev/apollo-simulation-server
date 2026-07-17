from conftest import AUDIENCE, TEAM_DOMAIN
from fastapi.testclient import TestClient

from cimasim_api.config import Settings
from cimasim_api.main import create_app


def test_settings_derives_jwks_url_and_domains() -> None:
    settings = Settings(
        cf_team_domain=f"{TEAM_DOMAIN}/",
        cf_aud=AUDIENCE,
        allowed_email_domains="UABC.edu.mx, example.edu",
    )

    assert settings.normalized_team_domain == TEAM_DOMAIN
    assert settings.issuer == TEAM_DOMAIN
    assert settings.jwks_url == f"{TEAM_DOMAIN}/cdn-cgi/access/certs"
    assert settings.allowed_email_domains == ["uabc.edu.mx", "example.edu"]
    assert settings.is_auth_configured is True


def test_settings_reports_invalid_auth_configuration() -> None:
    settings = Settings(
        cf_team_domain=None,
        cf_aud="",
        allowed_email_domains=[],
        jwks_ttl_seconds=0,
        jwks_timeout_seconds=0,
        jwks_max_bytes=0,
    )

    assert settings.auth_configuration_errors == [
        "missing_team_domain",
        "missing_audience",
        "missing_allowed_email_domains",
        "invalid_jwks_ttl",
        "invalid_jwks_timeout",
        "invalid_jwks_max_bytes",
    ]
    assert settings.is_auth_configured is False


def test_docs_can_be_enabled_explicitly() -> None:
    settings = Settings(
        cf_team_domain=TEAM_DOMAIN,
        cf_aud=AUDIENCE,
        allowed_email_domains=["uabc.edu.mx"],
        enable_docs=True,
    )
    app = create_app(settings)

    with TestClient(app) as client:
        assert client.get("/openapi.json").status_code == 200
