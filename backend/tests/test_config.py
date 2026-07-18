from typing import Any, cast

from conftest import AUDIENCE, TEAM_DOMAIN
from fastapi.testclient import TestClient

from cimasim_api.config import Settings
from cimasim_api.main import create_app


def test_settings_derives_jwks_url_and_domains() -> None:
    settings = Settings(
        cf_team_domain=f"{TEAM_DOMAIN}/",
        cf_aud=AUDIENCE,
        allowed_email_domains=cast(Any, "UABC.edu.mx, example.edu"),
    )

    assert settings.normalized_team_domain == TEAM_DOMAIN
    assert settings.issuer == TEAM_DOMAIN
    assert settings.jwks_url == f"{TEAM_DOMAIN}/cdn-cgi/access/certs"
    assert settings.allowed_email_domains == ["uabc.edu.mx", "example.edu"]
    assert settings.is_auth_configured is True


def test_team_domain_validation_cases() -> None:
    invalid_domains = [
        "http://cimasim.cloudflareaccess.com",
        "https://example.com",
        "https://cloudflareaccess.com",
        "https://cimasim.cloudflareaccess.com.evil.example",
        "https://user:pass@cimasim.cloudflareaccess.com",
        "https://cimasim.cloudflareaccess.com:8443",
        "https://cimasim.cloudflareaccess.com/path",
        "https://cimasim.cloudflareaccess.com?query=1",
        "https://cimasim.cloudflareaccess.com#fragment",
    ]

    for domain in invalid_domains:
        settings = Settings(
            cf_team_domain=domain,
            cf_aud=AUDIENCE,
            allowed_email_domains=["uabc.edu.mx"],
        )
        assert settings.normalized_team_domain is None
        assert "invalid_team_domain" in settings.auth_configuration_errors
        assert settings.is_auth_configured is False


def test_invalid_team_domain_fails_closed_without_jwks_fetch(key_material) -> None:
    from conftest import FakeJwksFetcher, auth_headers, make_client, make_token

    settings = Settings(
        cf_team_domain="https://example.com",
        cf_aud=AUDIENCE,
        allowed_email_domains=["uabc.edu.mx"],
    )
    fetcher = FakeJwksFetcher([{"keys": []}])

    with make_client(settings, fetcher) as client:
        assert client.get("/healthz").status_code == 200
        assert client.get("/readyz").status_code == 503
        token = make_token(key_material)
        response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 503
    assert fetcher.calls == 0


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
