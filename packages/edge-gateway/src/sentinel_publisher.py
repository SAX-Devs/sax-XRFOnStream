"""Publishes Sentinel validation changes to MQTT."""

import json
import logging
import threading
from datetime import datetime, timezone

from src.config import GatewayConfig
from src.db_reader import DbReader
from src.mqtt_client import MqttClient

logger = logging.getLogger("edge-gateway.sentinel")


class SentinelPublisher:
    def __init__(
        self,
        config: GatewayConfig,
        mqtt_client: MqttClient,
        db_reader: DbReader,
    ) -> None:
        self._config = config
        self._mqtt = mqtt_client
        self._db = db_reader
        self._last_severities: dict[str, str] = {}
        self._sentinel_topic = f"sax/{config.tenant_id}/{config.device_id}/sentinel"
        self._alerts_topic = f"sax/{config.tenant_id}/{config.device_id}/alerts"

    def _tick(self) -> None:
        # Validations live in the per-module <module>_sentinel tables; the
        # equipment consolidates them via the sp_sentinel_view() function
        # (the legacy global validations_sentinel table no longer exists).
        try:
            rows = self._db.read_table("sp_sentinel_view()")
        except Exception:
            logger.exception("Failed to read sp_sentinel_view()")
            return

        # Cold start: an empty cache would make every validation look "changed"
        # and flood the cloud with one alert per validation on each restart.
        # Baseline the OK ones silently; only active (non-OK) states are worth
        # announcing when the gateway comes up.
        first_run = not self._last_severities

        changed_alerts = []
        for row in rows:
            name = row["validation_name"]
            severity = row.get("severity", "OK")
            if severity != self._last_severities.get(name):
                self._last_severities[name] = severity
                if first_run and severity.upper() == "OK":
                    continue
                changed_alerts.append({
                    "name": name,
                    "severity": severity,
                    "message": row.get("message"),
                    "updated_at": str(row.get("updated_at", "")),
                })

        if not changed_alerts:
            return

        payload = {
            "device_id": self._config.device_id,
            "ts": datetime.now(timezone.utc).isoformat(),
            "source": "sentinel",
            "alerts": changed_alerts,
        }
        payload_bytes = json.dumps(payload, default=str).encode()
        self._mqtt.publish(self._sentinel_topic, payload_bytes)

        # The module sentinel SPs use OK/warning/alarm as their scale — alarm is
        # the top severity there, alongside the legacy critical/emergency.
        critical_alerts = [
            a for a in changed_alerts
            if a["severity"].lower() in ("critical", "emergency", "alarm")
        ]
        if critical_alerts:
            alert_payload = {
                "device_id": self._config.device_id,
                "ts": datetime.now(timezone.utc).isoformat(),
                "source": "sentinel",
                "alerts": critical_alerts,
            }
            self._mqtt.publish(self._alerts_topic, json.dumps(alert_payload, default=str).encode())

    def start(self, stop_event: threading.Event) -> None:
        logger.info(f"Sentinel publisher started (interval={self._config.sentinel_check_interval_s}s)")
        while not stop_event.is_set():
            try:
                self._tick()
            except Exception:
                logger.exception("Error in sentinel tick")
            stop_event.wait(self._config.sentinel_check_interval_s)
        logger.info("Sentinel publisher stopped")
