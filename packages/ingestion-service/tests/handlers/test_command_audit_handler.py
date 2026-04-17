from __future__ import annotations

import pytest

from src.handlers.command_audit_handler import CommandAuditHandler
from src.topic_router import parse_topic
from tests.conftest import DEVICE_ID, TENANT_ID


@pytest.fixture
def parsed_ack():
    return parse_topic(f"sax/{TENANT_ID}/{DEVICE_ID}/command/ack")


@pytest.fixture
def parsed_result():
    return parse_topic(f"sax/{TENANT_ID}/{DEVICE_ID}/command/result")


def test_ack_updates_command_audit(mock_context, command_ack_payload, parsed_ack) -> None:
    CommandAuditHandler(mock_context).handle(parsed_ack, command_ack_payload)
    args = mock_context.writer.update.call_args
    assert args.args[0] == "command_audit"
    values = args.args[1]
    assert values["status"] == "ack"
    assert "ack_at" in values
    assert args.args[2] == {"id": "11111111-1111-1111-1111-111111111111"}


def test_result_updates_status_and_completed_at(mock_context, command_result_payload, parsed_result) -> None:
    CommandAuditHandler(mock_context).handle(parsed_result, command_result_payload)
    values = mock_context.writer.update.call_args.args[1]
    assert values["status"] == "completed"
    assert "completed_at" in values
    assert values["error_message"] is None


def test_writer_failure_does_not_raise(mock_context, command_ack_payload, parsed_ack) -> None:
    mock_context.writer.update.side_effect = RuntimeError("db down")
    CommandAuditHandler(mock_context).handle(parsed_ack, command_ack_payload)
