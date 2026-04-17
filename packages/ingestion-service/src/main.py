"""SAX XrfOnStream Ingestion Service — entry point.

Wires together: config → Supabase client → handlers → subscriber → healthcheck.
Handles SIGTERM/SIGINT for graceful shutdown so Docker/Railway can stop us
cleanly. Mirrors the Edge Gateway's ``main.py`` lifecycle for consistency.
"""

from __future__ import annotations

import logging
import signal
import sys
import threading

from supabase import create_client

from src.config import IngestionConfig
from src.handlers.alert_handler import AlertHandler
from src.handlers.base import Handler, HandlerContext
from src.handlers.command_audit_handler import CommandAuditHandler
from src.handlers.concentrations_handler import ConcentrationsHandler
from src.handlers.equipment_state_handler import EquipmentStateHandler
from src.handlers.spectra_handler import SpectraHandler
from src.handlers.telemetry_handler import TelemetryHandler
from src.healthcheck import HealthcheckServer
from src.logging_setup import setup_logging
from src.mqtt_subscriber import MqttSubscriber
from src.spectra_storage import SpectraStorage
from src.supabase_writer import SupabaseWriter
from src.topic_router import TopicKind

logger = logging.getLogger("ingestion-service")


def _build_handlers(ctx: HandlerContext) -> dict[TopicKind, Handler]:
    """Map every recognised topic kind to a handler instance.

    The alert handler serves both ``alerts`` and ``sentinel`` topics; the
    command audit handler serves both ``ack`` and ``result``. Single source
    of truth for topic-to-handler routing.
    """
    alert = AlertHandler(ctx)
    command_audit = CommandAuditHandler(ctx)
    return {
        TopicKind.TELEMETRY: TelemetryHandler(ctx),
        TopicKind.SPECTRA: SpectraHandler(ctx),
        TopicKind.CONCENTRATIONS: ConcentrationsHandler(ctx),
        TopicKind.ALERTS: alert,
        TopicKind.SENTINEL: alert,
        TopicKind.EQUIPMENT_STATE: EquipmentStateHandler(ctx),
        TopicKind.COMMAND_ACK: command_audit,
        TopicKind.COMMAND_RESULT: command_audit,
    }


def main() -> None:
    try:
        config = IngestionConfig.load()
    except Exception as exc:
        # Configuration is the only thing we cannot recover from. Print
        # before logging is set up because the logger may itself depend on
        # config in the future.
        print(f"FATAL: failed to load configuration: {exc}", file=sys.stderr)
        sys.exit(1)

    setup_logging(config.log_level)
    logger.info("Starting SAX Ingestion Service")
    logger.info("Supabase URL: %s", config.supabase_url)
    logger.info(
        "MQTT broker: %s:%d (TLS=%s, client_id=%s)",
        config.mqtt_broker_url,
        config.mqtt_broker_port,
        config.mqtt_use_tls,
        config.mqtt_client_id,
    )

    supabase_client = create_client(
        config.supabase_url,
        config.supabase_service_role_key.get_secret_value(),
    )
    writer = SupabaseWriter(config, client=supabase_client)
    storage = SpectraStorage(config, client=supabase_client)
    ctx = HandlerContext(config=config, writer=writer, storage=storage)

    handlers = _build_handlers(ctx)
    subscriber = MqttSubscriber(config, handlers)

    health = HealthcheckServer(config, subscriber)
    health.start()

    subscriber.connect()
    logger.info("All components started — entering run loop")

    stop_event = threading.Event()

    def _shutdown(signum, frame) -> None:
        logger.info("Shutdown signal received (signum=%s)", signum)
        stop_event.set()

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    try:
        stop_event.wait()
    except KeyboardInterrupt:
        stop_event.set()

    logger.info("Shutting down...")
    subscriber.disconnect()
    health.stop()
    logger.info("Ingestion Service stopped")


if __name__ == "__main__":
    main()
