"""Receives commands from MQTT, validates, and inserts into local DB."""

import json
import logging
from datetime import datetime, timezone

from src.config import GatewayConfig
from src.db_reader import DbReader
from src.mqtt_client import MqttClient
from src.command_validator import CommandPayload, CommandValidator

logger = logging.getLogger("edge-gateway.command-receiver")


class CommandReceiver:
    def __init__(
        self,
        config: GatewayConfig,
        mqtt_client: MqttClient,
        db_reader: DbReader,
        validator: CommandValidator,
    ) -> None:
        self._config = config
        self._mqtt = mqtt_client
        self._db = db_reader
        self._validator = validator

        self._command_topic = f"sax/{config.tenant_id}/{config.device_id}/command/request"
        self._ack_topic = f"sax/{config.tenant_id}/{config.device_id}/command/ack"
        self._result_topic = f"sax/{config.tenant_id}/{config.device_id}/command/result"

    def start(self) -> None:
        """Subscribe to command request topic."""
        self._mqtt.subscribe(self._command_topic, self._on_command)
        logger.info(f"Command receiver listening on {self._command_topic}")

    def _on_command(self, topic: str, payload: bytes) -> None:
        """Handle incoming command message."""
        try:
            command = CommandPayload.from_json(payload)
        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"Invalid command payload: {e}")
            return

        logger.info(f"Received command: {command.module}.{command.command} (id={command.command_id})")

        result = self._validator.validate(command)

        if not result.ok:
            self._publish_rejection(command, result.reason)
            return

        try:
            self._execute_command(command)
            self._publish_ack(command)
        except Exception as e:
            logger.exception(f"Failed to execute command {command.command_id}")
            self._publish_rejection(command, str(e))

    def _execute_command(self, command: CommandPayload) -> None:
        """Insert command into local DB tables (same protocol as SQLClient.execute_command)."""
        # 1. INSERT into command table
        def insert_command(conn):
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO command (module, command, arg1, arg2, arg3, arg4, arg5)
                       VALUES (%s, %s, %s, %s, %s, %s, %s)
                       RETURNING index""",
                    (
                        command.module,
                        command.command,
                        command.args.get("arg1"),
                        command.args.get("arg2"),
                        command.args.get("arg3"),
                        command.args.get("arg4"),
                        command.args.get("arg5"),
                    ),
                )
                row = cur.fetchone()
                return row["index"] if row else None

        local_index = self._db._execute_with_retry(insert_command)

        # 2. UPDATE *_action table
        def update_action(conn):
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {command.module}_action SET status_task='command_received' WHERE task=%s",
                    (command.command,),
                )

        self._db._execute_with_retry(update_action)

        # 3. Save mapping in edge_gateway_command_map
        def save_mapping(conn):
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO edge_gateway_command_map (command_id, local_index, module, command)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (command_id) DO NOTHING""",
                    (command.command_id, local_index, command.module, command.command),
                )

        self._db._execute_with_retry(save_mapping)

        logger.info(f"Command {command.command_id} inserted into local DB (index={local_index})")

    def _publish_ack(self, command: CommandPayload) -> None:
        """Publish ACK for a valid command."""
        payload = {
            "command_id": command.command_id,
            "module": command.module,
            "command": command.command,
            "status": "ack",
            "ack_at": datetime.now(timezone.utc).isoformat(),
        }
        self._mqtt.publish(self._ack_topic, json.dumps(payload).encode())
        logger.info(f"ACK published for command {command.command_id}")

    def _publish_rejection(self, command: CommandPayload, reason: str) -> None:
        """Publish rejection for an invalid command."""
        payload = {
            "command_id": command.command_id,
            "module": command.module,
            "command": command.command,
            "status": "rejected",
            "error_message": reason,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        self._mqtt.publish(self._result_topic, json.dumps(payload).encode())
        logger.warning(f"Rejected command {command.command_id}: {reason}")
