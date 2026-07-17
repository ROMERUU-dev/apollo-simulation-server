from __future__ import annotations

import json
import time
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from jwt.algorithms import RSAAlgorithm

from cimasim_api.auth.verifier import CloudflareAccessVerifier, JwksCache
from cimasim_api.config import Settings, get_settings
from cimasim_api.main import create_app

TEAM_DOMAIN = "https://cimasim.cloudflareaccess.com"
AUDIENCE = "test-audience"
KID = "test-key-1"


@dataclass
class KeyMaterial:
    private_key: rsa.RSAPrivateKey
    public_jwk: dict[str, Any]
    kid: str = KID


@dataclass
class FakeJwksFetcher:
    responses: list[dict[str, Any]]
    calls: int = 0
    exception: Exception | None = None
    seen: list[tuple[str, float, int]] = field(default_factory=list)

    def __call__(self, url: str, timeout_seconds: float, max_bytes: int) -> dict[str, Any]:
        self.calls += 1
        self.seen.append((url, timeout_seconds, max_bytes))
        if self.exception is not None:
            raise self.exception
        if len(self.responses) == 1:
            return self.responses[0]
        return self.responses.pop(0)


@pytest.fixture()
def key_material() -> KeyMaterial:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = json.loads(RSAAlgorithm.to_jwk(private_key.public_key()))
    public_jwk.update({"kid": KID, "alg": "RS256", "use": "sig"})
    return KeyMaterial(private_key=private_key, public_jwk=public_jwk)


@pytest.fixture()
def settings() -> Settings:
    return Settings(
        env="test",
        cf_team_domain=TEAM_DOMAIN,
        cf_aud=AUDIENCE,
        allowed_email_domains=["uabc.edu.mx"],
        enable_docs=False,
        jwks_ttl_seconds=300,
        jwks_timeout_seconds=0.25,
        jwks_max_bytes=65536,
    )


def make_token(
    key_material: KeyMaterial,
    *,
    kid: str = KID,
    alg: str = "RS256",
    issuer: str = TEAM_DOMAIN,
    audience: str = AUDIENCE,
    subject: str | None = "user-123",
    email: str | None = "Usuario@UABC.edu.mx",
    token_type: str | None = "app",
    expires_delta: int = 300,
    not_before_delta: int | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    now = int(time.time())
    claims: dict[str, Any] = {
        "iss": issuer,
        "aud": audience,
        "exp": now + expires_delta,
        "iat": now,
    }
    if subject is not None:
        claims["sub"] = subject
    if email is not None:
        claims["email"] = email
    if token_type is not None:
        claims["type"] = token_type
    if not_before_delta is not None:
        claims["nbf"] = now + not_before_delta
    if extra_claims:
        claims.update(extra_claims)

    signing_key: Any
    if alg == "HS256":
        signing_key = "test-secret-long-enough-for-hs256"
    elif alg == "none":
        signing_key = None
    else:
        signing_key = key_material.private_key

    return jwt.encode(claims, signing_key, algorithm=alg, headers={"kid": kid})


def make_client(
    settings: Settings,
    fetcher: FakeJwksFetcher,
) -> TestClient:
    app = create_app(settings)
    if not settings.jwks_url:
        raise AssertionError("test settings must include jwks url")
    cache = JwksCache(
        url=settings.jwks_url,
        ttl_seconds=settings.jwks_ttl_seconds,
        timeout_seconds=settings.jwks_timeout_seconds,
        max_bytes=settings.jwks_max_bytes,
        fetcher=fetcher,
    )
    app.state.auth_verifier = CloudflareAccessVerifier(settings, cache)
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)


@pytest.fixture()
def jwks(key_material: KeyMaterial) -> dict[str, Any]:
    return {"keys": [key_material.public_jwk]}


@pytest.fixture()
def fetcher(jwks: dict[str, Any]) -> FakeJwksFetcher:
    return FakeJwksFetcher([jwks])


@pytest.fixture()
def client(settings: Settings, fetcher: FakeJwksFetcher) -> Iterator[TestClient]:
    with make_client(settings, fetcher) as test_client:
        yield test_client


def auth_headers(token: str) -> dict[str, str]:
    return {"Cf-Access-Jwt-Assertion": token}
