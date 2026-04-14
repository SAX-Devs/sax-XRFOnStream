"""Publishes telemetry from 7 local status tables to MQTT."""

import json
import logging
import threading
from datetime import datetime, timezone

from src.config import GatewayConfig
from src.db_reader import DbReader
from src.mqtt_client import MqttClient

logger = logging.getLogger("edge-gateway.telemetry")

MODULES = [
    "generator_status",
    "vacuum_status",
    "circulation_status",
    "interchanger_status",
    "detector_status",
    "temp_control_status",
    "auxiliary_status",
]


class TelemetryPublisher:
    def __init__(
        self,
        config: GatewayConfig,
        mqtt_client: MqttClient,
        db_reader: DbReader,
        equipment_state_pub=None,
    ) -> None:
        self._config = config
        self._mqtt = mqtt_client
        self._db = db_reader
        self._equipment_state_pub = equipment_state_pub
        self._last_snapshots: dict[str, dict] = {}
        self._topic_prefix = f"sax/{config.tenant_id}/{config.device_id}/telemetry"

    def _module_short_name(self, table_name: str) -> str:
        return table_name.removesuffix("_status")

    def _tick(self) -> None:
        for table in MODULES:
            try:
                row = self._db.read_single_row(table)
            except Exception:
                logger.exception(f"Failed to read {table}")
                continue

            if row is None:
                continue

            if row == self._last_snapshots.get(table):
                continue

            self._last_snapshots[table] = row
            module_name = self._module_short_name(table)
            payload = {
                "device_id": self._config.device_id,
                "module": module_name,
                "ts": datetime.now(timezone.utc).isoformat(),
                "data": row,
            }
            topic = f"{self._topic_prefix}/{module_name}"
            self._mqtt.publish(topic, json.dumps(payload, default=str).encode())

        if self._equipment_state_pub:
            try:
                self._equipment_state_pub.publish_if_changed()
            except Exception:
                logger.exception("Failed to publish equipment state")

    def start(self, stop_event: threading.Event) -> None:
        logger.info(f"Telemetry publisher started (interval={self._config.telemetry_interval_s}s)")
        while not stop_event.is_set():
            try:
                self._tick()
            except Exception:
                logger.exception("Error in telemetry tick")
            stop_event.wait(self._config.telemetry_interval_s)
        logger.info("Telemetry publisher stopped")
