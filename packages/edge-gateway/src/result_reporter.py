"""Reports command results back to the cloud by watching the *_action tables.

Detection is MAPPING-driven, not transition-driven. The previous version fired
only when it observed a task go ``busy`` → ``ready``/``error``; with a 1s poll
that missed anything finishing inside one interval (usage_axial completes in
about a second), leaving the cloud command stuck at ``ack`` forever.

Now each pending row of ``edge_gateway_command_map`` carries ``created_at`` =
the equipment-clock instant the gateway claimed the task (see
CommandReceiver._execute_command). A task counts as finished for that command
when its ``status_task`` is terminal AND its ``ts`` is at or after that anchor
— no transient state has to be caught, and a leftover terminal status from
before the command is never mistaken for its result.
"""

import json
import logging
import threading
from datetime import datetime, timezone

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

MODULES = {table.removesuffix("_action") for table in ACTION_TABLES}

# What the equipment writes when a task is over (see CommandDaemon).
TERMINAL_STATUSES = {"ready", "error", "cancelled"}

# Bound every read — no query may grow with history (incident 2026-07-02).
MAX_PENDING_MAPPINGS = 200
MAX_ERROR_MESSAGE = 500


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

    def _tick(self) -> None:
        mappings = self._read_pending_mappings()
        if not mappings:
            self._cleanup_old_mappings()
            return

        # Only touch the action tables of modules that actually have something
        # pending — the idle case costs a single small query.
        pending_modules = {
            m["module"] for m in mappings if m["module"] in MODULES
        }
        actions: dict[str, dict[str, dict]] = {}
        for module in pending_modules:
            try:
                rows = self._db.read_table(f"{module}_action")
            except Exception:
                logger.debug(f"Could not read {module}_action")
                continue
            actions[module] = {row.get("task"): row for row in rows}

        for mapping in mappings:
            row = actions.get(mapping["module"], {}).get(mapping["command"])
            if row is None:
                # 'cancel' has no *_action row: the daemon intercepts it and
                # its effect shows up as the target task's 'cancelled' result.
                continue

            status = row.get("status_task", "")
            if status not in TERMINAL_STATUSES:
                continue

            action_ts = row.get("ts")
            anchor = mapping.get("created_at")
            if action_ts is None or anchor is None or action_ts < anchor:
                # Terminal status predates this command — not its result.
                continue

            self._report_result(
                command_id=mapping["command_id"],
                module=mapping["module"],
                task=mapping["command"],
                status=status,
                error_log=row.get("error_log"),
            )

        self._cleanup_old_mappings()

    def _read_pending_mappings(self) -> list[dict]:
        """Oldest-first, bounded. Rows are deleted once reported."""
        try:
            def op(conn):
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT command_id, module, command, created_at
                           FROM edge_gateway_command_map
                           ORDER BY created_at ASC
                           LIMIT %s""",
                        (MAX_PENDING_MAPPINGS,),
                    )
                    return cur.fetchall()

            return self._db._execute_with_retry(op) or []
        except Exception:
            logger.debug("Could not read edge_gateway_command_map")
            return []

    def _report_result(
        self,
        command_id: str,
        module: str,
        task: str,
        status: str,
        error_log: str | None,
    ) -> None:
        """Publish the result and retire the mapping row."""
        # The cloud audit vocabulary has no 'cancelled', so a cancellation is
        # reported as an error carrying an explicit message; the dashboard
        # knows it asked for the cancel and renders it as such.
        result_status = "completed" if status == "ready" else "error"
        if status == "cancelled":
            message = "Task cancelled"
        elif status == "error":
            message = (error_log or "").strip()[:MAX_ERROR_MESSAGE] or (
                f"Task ended with status: {status}"
            )
        else:
            message = None

        payload = {
            "command_id": command_id,
            "module": module,
            "command": task,
            "status": result_status,
            "error_message": message,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        self._mqtt.publish(self._result_topic, json.dumps(payload).encode())
        self._delete_mapping(command_id)
        logger.info(
            f"Result reported for command {command_id} ({module}.{task}): "
            f"{result_status}"
        )

    def _delete_mapping(self, command_id: str) -> None:
        try:
            def op(conn):
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM edge_gateway_command_map WHERE command_id=%s",
                        (command_id,),
                    )

            self._db._execute_with_retry(op)
        except Exception:
            logger.warning(f"Could not delete mapping for command {command_id}")

    def _cleanup_old_mappings(self) -> None:
        """Drop mappings whose task never reached a terminal status."""
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
