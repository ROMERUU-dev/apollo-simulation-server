from __future__ import annotations

import json

import httpx
from conftest import (
    AUDIENCE,
    TEAM_DOMAIN,
    FakeJwksFetcher,
    auth_headers,
    make_client,
    make_token,
)
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from jwt.algorithms import RSAAlgorithm

from cimasim_api.auth.verifier import fetch_jwks
from cimasim_api.config import Settings


def assert_auth_error_is_sanitized(response, token: str) -> None:
    body = response.text
    assert token not in body
    assert AUDIENCE not in body
    assert TEAM_DOMAIN not in body
    assert "test-key" not in body
    assert "Usuario@UABC.edu.mx" not in body
    assert "claims" not in body.lower()
    assert "traceback" not in body.lower()
    assert "request_id" in response.json()["error"]


def test_valid_token_is_accepted(client: TestClient, key_material) -> None:
    token = make_token(key_material)

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 200


def test_missing_header_is_401(client: TestClient) -> None:
    response = client.get("/api/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_required"


def test_cookie_is_not_used_as_substitute_for_header(client: TestClient, key_material) -> None:
    token = make_token(key_material)
    client.cookies.set("CF_Authorization", token)

    response = client.get("/api/me")

    assert response.status_code == 401


def test_forwarded_headers_do_not_grant_identity(client: TestClient) -> None:
    response = client.get(
        "/api/me",
        headers={
            "X-Forwarded-User": "user@uabc.edu.mx",
            "Cf-Access-Authenticated-User-Email": "user@uabc.edu.mx",
        },
    )

    assert response.status_code == 401


def test_invalid_signature_is_401(settings: Settings, key_material, jwks) -> None:
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    original_private_key = key_material.private_key
    key_material.private_key = other_key
    other_token = make_token(key_material, email="other@uabc.edu.mx")
    key_material.private_key = original_private_key
    fetcher = FakeJwksFetcher([jwks])
    client = make_client(settings, fetcher)

    response = client.get("/api/me", headers=auth_headers(other_token))

    assert response.status_code == 401
    assert_auth_error_is_sanitized(response, other_token)


def test_algorithm_other_than_rs256_is_rejected(client: TestClient, key_material) -> None:
    token = make_token(key_material, alg="HS256")

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401
    assert_auth_error_is_sanitized(response, token)


def test_wrong_issuer_is_rejected(client: TestClient, key_material) -> None:
    token = make_token(key_material, issuer="https://other.cloudflareaccess.com")

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401
    assert_auth_error_is_sanitized(response, token)


def test_wrong_audience_is_rejected(client: TestClient, key_material) -> None:
    token = make_token(key_material, audience="wrong-audience")

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401
    assert_auth_error_is_sanitized(response, token)


def test_expired_token_is_rejected(client: TestClient, key_material) -> None:
    token = make_token(key_material, expires_delta=-1)

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401


def test_future_not_before_is_rejected(client: TestClient, key_material) -> None:
    token = make_token(key_material, not_before_delta=300)

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401


def test_unknown_kid_is_rejected_after_refresh(settings: Settings, key_material, jwks) -> None:
    fetcher = FakeJwksFetcher([jwks, jwks])
    client = make_client(settings, fetcher)
    token = make_token(key_material, kid="unknown")

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401
    assert fetcher.calls == 2


def test_missing_sub_is_rejected(client: TestClient, key_material) -> None:
    token = make_token(key_material, subject=None)

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401


def test_missing_email_is_rejected(client: TestClient, key_material) -> None:
    token = make_token(key_material, email=None)

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401


def test_type_other_than_app_is_rejected(client: TestClient, key_material) -> None:
    token = make_token(key_material, token_type="org")

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401


def test_incomplete_auth_configuration_is_503(key_material) -> None:
    settings = Settings(
        env="test",
        cf_team_domain=TEAM_DOMAIN,
        cf_aud="",
        allowed_email_domains=["uabc.edu.mx"],
    )
    fetcher = FakeJwksFetcher([{"keys": []}])
    client = make_client(settings, fetcher)
    token = make_token(key_material)

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "auth_configuration_unavailable"
    assert fetcher.calls == 0


def test_jwks_refresh_after_unknown_kid_accepts_new_key(settings: Settings, key_material) -> None:
    empty_jwks = {"keys": []}
    rotated_jwk = json.loads(RSAAlgorithm.to_jwk(key_material.private_key.public_key()))
    rotated_jwk.update({"kid": "rotated", "alg": "RS256", "use": "sig"})
    valid_jwks = {"keys": [rotated_jwk]}
    fetcher = FakeJwksFetcher([empty_jwks, valid_jwks])
    client = make_client(settings, fetcher)
    token = make_token(key_material, kid="rotated")

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 200
    assert fetcher.calls == 2


def test_jwks_cache_avoids_network_call_per_valid_request(
    client: TestClient, key_material, fetcher
) -> None:
    token = make_token(key_material)

    first = client.get("/api/me", headers=auth_headers(token))
    second = client.get("/api/me", headers=auth_headers(token))

    assert first.status_code == 200
    assert second.status_code == 200
    assert fetcher.calls == 1


def test_fetch_jwks_uses_configured_url_timeout_and_size(monkeypatch) -> None:
    class FakeResponse:
        content = b'{"keys":[]}'

        def raise_for_status(self) -> None:
            return None

        def json(self):
            return {"keys": []}

    class FakeClient:
        def __init__(self, timeout: float, follow_redirects: bool) -> None:
            self.timeout = timeout
            self.follow_redirects = follow_redirects

        def __enter__(self):
            return self

        def __exit__(self, *_args) -> None:
            return None

        def get(self, url: str):
            assert url == "https://cimasim.cloudflareaccess.com/cdn-cgi/access/certs"
            assert self.timeout == 0.5
            assert self.follow_redirects is False
            return FakeResponse()

    monkeypatch.setattr("cimasim_api.auth.verifier.httpx.Client", FakeClient)

    payload = fetch_jwks("https://cimasim.cloudflareaccess.com/cdn-cgi/access/certs", 0.5, 100)

    assert payload == {"keys": []}


def test_fetch_jwks_rejects_oversized_response(monkeypatch) -> None:
    class FakeResponse:
        content = b'{"keys":[]}'

        def raise_for_status(self) -> None:
            return None

        def json(self):
            return {"keys": []}

    class FakeClient:
        def __init__(self, timeout: float, follow_redirects: bool) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args) -> None:
            return None

        def get(self, _url: str):
            return FakeResponse()

    monkeypatch.setattr("cimasim_api.auth.verifier.httpx.Client", FakeClient)

    try:
        fetch_jwks("https://cimasim.cloudflareaccess.com/cdn-cgi/access/certs", 0.5, 1)
    except ValueError as exc:
        assert str(exc) == "jwks_response_too_large"
    else:
        raise AssertionError("oversized JWKS was accepted")


