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
        self._last_generation = -1
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

        # The equipment's current_busy_tasks column is `task_name` (verified on
        # the real device: module_name | task_id | task_name | ...). Keep `task`
        # as a fallback for older schemas.
        task_names = [str(t.get("task_name") or t.get("task") or "") for t in busy_tasks]

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
        """Publish equipment state if it changed — or after a (re)connect.

        An abrupt disconnect leaves the broker's retained LWT "offline" on the
        topic; without a forced republish the cloud stays "offline" until the
        local state happens to change. Publishing with retain=True keeps the
        topic's retained message equal to the latest REAL state, so consumers
        (re)subscribing always see the truth.
        """
        generation = self._mqtt.connection_generation
        if generation != self._last_generation:
            self._last_generation = generation
            self._last_state = None  # force republish on this new connection

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
        self._mqtt.publish(
            self._topic, json.dumps(payload, default=str).encode(), retain=True
        )
        logger.info(f"Equipment state changed to: {state}")
