from fastapi import FastAPI

from cimasim_api.auth.verifier import CloudflareAccessVerifier
from cimasim_api.config import Settings, get_settings
from cimasim_api.errors import (
    ApiError,
    RequestIdMiddleware,
    api_error_handler,
    internal_error_handler,
)
from cimasim_api.routes.health import router as health_router
from cimasim_api.routes.identity import router as identity_router


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    docs_url = "/docs" if app_settings.enable_docs else None
    redoc_url = "/redoc" if app_settings.enable_docs else None
    openapi_url = "/openapi.json" if app_settings.enable_docs else None

    app = FastAPI(
        title="CimaSim API",
        version="v1",
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
    )
    app.state.settings = app_settings
    app.state.auth_verifier = CloudflareAccessVerifier(app_settings)
    app.add_middleware(RequestIdMiddleware)
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(Exception, internal_error_handler)
    app.include_router(health_router)
    app.include_router(identity_router)
    return app
