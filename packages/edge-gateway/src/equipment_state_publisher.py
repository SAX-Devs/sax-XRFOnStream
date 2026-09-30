"""Infers and publishes global equipment state to MQTT."""

import json
import logging
from datetime import datetime, timezone

from src.config import GatewayConfig
from src.db_reader import DbReader
from src.mqtt_client import MqttClient

logger = logging.getLogger("edge-gateway.equipment-state")

# The module sentinel SPs use OK/warning/alarm; critical/emergency belong to
# the legacy validations_sentinel scale. All three are "alarm level".
ALARM_SEVERITIES = frozenset({"alarm", "critical", "emergency"})


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
        self._last_alerts: list[dict] | None = None
        self._last_generation = -1
        self._topic = f"sax/{config.tenant_id}/{config.device_id}/equipment_state"

    def read_alerts(self) -> list[dict] | None:
        """Every non-OK Sentinel validation, or None when the view can't be read.

        Validations come from the per-module <module>_sentinel tables,
        consolidated by sp_sentinel_view() (the legacy validations_sentinel
        table no longer exists). The view is ordered by module/name, so the
        list compares stably between ticks.
        """
        try:
            rows = self._db.read_table("sp_sentinel_view()")
        except Exception:
            return None
        return [
            {"name": row["validation_name"], "severity": row["severity"]}
            for row in rows
            if str(row.get("severity", "OK")).upper() != "OK"
        ]

    def infer_state(self) -> tuple[str, dict]:
        """Infer global equipment state from local DB tables.

        `state` describes what the equipment is DOING (measuring, initializing,
        standby, idle). Active Sentinel validations always travel alongside in
        `detail["alerts"]` and never override an activity: `error` is reserved
        for "an alarm is active and the equipment is doing nothing". The old
        alarm-first order hid a running measurement behind ERROR for a whole
        day (2026-09-29, tank-pressure sensor fouled with brine).
        """
        alerts = self.read_alerts()
        if alerts is None:
            return ("unknown", {})
        detail: dict = {"alerts": alerts}

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
                return ("measuring", {**detail, "active_tasks": task_names})

        for name in task_names:
            if "init" in name.lower():
                return ("initializing", {**detail, "active_tasks": task_names})

        try:
            generator = self._db.read_single_row("generator_status")
            if generator and generator.get("hv_on"):
                return ("standby", {**detail, "hv_on": True})
        except Exception:
            pass

        if any(str(a["severity"]).lower() in ALARM_SEVERITIES for a in alerts):
            return ("error", detail)

        return ("idle", detail)

    def publish_if_changed(self) -> None:
        """Publish equipment state if it (or its alerts) changed — or after a (re)connect.

        An abrupt disconnect leaves the broker's retained LWT "offline" on the
        topic; without a forced republish the cloud stays "offline" until the
        local state happens to change. Publishing with retain=True keeps the
        topic's retained message equal to the latest REAL state, so consumers
        (re)subscribing always see the truth.

        The alerts list is part of the change detection: a validation tripping
        while the state stays "measuring" must reach the dashboard's alarm
        indicator. Other detail fields (active_tasks) don't trigger a publish.
        """
        generation = self._mqtt.connection_generation
        if generation != self._last_generation:
            self._last_generation = generation
            self._last_state = None  # force republish on this new connection
            self._last_alerts = None

        state, detail = self.infer_state()
        alerts = detail.get("alerts")

        if state == self._last_state and alerts == self._last_alerts:
            return

        self._last_state = state
        self._last_alerts = alerts
        payload = {
            "device_id": self._config.device_id,
            "ts": datetime.now(timezone.utc).isoformat(),
            "state": state,
            "detail": detail,
        }
        self._mqtt.publish(
            self._topic, json.dumps(payload, default=str).encode(), retain=True
        )
        logger.info(f"Equipment state changed to: {state} (alerts={len(alerts or [])})")
