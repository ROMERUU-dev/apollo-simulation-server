FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

COPY backend/pyproject.toml backend/README.md ./backend/
COPY backend/src ./backend/src

RUN python -m pip install --upgrade pip \
    && python -m pip wheel --wheel-dir /wheels ./backend

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN groupadd --gid 10001 cimasim \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin cimasim

COPY --from=builder /wheels /wheels

RUN python -m pip install --no-index --find-links=/wheels cimasim-api \
    && rm -rf /wheels /root/.cache

USER 10001:10001
WORKDIR /app
EXPOSE 8080

CMD ["uvicorn", "cimasim_api.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
