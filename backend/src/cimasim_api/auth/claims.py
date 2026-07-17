from typing import Any

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, ConfigDict

from cimasim_api.errors import ForbiddenError, InvalidAuthenticationError
from cimasim_api.models import Identity


class AccessClaims(BaseModel):
    model_config = ConfigDict(extra="allow")

    sub: str
    email: str
    type: str
    name: str | None = None
    groups: list[str] | None = None


def _normalized_email(value: str) -> str:
    try:
        return validate_email(value, check_deliverability=False).normalized.lower()
    except EmailNotValidError as exc:
        raise InvalidAuthenticationError from exc


def identity_from_claims(claims: dict[str, Any], allowed_domains: list[str]) -> Identity:
    try:
        parsed = AccessClaims.model_validate(claims)
    except ValueError as exc:
        raise InvalidAuthenticationError from exc

    if parsed.type != "app":
        raise InvalidAuthenticationError
    if not parsed.sub.strip():
        raise InvalidAuthenticationError

    email = _normalized_email(parsed.email)
    domain = email.rsplit("@", maxsplit=1)[-1]
    if domain not in allowed_domains:
        raise ForbiddenError

    groups = parsed.groups if parsed.groups else None
    return Identity(
        user_id=f"cf-sub:{parsed.sub}",
        email=email,
        name=parsed.name,
        roles=["user"],
        is_admin=False,
        groups=groups,
    )
