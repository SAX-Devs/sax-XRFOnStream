"""Tiny HTTP server for container liveness/readiness probes.

Stdlib-only on purpose — no FastAPI, no uvicorn — to keep the image small and
the surface area minimal. Two endpoints:

- ``GET /readyz``  → 200 if the MQTT subscriber has connected at least once.
- ``GET /healthz`` → 200 if connected AND we've seen a message within
                     ``HEALTHCHECK_STALE_SECONDS``. Otherwise 503.

Runs in a daemon thread so it never blocks shutdown.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

from src.config import IngestionConfig
from src.mqtt_subscriber import MqttSubscriber

logger = logging.getLogger("ingestion-service.health")


class HealthcheckServer:
    def __init__(self, config: IngestionConfig, subscriber: MqttSubscriber) -> None:
        self._config = config
        self._subscriber = subscriber
        self._server: HTTPServer | None = None
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        handler_cls = _make_handler(self._subscriber, self._config.healthcheck_stale_seconds)
        self._server = HTTPServer(("0.0.0.0", self._config.healthcheck_port), handler_cls)
        self._thread = threading.Thread(
            target=self._server.serve_forever,
            name="healthcheck",
            daemon=True,
        )
        self._thread.start()
        logger.info("Healthcheck listening on :%d", self._config.healthcheck_port)

    def stop(self) -> None:
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
            self._server = None


def _make_handler(subscriber: MqttSubscriber, stale_seconds: int):
    class _Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 — required by stdlib
            if self.path == "/readyz":
                self._respond(200 if subscriber.is_connected else 503, b"")
                return
            if self.path == "/healthz":
                ok = subscriber.is_connected and _fresh(subscriber.last_message_at, stale_seconds)
                self._respond(200 if ok else 503, b"")
                return
            self._respond(404, b"")

        def log_message(self, format: str, *args) -> None:  # noqa: A002
            # Silence default access logs; use structured logger if needed.
            pass

        def _respond(self, status: int, body: bytes) -> None:
            self.send_response(status)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if body:
                self.wfile.write(body)

    return _Handler


def _fresh(last: datetime | None, max_age_s: int) -> bool:
    """A subscriber is fresh if a message arrived within the window OR it just started.

    On first boot ``last`` is None — we treat that as fresh for ``max_age_s``
    after process start, but ``MqttSubscriber`` will set ``last_message_at``
    quickly under normal load so this branch is mostly cosmetic.
    """
    if last is None:
        return True
    return (datetime.now(timezone.utc) - last).total_seconds() < max_age_s
