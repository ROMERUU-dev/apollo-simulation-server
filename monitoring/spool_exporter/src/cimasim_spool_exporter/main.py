from __future__ import annotations

import argparse
import time
from pathlib import Path

from prometheus_client import CollectorRegistry, start_http_server

from cimasim_spool_exporter.collector import SpoolCollector


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spool-root", type=Path, default=Path("/spool"))
    parser.add_argument("--port", type=int, default=9201)
    args = parser.parse_args()
    registry = CollectorRegistry()
    registry.register(SpoolCollector(args.spool_root))
    start_http_server(args.port, registry=registry)
    while True:
        time.sleep(3600)


if __name__ == "__main__":
    main()
