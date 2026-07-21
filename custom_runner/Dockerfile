FROM ubuntu:24.04
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
      libamd3 libblas3 libfftw3-double3 libgfortran5 liblapack3 \
      libopenmpi3 libsuitesparseconfig7 openmpi-bin python3 \
    && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 10005 runner \
    && useradd --uid 10005 --gid 10005 --no-create-home --shell /usr/sbin/nologin runner \
    && mkdir -p /opt/xyce/bin /opt/cimasim-custom/src /input /output \
    && chown -R 10005:10005 /input /output
COPY --from=xyce /bin/Xyce /opt/xyce/bin/Xyce
COPY custom_runner/src /opt/cimasim-custom/src
RUN chmod 0755 /opt/xyce/bin/Xyce && chmod -R a-w /opt/xyce /opt/cimasim-custom
ENV PYTHONPATH=/opt/cimasim-custom/src
USER 10005:10005
ENTRYPOINT ["python3", "-m", "cimasim_custom_runner.runner"]
