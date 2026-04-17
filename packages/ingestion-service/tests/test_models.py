"""Pydantic payload model tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.models import (
    CommandAckPayload,
    EquipmentStatePayload,
    SentinelPayload,
    TelemetryPayload,
)


def test_telemetry_payload_validates(telemetry_payload) -> None:
    p = TelemetryPayload.model_validate_json(telemetry_payload)
    assert p.module == "generator"
    assert p.data["hv_on"] is False


def test_telemetry_rejects_missing_field() -> None:
    with pytest.raises(ValidationError):
        TelemetryPayload.model_validate_json(b'{"device_id":"x","module":"y","ts":"2026-01-01T00:00:00Z"}')


def test_equipment_state_normalises_lwt(equipment_state_lwt_payload) -> None:
    p = EquipmentStatePayload.model_validate_json(equipment_state_lwt_payload)
    assert p.state == "offline"


def test_equipment_state_unknown_value_coerced_to_unknown() -> None:
    p = EquipmentStatePayload.model_validate_json(b'{"state":"weird","ts":"2026-01-01T00:00:00Z"}')
    assert p.state == "unknown"


def test_sentinel_payload_parses_alert_list(sentinel_payload) -> None:
    p = SentinelPayload.model_validate_json(sentinel_payload)
    assert len(p.alerts) == 2
    assert p.alerts[0].name == "critical_flow"
    assert p.alerts[0].severity == "CRITICAL"


def test_command_ack_status_locked_to_ack(command_ack_payload) -> None:
    p = CommandAckPayload.model_validate_json(command_ack_payload)
    assert p.status == "ack"
    assert p.command_id == "11111111-1111-1111-1111-111111111111"
