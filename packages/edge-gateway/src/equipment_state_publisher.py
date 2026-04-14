"""Infers and publishes global equipment state to MQTT."""

import json
import logging
from datetime import datetime, timezone

from src.config import GatewayConfig
from src.db_reader import DbReader
from src.mqtt_client import MqttClient

logger = logging.getLogger("edge-gateway.equipment-state")


class EquipmentStatePublisher:
    def __init__(
        self,
        config: GatewayConfig,
        mqtt_client: MqttClient,
        db_reader: DbReader,
    ) -> None:
        self._config = config
        self._mqtt = mqtt_client
        self._db = db_reader
        self._last_state: str | None = None
        self._topic = f"sax/{config.tenant_id}/{config.device_id}/equipment_state"

    def infer_state(self) -> tuple[str, dict]:
        """Infer global equipment state from local DB tables."""
        try:
            sentinel_rows = self._db.read_table("validations_sentinel")
        except Exception:
            return ("unknown", {})

        for row in sentinel_rows:
            if row.get("severity", "OK").upper() in ("CRITICAL", "EMERGENCY"):
                return ("error", {"alerts": [{"name": row["name"], "severity": row["severity"]}]})

        try:
            busy_tasks = self._db.read_table("current_busy_tasks")
        except Exception:
            busy_tasks = []

        task_names = [t.get("task", "") for t in busy_tasks]

        for name in task_names:
            if "measure" in name.lower():
                return ("measuring", {"active_tasks": task_names})

        for name in task_names:
            if "init" in name.lower():
                return ("initializing", {"active_tasks": task_names})

        try:
            generator = self._db.read_single_row("generator_status")
            if generator and generator.get("hv_on"):
                return ("standby", {"hv_on": True})
        except Exception:
            pass

        return ("idle", {})

    def publish_if_changed(self) -> None:
        """Publish equipment state only if it changed since last check."""
        state, detail = self.infer_state()

        if state == self._last_state:
            return

        self._last_state = state
        payload = {
            "device_id": self._config.device_id,
            "ts": datetime.now(timezone.utc).isoformat(),
            "state": state,
            "detail": detail,
        }
        self._mqtt.publish(self._topic, json.dumps(payload, default=str).encode())
        logger.info(f"Equipment state changed to: {state}")