def test_fetch_jwks_rejects_non_object_payload(monkeypatch) -> None:
    class FakeResponse:
        content = b"[]"

        def raise_for_status(self) -> None:
            return None

        def json(self):
            return []

    class FakeClient:
        def __init__(self, timeout: float, follow_redirects: bool) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args) -> None:
            return None

        def get(self, _url: str):
            return FakeResponse()

    monkeypatch.setattr("cimasim_api.auth.verifier.httpx.Client", FakeClient)

    try:
        fetch_jwks("https://cimasim.cloudflareaccess.com/cdn-cgi/access/certs", 0.5, 100)
    except ValueError as exc:
        assert str(exc) == "jwks_malformed"
    else:
        raise AssertionError("malformed JWKS was accepted")


def test_jwks_timeout_is_401(settings: Settings, key_material) -> None:
    fetcher = FakeJwksFetcher([], exception=httpx.TimeoutException("timeout"))
    client = make_client(settings, fetcher)
    token = make_token(key_material)

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401


def test_malformed_jwks_is_401(settings: Settings, key_material) -> None:
    fetcher = FakeJwksFetcher([{"not_keys": []}])
    client = make_client(settings, fetcher)
    token = make_token(key_material)

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401


def test_jwt_never_appears_in_logs(client: TestClient, key_material, caplog) -> None:
    token = make_token(key_material, audience="wrong-audience")

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401
    assert token not in caplog.text


def test_docs_are_disabled_by_default(client: TestClient) -> None:
    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404
    assert client.get("/openapi.json").status_code == 404
