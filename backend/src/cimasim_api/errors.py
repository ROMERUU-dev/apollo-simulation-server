from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = str(uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class ApiError(Exception):
    status_code = 500
    code = "internal_error"
    message = "An internal error occurred."
    no_store = False


class AuthConfigurationError(ApiError):
    status_code = 503
    code = "auth_configuration_unavailable"
    message = "Authentication configuration is unavailable."
    no_store = True


class MissingAuthenticationError(ApiError):
    status_code = 401
    code = "authentication_required"
    message = "Authentication is required."
    no_store = True


class InvalidAuthenticationError(ApiError):
    status_code = 401
    code = "invalid_authentication"
    message = "Authentication is invalid."
    no_store = True


class ForbiddenError(ApiError):
    status_code = 403
    code = "forbidden"
    message = "Access is forbidden."
    no_store = True


def request_id_for(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if isinstance(request_id, str):
        return request_id
    return str(uuid4())


async def api_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, ApiError):
        exc = ApiError()
    headers = {"Cache-Control": "no-store"} if exc.no_store else {}
    return JSONResponse(
        status_code=exc.status_code,
        headers=headers,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "request_id": request_id_for(request),
            }
        },
    )


async def internal_error_handler(request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        headers={"Cache-Control": "no-store"},
        content={
            "error": {
                "code": "internal_error",
                "message": "An internal error occurred.",
                "request_id": request_id_for(request),
            }
        },
    )
