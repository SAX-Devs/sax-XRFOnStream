"""Shared fixtures for the Ingestion Service test suite."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from src.config import IngestionConfig
from src.handlers.base import HandlerContext


TENANT_ID = "a1b2c3d4-0000-0000-0000-000000000001"
DEVICE_ID = "d1e2f3a4-0000-0000-0000-000000000001"


@pytest.fixture
def mock_config(monkeypatch: pytest.MonkeyPatch, tmp_path) -> IngestionConfig:
    monkeypatch.setenv("SUPABASE_URL", "http://localhost:54321")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
    monkeypatch.setenv("MQTT_BROKER_URL", "localhost")
    monkeypatch.setenv("MQTT_BROKER_PORT", "1883")
    monkeypatch.setenv("MQTT_USERNAME", "ingestion-svc-test")
    monkeypatch.setenv("MQTT_PASSWORD", "test-password")
    monkeypatch.setenv("MQTT_USE_TLS", "false")
    monkeypatch.setenv("HEALTHCHECK_PORT", "18080")
    monkeypatch.chdir(tmp_path)
    return IngestionConfig.load()


@pytest.fixture
def mock_writer() -> MagicMock:
    writer = MagicMock()
    writer.insert = MagicMock()
    writer.upsert = MagicMock()
    writer.update = MagicMock()
    writer.update_last_seen = MagicMock()
    return writer


@pytest.fixture
def mock_storage() -> MagicMock:
    storage = MagicMock()
    storage.upload = MagicMock(return_value="path/to/spectrum.json")
    return storage


@pytest.fixture
def mock_context(mock_config, mock_writer, mock_storage) -> HandlerContext:
    return HandlerContext(config=mock_config, writer=mock_writer, storage=mock_storage)


# -- Sample payloads ---------------------------------------------------------

SAMPLE_TS = datetime(2026, 4, 16, 12, 0, 0, tzinfo=timezone.utc).isoformat()
_TS = SAMPLE_TS  # alias for backwards-compatible imports inside the test suite


@pytest.fixture
def telemetry_payload() -> bytes:
    return json.dumps({
        "device_id": DEVICE_ID,
        "module": "generator",
        "ts": SAMPLE_TS,
        "data": {"hv_on": False, "voltage_kv": 0, "current_ua": 0},
    }).encode()


@pytest.fixture
def spectra_payload_small() -> bytes:
    return json.dumps({
        "device_id": DEVICE_ID,
        "ts": SAMPLE_TS,
        "measurement_id": "m-001",
        "spectra_data": {"channels": [1, 2, 3]},
        "run_data": {"duration_s": 30},
    }).encode()


@pytest.fixture
def spectra_payload_large() -> bytes:
    big = list(range(100_000))  # ~600 KB serialised
    return json.dumps({
        "device_id": DEVICE_ID,
        "ts": SAMPLE_TS,
        "measurement_id": "m-002",
        "spectra_data": big,
        "run_data": None,
    }).encode()


@pytest.fixture
def concentrations_payload() -> bytes:
    return json.dumps({
        "device_id": DEVICE_ID,
        "ts": SAMPLE_TS,
        "measurement_id": "m-003",
        "elements": {"Cu": 1.23, "Fe": 0.45},
        "unit": "g/L",
    }).encode()


@pytest.fixture
def sentinel_payload() -> bytes:
    return json.dumps({
        "device_id": DEVICE_ID,
        "ts": SAMPLE_TS,
        "source": "sentinel",
        "alerts": [
            {"name": "critical_flow", "severity": "CRITICAL", "message": "Flow below 1.5 L/min", "updated_at": SAMPLE_TS},
            {"name": "vacuum", "severity": "OK", "message": "Recovered", "updated_at": SAMPLE_TS},
        ],
    }).encode()


@pytest.fixture
def equipment_state_payload() -> bytes:
    return json.dumps({
        "device_id": DEVICE_ID,
        "ts": SAMPLE_TS,
        "state": "measuring",
        "detail": {"active_tasks": ["measure_sample"]},
    }).encode()


@pytest.fixture
def equipment_state_lwt_payload() -> bytes:
    return json.dumps({"status": "offline"}).encode()


@pytest.fixture
def command_ack_payload() -> bytes:
    return json.dumps({
        "command_id": "11111111-1111-1111-1111-111111111111",
        "module": "generator",
        "command": "set_hv_state",
        "status": "ack",
        "ack_at": SAMPLE_TS,
    }).encode()


@pytest.fixture
def command_result_payload() -> bytes:
    return json.dumps({
        "command_id": "11111111-1111-1111-1111-111111111111",
        "module": "generator",
        "command": "set_hv_state",
        "status": "completed",
        "error_message": None,
        "completed_at": SAMPLE_TS,
    }).encode()
