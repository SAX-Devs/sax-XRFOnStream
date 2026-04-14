"""Shared fixtures for Edge Gateway tests."""

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from src.config import GatewayConfig, LocalDbConfig, MqttConfig


@pytest.fixture
def sample_config_path(tmp_path: Path) -> Path:
    """Create a temporary provision config file for testing."""
    config = {
        "device_id": "d1e2f3a4-0000-0000-0000-000000000001",
        "tenant_id": "a1b2c3d4-0000-0000-0000-000000000001",
        "mqtt": {
            "broker_url": "localhost",
            "port": 8883,
            "client_id": "xrf-test-001",
            "username": "xrf-test-001",
            "password_file": "/tmp/mqtt.password",
            "use_tls": False,
        },
        "hmac_secret_path": "/tmp/hmac.key",
        "local_db": {
            "host": "localhost",
            "port": 5432,
            "dbname": "xrfonstream_test",
            "user": "sax",
            "password_file": "/tmp/db.password",
        },
        "telemetry_interval_s": 2,
        "spectra_check_interval_s": 10,
        "sentinel_check_interval_s": 5,
        "concentrations_check_interval_s": 10,
    }
    config_file = tmp_path / "provision.json"
    config_file.write_text(json.dumps(config))
    return config_file


@pytest.fixture
def mock_mqtt_config() -> MqttConfig:
    return MqttConfig(
        broker_url="localhost",
        port=8883,
        client_id="xrf-test-001",
        username="xrf-test-001",
        password_file="/tmp/mqtt.password",
        use_tls=False,
    )


@pytest.fixture
def mock_local_db_config() -> LocalDbConfig:
    return LocalDbConfig(
        host="localhost",
        port=5432,
        dbname="xrfonstream_test",
        user="sax",
        password_file="/tmp/db.password",
    )


@pytest.fixture
def mock_gateway_config(mock_mqtt_config, mock_local_db_config) -> GatewayConfig:
    return GatewayConfig(
        device_id="d1e2f3a4-0000-0000-0000-000000000001",
        tenant_id="a1b2c3d4-0000-0000-0000-000000000001",
        mqtt=mock_mqtt_config,
        hmac_secret_path="/tmp/hmac.key",
        local_db=mock_local_db_config,
    )


@pytest.fixture
def mock_mqtt_client() -> MagicMock:
    client = MagicMock()
    client.is_connected = True
    client.publish = MagicMock()
    return client


@pytest.fixture
def mock_db_reader() -> MagicMock:
    reader = MagicMock()
    reader.read_single_row = MagicMock(return_value=None)
    reader.read_table = MagicMock(return_value=[])
    reader.table_exists = MagicMock(return_value=False)
    reader.read_rows_after = MagicMock(return_value=[])
    return reader
