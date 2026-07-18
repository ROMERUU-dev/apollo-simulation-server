from __future__ import annotations

import json
import threading
from collections.abc import Iterator
from types import TracebackType
from typing import Any, cast

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


def test_valid_not_before_is_accepted(client: TestClient, key_material) -> None:
    token = make_token(key_material, not_before_delta=-1)

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 200


def test_audience_list_with_configured_audience_is_accepted(
    client: TestClient, key_material
) -> None:
    token = make_token(key_material, audience=[AUDIENCE])

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 200


def test_audience_list_without_configured_audience_is_rejected(
    client: TestClient, key_material
) -> None:
    token = make_token(key_material, audience=["other-audience"])

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 401


def test_audience_list_with_multiple_values_is_accepted(client: TestClient, key_material) -> None:
    token = make_token(key_material, audience=["other-audience", AUDIENCE])

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 200


def test_service_token_without_email_and_blank_sub_is_rejected(
    client: TestClient, key_material
) -> None:
    token = make_token(key_material, subject="", email=None)

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
    empty_jwks: dict[str, list[dict[str, Any]]] = {"keys": []}
    rotated_jwk = json.loads(RSAAlgorithm.to_jwk(key_material.private_key.public_key()))
    rotated_jwk.update({"kid": "rotated", "alg": "RS256", "use": "sig"})
    valid_jwks = {"keys": [rotated_jwk]}
    fetcher = FakeJwksFetcher([empty_jwks, valid_jwks])
    client = make_client(settings, fetcher)
    token = make_token(key_material, kid="rotated")

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 200
    assert fetcher.calls == 2


def test_invalid_refresh_does_not_replace_valid_cached_jwks(
    settings: Settings, key_material, jwks
) -> None:
    fetcher = FakeJwksFetcher([jwks, {"not_keys": []}])
    client = make_client(settings, fetcher)
    valid_token = make_token(key_material)
    unknown_kid_token = make_token(key_material, kid="unknown")

    assert client.get("/api/me", headers=auth_headers(valid_token)).status_code == 200
    assert client.get("/api/me", headers=auth_headers(unknown_kid_token)).status_code == 401
    assert client.get("/api/me", headers=auth_headers(valid_token)).status_code == 200
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


