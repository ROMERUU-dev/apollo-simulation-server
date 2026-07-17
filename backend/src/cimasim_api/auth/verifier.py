from __future__ import annotations

import json
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from jwt import PyJWK, PyJWTError

from cimasim_api.auth.claims import identity_from_claims
from cimasim_api.config import Settings
from cimasim_api.errors import AuthConfigurationError, InvalidAuthenticationError
from cimasim_api.models import Identity

Fetcher = Callable[[str, float, int], dict[str, Any]]


def fetch_jwks(url: str, timeout_seconds: float, max_bytes: int) -> dict[str, Any]:
    with httpx.Client(timeout=timeout_seconds, follow_redirects=False) as client:
        with client.stream("GET", url) as response:
            response.raise_for_status()
            content_length = response.headers.get("Content-Length")
            if content_length is not None and int(content_length) > max_bytes:
                raise ValueError("jwks_response_too_large")
            body = bytearray()
            for chunk in response.iter_bytes():
                body.extend(chunk)
                if len(body) > max_bytes:
                    raise ValueError("jwks_response_too_large")
    payload = json.loads(bytes(body))
    if not isinstance(payload, dict):
        raise ValueError("jwks_malformed")
    return payload


@dataclass
class JwksCache:
    url: str
    ttl_seconds: int
    timeout_seconds: float
    max_bytes: int
    fetcher: Fetcher = fetch_jwks

    def __post_init__(self) -> None:
        self._cached_at = 0.0
        self._jwks: dict[str, Any] | None = None
        self._lock = threading.RLock()

    def key_for(self, kid: str) -> PyJWK:
        jwks = self._current_jwks()
        key = self._find_key(jwks, kid)
        if key is None:
            jwks = self.refresh(force=True)
            key = self._find_key(jwks, kid)
        if key is None:
            raise InvalidAuthenticationError
        try:
            return PyJWK.from_json(json.dumps(key))
        except PyJWTError as exc:
            raise InvalidAuthenticationError from exc

    def refresh(self, *, force: bool = False) -> dict[str, Any]:
        with self._lock:
            if not force and self._jwks is not None and not self._is_expired():
                return self._jwks
            return self._refresh_locked()

    def _refresh_locked(self) -> dict[str, Any]:
        try:
            jwks = self.fetcher(self.url, self.timeout_seconds, self.max_bytes)
        except (httpx.HTTPError, ValueError, json.JSONDecodeError) as exc:
            raise InvalidAuthenticationError from exc

        self._validate_jwks_shape(jwks)
        self._jwks = jwks
        self._cached_at = time.monotonic()
        return jwks

    @staticmethod
    def _validate_jwks_shape(jwks: dict[str, Any]) -> None:
        if not isinstance(jwks.get("keys"), list):
            raise InvalidAuthenticationError

    def _is_expired(self) -> bool:
        return time.monotonic() - self._cached_at > self.ttl_seconds

    def _current_jwks(self) -> dict[str, Any]:
        with self._lock:
            if self._jwks is None or self._is_expired():
                return self._refresh_locked()
            return self._jwks

    @staticmethod
    def _find_key(jwks: dict[str, Any], kid: str) -> dict[str, Any] | None:
        keys = jwks.get("keys")
        if not isinstance(keys, list):
            raise InvalidAuthenticationError
        for key in keys:
            if isinstance(key, dict) and key.get("kid") == kid:
                JwksCache._validate_key(key)
                return key
        return None

    @staticmethod
    def _validate_key(key: dict[str, Any]) -> None:
        if not isinstance(key.get("kid"), str) or not key["kid"]:
            raise InvalidAuthenticationError
        if key.get("kty") != "RSA":
            raise InvalidAuthenticationError
        if key.get("alg") != "RS256":
            raise InvalidAuthenticationError
        if key.get("use") not in (None, "sig"):
            raise InvalidAuthenticationError


class CloudflareAccessVerifier:
    def __init__(self, settings: Settings, jwks_cache: JwksCache | None = None) -> None:
        self.settings = settings
        self._jwks_cache = jwks_cache

    def verify(self, token: str) -> Identity:
        if not self.settings.is_auth_configured:
            raise AuthConfigurationError
        if not self.settings.issuer or not self.settings.jwks_url:
            raise AuthConfigurationError

        try:
            header = jwt.get_unverified_header(token)
        except PyJWTError as exc:
            raise InvalidAuthenticationError from exc

        if header.get("alg") != "RS256":
            raise InvalidAuthenticationError
        kid = header.get("kid")
        if not isinstance(kid, str) or not kid:
            raise InvalidAuthenticationError

        key = self.jwks_cache.key_for(kid)
        try:
            claims = jwt.decode(
                token,
                key.key,
                algorithms=["RS256"],
                audience=self.settings.cf_aud,
                issuer=self.settings.issuer,
                options={"require": ["exp", "sub", "email", "type"]},
            )
        except PyJWTError as exc:
            raise InvalidAuthenticationError from exc

        return identity_from_claims(claims, self.settings.allowed_email_domains)

    @property
    def jwks_cache(self) -> JwksCache:
        if self._jwks_cache is None:
            if not self.settings.jwks_url:
                raise AuthConfigurationError
            self._jwks_cache = JwksCache(
                url=self.settings.jwks_url,
                ttl_seconds=self.settings.jwks_ttl_seconds,
                timeout_seconds=self.settings.jwks_timeout_seconds,
                max_bytes=self.settings.jwks_max_bytes,
            )
        return self._jwks_cache
