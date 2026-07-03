"""Monitors *_action tables and reports command results to MQTT."""

import json
import logging
import threading
from datetime import datetime, timezone, timedelta

from src.config import GatewayConfig
from src.db_reader import DbReader
from src.mqtt_client import MqttClient

logger = logging.getLogger("edge-gateway.result-reporter")

ACTION_TABLES = [
    "generator_action",
    "vacuum_action",
    "circulation_action",
    "interchanger_action",
    "detector_action",
    "temp_control_action",
    "auxiliary_action",
]


class ResultReporter:
    def __init__(
        self,
        config: GatewayConfig,
        mqtt_client: MqttClient,
        db_reader: DbReader,
    ) -> None:
        self._config = config
        self._mqtt = mqtt_client
        self._db = db_reader
        self._result_topic = f"sax/{config.tenant_id}/{config.device_id}/command/result"
        self._reported_commands: set[str] = set()
        self._last_action_states: dict[str, dict[str, str]] = {}

    def _tick(self) -> None:
        for table in ACTION_TABLES:
            module = table.removesuffix("_action")
            try:
                rows = self._db.read_table(table)
            except Exception:
                logger.debug(f"Could not read {table}")
                continue

            for row in rows:
                task = row.get("task", "")
                status = row.get("status_task", "")
                state_key = f"{module}.{task}"
                prev_status = self._last_action_states.get(state_key)
                self._last_action_states[state_key] = status

                if prev_status == "busy" and status in ("ready", "error"):
                    self._report_result(module, task, status)

        self._cleanup_old_mappings()

    def _report_result(self, module: str, task: str, status: str) -> None:
        """Find the cloud command_id and publish the result."""
        try:
            def op(conn):
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT command_id FROM edge_gateway_command_map WHERE module=%s AND command=%s ORDER BY created_at DESC LIMIT 1",
                        (module, task),
                    )
                    row = cur.fetchone()
                    return row["command_id"] if row else None

            command_id = self._db._execute_with_retry(op)
        except Exception:
            logger.debug(f"No command mapping found for {module}.{task}")
            return

        if not command_id or command_id in self._reported_commands:
            return

        self._reported_commands.add(command_id)
        # Keep the in-memory set bounded (same approach as the validator's
        # replay set) — irrelevant at normal command rates, but never unbounded.
        if len(self._reported_commands) > 10_000:
            trimmed = list(self._reported_commands)[:5_000]
            self._reported_commands -= set(trimmed)

        result_status = "completed" if status == "ready" else "error"
        payload = {
            "command_id": command_id,
            "module": module,
            "command": task,
            "status": result_status,
            "error_message": None if result_status == "completed" else f"Task ended with status: {status}",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        self._mqtt.publish(self._result_topic, json.dumps(payload).encode())
        logger.info(f"Result reported for command {command_id}: {result_status}")

    def _cleanup_old_mappings(self) -> None:
        """Remove command mappings older than 24 hours."""
        try:
            def op(conn):
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM edge_gateway_command_map WHERE created_at < now() - interval '24 hours'"
                    )

            self._db._execute_with_retry(op)
        except Exception:
            pass

    def start(self, stop_event: threading.Event) -> None:
        logger.info("Result reporter started (interval=1s)")
        while not stop_event.is_set():
            try:
                self._tick()
            except Exception:
                logger.exception("Error in result reporter tick")
            stop_event.wait(1.0)
        logger.info("Result reporter stopped")