class FakeStreamResponse:
    def __init__(
        self,
        chunks: list[bytes],
        *,
        status_error: bool = False,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.chunks = chunks
        self.status_error = status_error
        self.headers = headers or {}
        self.closed = False

    def __enter__(self) -> FakeStreamResponse:
        return self

    def __exit__(
        self,
        _exc_type: type[BaseException] | None,
        _exc: BaseException | None,
        _traceback: TracebackType | None,
    ) -> None:
        self.closed = True

    def raise_for_status(self) -> None:
        if self.status_error:
            raise httpx.HTTPStatusError(
                "failed",
                request=httpx.Request("GET", "https://example.test"),
                response=httpx.Response(500),
            )

    def iter_bytes(self) -> Iterator[bytes]:
        yield from self.chunks


class FakeStreamClient:
    def __init__(self, response: FakeStreamResponse) -> None:
        self.response = response
        self.timeout: float | None = None
        self.follow_redirects: bool | None = None
        self.closed = False

    def __call__(self, timeout: float, follow_redirects: bool) -> FakeStreamClient:
        self.timeout = timeout
        self.follow_redirects = follow_redirects
        return self

    def __enter__(self) -> FakeStreamClient:
        return self

    def __exit__(
        self,
        _exc_type: type[BaseException] | None,
        _exc: BaseException | None,
        _traceback: TracebackType | None,
    ) -> None:
        self.closed = True

    def stream(self, method: str, url: str) -> FakeStreamResponse:
        assert method == "GET"
        assert url == "https://cimasim.cloudflareaccess.com/cdn-cgi/access/certs"
        return self.response


def test_fetch_jwks_uses_configured_url_timeout_and_size(monkeypatch) -> None:
    response = FakeStreamResponse([b'{"keys":[]}'])
    client = FakeStreamClient(response)
    monkeypatch.setattr("cimasim_api.auth.verifier.httpx.Client", client)

    payload = fetch_jwks("https://cimasim.cloudflareaccess.com/cdn-cgi/access/certs", 0.5, 100)

    assert payload == {"keys": []}
    assert client.timeout == 0.5
    assert client.follow_redirects is False
    assert client.closed is True
    assert response.closed is True


def test_fetch_jwks_rejects_excessive_content_length(monkeypatch) -> None:
    response = FakeStreamResponse([b"{}"], headers={"Content-Length": "101"})
    monkeypatch.setattr("cimasim_api.auth.verifier.httpx.Client", FakeStreamClient(response))

    try:
        fetch_jwks("https://cimasim.cloudflareaccess.com/cdn-cgi/access/certs", 0.5, 100)
    except ValueError as exc:
        assert str(exc) == "jwks_response_too_large"
    else:
        raise AssertionError("oversized JWKS was accepted")


def test_fetch_jwks_rejects_chunked_response_over_limit(monkeypatch) -> None:
    response = FakeStreamResponse([b'{"keys":', b"[]", b"}"])
    monkeypatch.setattr("cimasim_api.auth.verifier.httpx.Client", FakeStreamClient(response))

    try:
        fetch_jwks("https://cimasim.cloudflareaccess.com/cdn-cgi/access/certs", 0.5, 10)
    except ValueError as exc:
        assert str(exc) == "jwks_response_too_large"
    else:
        raise AssertionError("oversized JWKS was accepted")


def test_fetch_jwks_accepts_response_exactly_at_limit(monkeypatch) -> None:
    body = b'{"keys":[]}'
    response = FakeStreamResponse([body[:3], body[3:]])
    monkeypatch.setattr("cimasim_api.auth.verifier.httpx.Client", FakeStreamClient(response))

    assert fetch_jwks(
        "https://cimasim.cloudflareaccess.com/cdn-cgi/access/certs", 0.5, len(body)
    ) == {"keys": []}


def test_fetch_jwks_rejects_invalid_json(monkeypatch) -> None:
    response = FakeStreamResponse([b"{"])
    monkeypatch.setattr("cimasim_api.auth.verifier.httpx.Client", FakeStreamClient(response))

    try:
        fetch_jwks("https://cimasim.cloudflareaccess.com/cdn-cgi/access/certs", 0.5, 100)
    except json.JSONDecodeError:
        pass
    else:
        raise AssertionError("invalid JSON was accepted")


def test_fetch_jwks_rejects_http_error(monkeypatch) -> None:
    response = FakeStreamResponse([b'{"keys":[]}'], status_error=True)
    monkeypatch.setattr("cimasim_api.auth.verifier.httpx.Client", FakeStreamClient(response))

    try:
        fetch_jwks("https://cimasim.cloudflareaccess.com/cdn-cgi/access/certs", 0.5, 100)
    except httpx.HTTPStatusError:
        pass
    else:
        raise AssertionError("HTTP error was accepted")


def test_fetch_jwks_rejects_timeout(monkeypatch) -> None:
    class TimeoutClient(FakeStreamClient):
        def stream(self, method: str, url: str) -> FakeStreamResponse:
            raise httpx.TimeoutException("timeout")

    monkeypatch.setattr(
        "cimasim_api.auth.verifier.httpx.Client",
        TimeoutClient(FakeStreamResponse([])),
    )

    try:
        fetch_jwks("https://cimasim.cloudflareaccess.com/cdn-cgi/access/certs", 0.5, 100)
    except httpx.TimeoutException:
        pass
    else:
        raise AssertionError("timeout was accepted")


def test_jwks_cache_reuses_single_refresh_for_concurrent_empty_cache(
    settings: Settings, key_material, jwks
) -> None:
    lock = threading.Lock()
    entered = threading.Event()
    release = threading.Event()
    calls = 0

    def controlled_fetcher(_url: str, _timeout: float, _max_bytes: int):
        nonlocal calls
        with lock:
            calls += 1
            if calls == 1:
                entered.set()
        release.wait(timeout=2)
        return jwks

    client = make_client(settings, FakeJwksFetcher([jwks]))
    cast(Any, client.app).state.auth_verifier._jwks_cache.fetcher = controlled_fetcher
    token = make_token(key_material)
    results: list[int] = []

    def request_me() -> None:
        results.append(client.get("/api/me", headers=auth_headers(token)).status_code)

    threads = [threading.Thread(target=request_me) for _ in range(4)]
    for thread in threads:
        thread.start()
    assert entered.wait(timeout=2)
    release.set()
    for thread in threads:
        thread.join(timeout=2)

    assert results == [200, 200, 200, 200]
    assert calls == 1


def test_jwk_rejects_wrong_kty(settings: Settings, key_material, jwks) -> None:
    bad_jwk = {**jwks["keys"][0], "kty": "EC"}
    client = make_client(settings, FakeJwksFetcher([{"keys": [bad_jwk]}]))
    token = make_token(key_material)

    assert client.get("/api/me", headers=auth_headers(token)).status_code == 401


def test_jwk_rejects_wrong_alg(settings: Settings, key_material, jwks) -> None:
    bad_jwk = {**jwks["keys"][0], "alg": "RS512"}
    client = make_client(settings, FakeJwksFetcher([{"keys": [bad_jwk]}]))
    token = make_token(key_material)

    assert client.get("/api/me", headers=auth_headers(token)).status_code == 401


def test_jwk_rejects_wrong_use(settings: Settings, key_material, jwks) -> None:
    bad_jwk = {**jwks["keys"][0], "use": "enc"}
    client = make_client(settings, FakeJwksFetcher([{"keys": [bad_jwk]}]))
    token = make_token(key_material)

    assert client.get("/api/me", headers=auth_headers(token)).status_code == 401


def test_jwk_rejects_empty_kid(settings: Settings, key_material, jwks) -> None:
    bad_jwk = {**jwks["keys"][0], "kid": ""}
    client = make_client(settings, FakeJwksFetcher([{"keys": [bad_jwk]}]))
    token = make_token(key_material, kid="")

    assert client.get("/api/me", headers=auth_headers(token)).status_code == 401


def test_jwk_accepts_valid_rsa_key(client: TestClient, key_material) -> None:
    token = make_token(key_material)

    assert client.get("/api/me", headers=auth_headers(token)).status_code == 200


def test_unexpected_exception_returns_stable_json() -> None:
    from fastapi import APIRouter

    from cimasim_api.main import create_app

    router = APIRouter()

    @router.get("/boom")
    def boom() -> None:
        raise RuntimeError("sensitive internal failure")

    app = create_app(
        Settings(
            cf_team_domain=TEAM_DOMAIN,
            cf_aud=AUDIENCE,
            allowed_email_domains=["uabc.edu.mx"],
        )
    )
    app.include_router(router)

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/boom")

    assert response.status_code == 500
    assert response.headers["cache-control"] == "no-store"
    body = response.text
    assert "sensitive internal failure" not in body
    assert "traceback" not in body.lower()
    assert response.json()["error"]["request_id"]


def test_importing_main_does_not_create_global_app() -> None:
    import cimasim_api.main as main_module

    assert not hasattr(main_module, "app")
    assert callable(main_module.create_app)


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
