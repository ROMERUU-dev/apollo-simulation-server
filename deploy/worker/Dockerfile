FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
      libamd3 \
      libblas3 \
      libfftw3-double3 \
      libgfortran5 \
      liblapack3 \
      libopenmpi3 \
      libsuitesparseconfig7 \
      openmpi-bin \
      python3 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 10002 cimasim-worker \
    && useradd --uid 10002 --gid 10002 --no-create-home --shell /usr/sbin/nologin cimasim-worker \
    && mkdir -p /opt/xyce/bin /opt/cimasim-worker/src /output /work \
    && chown -R 10002:10002 /output /work

COPY --from=xyce /bin/Xyce /opt/xyce/bin/Xyce
COPY worker/src/ /opt/cimasim-worker/src/

RUN chmod 0755 /opt/xyce/bin/Xyce \
    && chmod -R a-w /opt/xyce /opt/cimasim-worker

ENV PYTHONPATH=/opt/cimasim-worker/src
ENV PATH=/opt/xyce/bin:/usr/bin:/bin

USER 10002:10002
WORKDIR /work

ENTRYPOINT ["python3", "-m", "cimasim_worker.main"]
