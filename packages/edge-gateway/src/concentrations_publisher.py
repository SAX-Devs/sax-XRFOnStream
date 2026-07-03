"""Publishes concentration data to MQTT (active only when DEP-01 table exists)."""

import json
import logging
import threading
from datetime import datetime, timezone

from src.config import GatewayConfig
from src.db_reader import DbReader
from src.mqtt_client import MqttClient

logger = logging.getLogger("edge-gateway.concentrations")


class ConcentrationsPublisher:
    def __init__(
        self,
        config: GatewayConfig,
        mqtt_client: MqttClient,
        db_reader: DbReader,
    ) -> None:
        self._config = config
        self._mqtt = mqtt_client
        self._db = db_reader
        self._active: bool | None = None
        self._last_uploaded_id = 0
        self._topic = f"sax/{config.tenant_id}/{config.device_id}/concentrations"

    def _check_table(self) -> bool:
        """Check if the concentrations table exists in the local DB."""
        try:
            exists = self._db.table_exists("concentrations")
            if not exists:
                logger.info("Concentrations table not found (DEP-01 not yet implemented). Publisher inactive.")
            return exists
        except Exception:
            logger.exception("Failed to check concentrations table")
            return False

    def _tick(self) -> None:
        if self._active is None:
            self._active = self._check_table()
            if self._active:
                # Same guard as the spectra uploader: start from the current max
                # id so we never sweep a historical backlog into RAM at once.
                try:
                    self._last_uploaded_id = self._db.read_max_id("concentrations", "id")
                    logger.info(
                        f"Concentrations active: starting at id {self._last_uploaded_id} "
                        "(historical backlog skipped)"
                    )
                except Exception:
                    logger.exception("Failed to initialize last concentrations id")
                    self._active = None
                    return

        if not self._active:
            return

        try:
            rows = self._db.read_rows_after(
                "concentrations", "id", self._last_uploaded_id, limit=100
            )
        except Exception:
            logger.exception("Failed to read concentrations")
            return

        for row in rows:
            payload = {
                "device_id": self._config.device_id,
                "ts": datetime.now(timezone.utc).isoformat(),
                "measurement_id": str(row.get("measurement_id", "")),
                "elements": {row["element"]: float(row["concentration"])},
                "unit": "g/L",
            }
            self._mqtt.publish(self._topic, json.dumps(payload, default=str).encode())
            self._last_uploaded_id = max(self._last_uploaded_id, row["id"])

    def start(self, stop_event: threading.Event) -> None:
        logger.info(f"Concentrations publisher started (interval={self._config.concentrations_check_interval_s}s)")
        while not stop_event.is_set():
            try:
                self._tick()
            except Exception:
                logger.exception("Error in concentrations tick")
            stop_event.wait(self._config.concentrations_check_interval_s)
        logger.info("Concentrations publisher stopped")
