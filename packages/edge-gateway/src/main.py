"""SAX XrfOnStream Edge Gateway — Entry point."""

import argparse
import logging
import signal
import threading
import sys

from src.config import GatewayConfig
from src.offline_buffer import OfflineBuffer
from src.mqtt_client import MqttClient
from src.db_reader import DbReader
from src.telemetry_publisher import TelemetryPublisher
from src.sentinel_publisher import SentinelPublisher
from src.equipment_state_publisher import EquipmentStatePublisher
from src.concentrations_publisher import ConcentrationsPublisher
from src.command_validator import CommandValidator
from src.command_receiver import CommandReceiver
from src.result_reporter import ResultReporter
from src.spectra_uploader import SpectraUploader

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("edge-gateway")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SAX XrfOnStream Edge Gateway")
    parser.add_argument(
        "--config",
        required=True,
        help="Path to provision JSON config file",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logger.info("Starting SAX Edge Gateway...")

    try:
        config = GatewayConfig.from_json(args.config)
    except FileNotFoundError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to parse config: {e}")
        sys.exit(1)

    logger.info(f"Device ID: {config.device_id}")
    logger.info(f"Tenant ID: {config.tenant_id}")
    logger.info(f"MQTT Broker: {config.mqtt.broker_url}:{config.mqtt.port}")

    stop_event = threading.Event()

    # 1. Initialize offline buffer
    offline_buffer = OfflineBuffer(config.local_db)

    # 2. Initialize MQTT client
    lwt_topic = f"sax/{config.tenant_id}/{config.device_id}/equipment_state"
    mqtt_client = MqttClient(config.mqtt, offline_buffer, lwt_topic=lwt_topic)
    mqtt_client.connect()

    # 3. Initialize DB readers (one per publisher thread for thread safety)
    telemetry_db = DbReader(config.local_db)
    sentinel_db = DbReader(config.local_db)
    concentrations_db = DbReader(config.local_db)
    command_db = DbReader(config.local_db)
    result_db = DbReader(config.local_db)
    spectra_db = DbReader(config.local_db)

    # 4. Initialize publishers
    equipment_pub = EquipmentStatePublisher(config, mqtt_client, telemetry_db)
    telemetry_pub = TelemetryPublisher(config, mqtt_client, telemetry_db, equipment_pub)
    sentinel_pub = SentinelPublisher(config, mqtt_client, sentinel_db)
    concentrations_pub = ConcentrationsPublisher(config, mqtt_client, concentrations_db)

    # 5. Initialize command pipeline
    validator = CommandValidator(config, command_db)
    command_receiver = CommandReceiver(config, mqtt_client, command_db, validator)
    command_receiver.start()

    # 6. Initialize result reporter and spectra uploader
    result_reporter = ResultReporter(config, mqtt_client, result_db)
    spectra_uploader = SpectraUploader(config, mqtt_client, spectra_db)

    # 7. Start publisher threads
    threads = [
        threading.Thread(target=telemetry_pub.start, args=(stop_event,), daemon=True, name="telemetry"),
        threading.Thread(target=sentinel_pub.start, args=(stop_event,), daemon=True, name="sentinel"),
        threading.Thread(target=concentrations_pub.start, args=(stop_event,), daemon=True, name="concentrations"),
        threading.Thread(target=result_reporter.start, args=(stop_event,), daemon=True, name="result-reporter"),
        threading.Thread(target=spectra_uploader.start, args=(stop_event,), daemon=True, name="spectra-uploader"),
    ]

    for t in threads:
        t.start()

    logger.info("All components initialized and running")

    # 8. Handle graceful shutdown
    def shutdown(signum, frame):
        logger.info("Shutdown signal received")
        stop_event.set()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    try:
        stop_event.wait()
    except KeyboardInterrupt:
        stop_event.set()

    # 9. Cleanup
    logger.info("Shutting down...")
    mqtt_client.disconnect()
    for db in [telemetry_db, sentinel_db, concentrations_db, command_db, result_db, spectra_db]:
        db.close()
    offline_buffer.close()
    logger.info("Edge Gateway stopped")


if __name__ == "__main__":
    main()
