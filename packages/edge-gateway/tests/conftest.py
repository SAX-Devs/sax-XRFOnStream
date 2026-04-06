"""Shared fixtures for Edge Gateway tests."""

import json
from pathlib import Path

import pytest


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
