from fastapi import Request

from cimasim_api.errors import MissingAuthenticationError
from cimasim_api.models import Identity

ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion"


def authenticated_identity(request: Request) -> Identity:
    token = request.headers.get(ACCESS_JWT_HEADER)
    if token is None or not token.strip():
        raise MissingAuthenticationError
    verifier = request.app.state.auth_verifier
    identity = verifier.verify(token)
    if not isinstance(identity, Identity):
        raise MissingAuthenticationError
    return identity
