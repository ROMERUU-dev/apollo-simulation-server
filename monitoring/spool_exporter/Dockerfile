FROM python:3.12-slim AS builder
WORKDIR /build
COPY monitoring/spool_exporter/pyproject.toml ./
COPY monitoring/spool_exporter/src ./src
RUN python -m pip wheel --no-cache-dir --wheel-dir /wheels .

FROM python:3.12-slim
RUN groupadd --gid 10004 exporter && useradd --uid 10004 --gid 10004 --no-create-home --shell /usr/sbin/nologin exporter
COPY --from=builder /wheels /wheels
RUN python -m pip install --no-cache-dir --no-index --find-links=/wheels cimasim-spool-exporter && rm -rf /wheels
USER 10004:10004
ENTRYPOINT ["python", "-m", "cimasim_spool_exporter.main"]
CMD ["--spool-root", "/spool", "--port", "9201"]
