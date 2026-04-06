"""SAX XrfOnStream Edge Gateway — Entry point."""

import argparse
import logging
import sys

from src.config import GatewayConfig

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
    logger.info(f"Telemetry interval: {config.telemetry_interval_s}s")
    logger.info("Edge Gateway configured successfully. Components not yet initialized.")


if __name__ == "__main__":
    main()
