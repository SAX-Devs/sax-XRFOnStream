"""Centralised logging configuration for the Ingestion Service.

Mirrors the format used by the Edge Gateway so logs from both halves of the
pipeline render identically when collected together. Output goes to stdout for
container log capture (Railway, Cloud Run, journald).
"""

from __future__ import annotations

import logging
import sys


_LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"


def setup_logging(level: str = "INFO") -> None:
    """Configure the root logger. Idempotent — safe to call repeatedly."""
    root = logging.getLogger()
    root.setLevel(level.upper())

    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(logging.Formatter(_LOG_FORMAT))
    root.addHandler(handler)

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("hpack").setLevel(logging.WARNING)
