from functools import lru_cache
from pathlib import Path
from typing import Annotated
from urllib.parse import ParseResult, urlparse

from fastapi import Request
from pydantic import BeforeValidator, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _split_domains(value: str | list[str]) -> list[str]:
    if isinstance(value, list):
        return [domain.strip().lower() for domain in value if domain.strip()]
    return [domain.strip().lower() for domain in value.split(",") if domain.strip()]


AllowedDomains = Annotated[list[str], BeforeValidator(_split_domains)]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="CIMASIM_",
        env_file=".env",
        extra="ignore",
    )

    env: str = "development"
    cf_team_domain: str | None = Field(default=None)
    cf_aud: str = ""
    allowed_email_domains: AllowedDomains = Field(default_factory=lambda: ["uabc.edu.mx"])
    enable_docs: bool = False
    jwks_ttl_seconds: int = 300
    jwks_timeout_seconds: float = 2.0
    jwks_max_bytes: int = 65536
    jobs_enabled: bool = False
    job_spool_root: Path = Path("/spool")
    job_timeout_seconds: int = 30
    job_active_per_user_limit: int = 2
    job_active_global_limit: int = 20
    job_list_limit: int = 100
    admin_email_allowlist_file: Path | None = None
    prometheus_url: str = "http://prometheus:9090"
    prometheus_timeout_seconds: float = 2.0
    monitoring_cache_seconds: int = 15
    metrics_allowed_cidr: str = "127.0.0.0/8"
    custom_netlists_enabled: bool = False
    allow_legacy_rc_submission: bool = True
    custom_job_spool_root: Path = Path("/custom-spool")
    custom_job_active_per_user_limit: int = 1
    custom_job_hourly_per_user_limit: int = 10

    @property
    def normalized_team_domain(self) -> str | None:
        if self.cf_team_domain is None:
            return None
        parsed = urlparse(self.cf_team_domain)
        if not _is_valid_cloudflare_access_url(parsed):
            return None
        return f"https://{parsed.hostname}"

    @property
    def issuer(self) -> str | None:
        return self.normalized_team_domain

    @property
    def jwks_url(self) -> str | None:
        if self.normalized_team_domain is None:
            return None
        return f"{self.normalized_team_domain}/cdn-cgi/access/certs"

    @property
    def auth_configuration_errors(self) -> list[str]:
        errors: list[str] = []
        if self.cf_team_domain is None or not self.cf_team_domain.strip():
            errors.append("missing_team_domain")
        elif self.normalized_team_domain is None:
            errors.append("invalid_team_domain")
        if not self.cf_aud.strip():
            errors.append("missing_audience")
        if not self.allowed_email_domains:
            errors.append("missing_allowed_email_domains")
        if self.jwks_ttl_seconds <= 0:
            errors.append("invalid_jwks_ttl")
        if self.jwks_timeout_seconds <= 0:
            errors.append("invalid_jwks_timeout")
        if self.jwks_max_bytes <= 0:
            errors.append("invalid_jwks_max_bytes")
        return errors

    @property
    def is_auth_configured(self) -> bool:
        return not self.auth_configuration_errors


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_app_settings(request: Request) -> Settings:
    settings = request.app.state.settings
    if not isinstance(settings, Settings):
        raise RuntimeError("application settings are not configured")
    return settings


def _is_valid_cloudflare_access_url(parsed: ParseResult) -> bool:
    if parsed.scheme != "https":
        return False
    if parsed.username or parsed.password:
        return False
    try:
        if parsed.port is not None:
            return False
    except ValueError:
        return False
    if parsed.query or parsed.fragment:
        return False
    if parsed.path not in ("", "/"):
        return False
    hostname = parsed.hostname
    suffix = ".cloudflareaccess.com"
    if hostname is None or not hostname.endswith(suffix):
        return False
    team_name = hostname.removesuffix(suffix)
    return bool(team_name) and "." not in team_name
