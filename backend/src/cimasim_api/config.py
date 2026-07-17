from functools import lru_cache
from typing import Annotated

from pydantic import AnyHttpUrl, BeforeValidator, Field
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
    cf_team_domain: AnyHttpUrl | None = Field(default=None)
    cf_aud: str = ""
    allowed_email_domains: AllowedDomains = Field(default_factory=lambda: ["uabc.edu.mx"])
    enable_docs: bool = False
    jwks_ttl_seconds: int = 300
    jwks_timeout_seconds: float = 2.0
    jwks_max_bytes: int = 65536

    @property
    def normalized_team_domain(self) -> str | None:
        if self.cf_team_domain is None:
            return None
        return str(self.cf_team_domain).rstrip("/")

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
        if not self.normalized_team_domain:
            errors.append("missing_team_domain")
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
