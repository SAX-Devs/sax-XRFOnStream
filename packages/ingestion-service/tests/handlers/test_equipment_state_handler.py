from __future__ import annotations

import pytest

from src.handlers.equipment_state_handler import EquipmentStateHandler
from src.topic_router import parse_topic
from tests.conftest import DEVICE_ID, TENANT_ID


@pytest.fixture
def parsed():
    return parse_topic(f"sax/{TENANT_ID}/{DEVICE_ID}/equipment_state")


def test_normal_state_upserts_and_marks_seen(mock_context, equipment_state_payload, parsed) -> None:
    EquipmentStateHandler(mock_context).handle(parsed, equipment_state_payload)
    args = mock_context.writer.upsert.call_args
    assert args.args[0] == "device_equipment_state"
    assert args.kwargs["on_conflict"] == "device_id"
    row = args.args[1]
    assert row["state"] == "measuring"
    assert row["detail"]["active_tasks"] == ["measure_sample"]
    mock_context.writer.update_last_seen.assert_called_once_with(DEVICE_ID)


def test_lwt_payload_upserts_offline_no_last_seen(mock_context, equipment_state_lwt_payload, parsed) -> None:
    EquipmentStateHandler(mock_context).handle(parsed, equipment_state_lwt_payload)
    row = mock_context.writer.upsert.call_args.args[1]
    assert row["state"] == "offline"
    assert row["device_id"] == DEVICE_ID
    mock_context.writer.update_last_seen.assert_not_called()
