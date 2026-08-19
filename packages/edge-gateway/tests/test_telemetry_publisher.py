"""Tests for TelemetryPublisher."""

import json
from unittest.mock import MagicMock

import psycopg

from src.telemetry_publisher import TelemetryPublisher


def test_publishes_all_modules(mock_gateway_config, mock_mqtt_client, mock_db_reader):
    """First tick publishes all 7 modules."""
    module_data = {
        "generator_status": {"hv_on": False, "tube_high_voltage_kv": 30.0},
        "vacuum_status": {"vacuum_sensor": 0.85},
        "circulation_status": {"pump_state": True, "flow_rate_in": 2.5},
        "interchanger_status": {"current_position": 1},
        "detector_status": {"mca_length": 2048, "temperature": -25.3},
        "temp_control_status": {"water_pressure": 1.2},
        "auxiliary_status": {"bat_vol": 24.1, "dc_ok": True},
    }

    def side_effect(table_name):
        return module_data.get(table_name)

    mock_db_reader.read_single_row.side_effect = side_effect

    pub = TelemetryPublisher(mock_gateway_config, mock_mqtt_client, mock_db_reader)
    pub._tick()

    assert mock_mqtt_client.publish.call_count == 7


def test_only_publishes_changes(mock_gateway_config, mock_mqtt_client, mock_db_reader):
    """Second tick only publishes modules that changed."""
    module_data = {
        "generator_status": {"hv_on": False, "tube_high_voltage_kv": 30.0},
        "vacuum_status": {"vacuum_sensor": 0.85},
        "circulation_status": {"pump_state": True},
        "interchanger_status": {"current_position": 1},
        "detector_status": {"mca_length": 2048},
        "temp_control_status": {"water_pressure": 1.2},
        "auxiliary_status": {"bat_vol": 24.1},
    }

    mock_db_reader.read_single_row.side_effect = lambda t: module_data.get(t)

    pub = TelemetryPublisher(mock_gateway_config, mock_mqtt_client, mock_db_reader)
    pub._tick()
    assert mock_mqtt_client.publish.call_count == 7

    mock_mqtt_client.publish.reset_mock()

    # Change only generator
    module_data["generator_status"] = {"hv_on": True, "tube_high_voltage_kv": 35.0}
    mock_db_reader.read_single_row.side_effect = lambda t: module_data.get(t)

    pub._tick()
    assert mock_mqtt_client.publish.call_count == 1

    call_args = mock_mqtt_client.publish.call_args
    topic = call_args[0][0]
    assert "telemetry/generator" in topic


def test_keepalive_republishes_static_module(
    mock_gateway_config, mock_mqtt_client, mock_db_reader
):
    """A module whose row never changes is still republished once the
    keepalive window elapses — otherwise the cloud's retention purge deletes
    its last row and the dashboard renders 'no data' (2026-08-18 incident:
    a parked interchanger showed its locks as open)."""
    module_data = {
        "generator_status": {"hv_on": False},
        "vacuum_status": {"vacuum_sensor": 0.85},
        "circulation_status": {"pump_state": True},
        "interchanger_status": {"current_position": "Chamber"},
        "detector_status": {"mca_length": 2048},
        "temp_control_status": {"water_pressure": 1.2},
        "auxiliary_status": {"bat_vol": 24.1},
    }
    mock_db_reader.read_single_row.side_effect = lambda t: module_data.get(t)

    pub = TelemetryPublisher(mock_gateway_config, mock_mqtt_client, mock_db_reader)
    pub._tick()
    assert mock_mqtt_client.publish.call_count == 7

    # Nothing changed, keepalive not yet due: silent tick.
    mock_mqtt_client.publish.reset_mock()
    pub._tick()
    assert mock_mqtt_client.publish.call_count == 0

    # Nothing changed but the keepalive window elapsed: everything republishes.
    pub._last_published = {t: v - 601.0 for t, v in pub._last_published.items()}
    pub._tick()
    assert mock_mqtt_client.publish.call_count == 7


def test_handles_db_connection_error(mock_gateway_config, mock_mqtt_client, mock_db_reader):
    """DB errors are caught, no crash, no publish."""
    mock_db_reader.read_single_row.side_effect = psycopg.OperationalError("connection lost")

    pub = TelemetryPublisher(mock_gateway_config, mock_mqtt_client, mock_db_reader)
    pub._tick()  # Should not raise

    mock_mqtt_client.publish.assert_not_called()
