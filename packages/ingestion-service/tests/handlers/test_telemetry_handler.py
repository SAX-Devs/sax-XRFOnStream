from __future__ import annotations

import pytest

from src.handlers.telemetry_handler import TelemetryHandler
from src.topic_router import TopicKind, parse_topic
from tests.conftest import DEVICE_ID, TENANT_ID


@pytest.fixture
def parsed():
    return parse_topic(f"sax/{TENANT_ID}/{DEVICE_ID}/telemetry/generator")


def test_inserts_telemetry_row(mock_context, telemetry_payload, parsed) -> None:
    TelemetryHandler(mock_context).handle(parsed, telemetry_payload)
    args = mock_context.writer.insert.call_args
    assert args.args[0] == "device_telemetry"
    row = args.args[1]
    assert row["device_id"] == DEVICE_ID
    assert row["tenant_id"] == TENANT_ID
    assert row["module"] == "generator"
    assert row["data"]["hv_on"] is False
    mock_context.writer.update_last_seen.assert_called_once_with(DEVICE_ID)


def test_topic_module_overrides_payload_module(mock_context, parsed) -> None:
    bad = b'{"device_id":"x","module":"WRONG","ts":"2026-04-16T12:00:00+00:00","data":{}}'
    TelemetryHandler(mock_context).handle(parsed, bad)
    row = mock_context.writer.insert.call_args.args[1]
    assert row["module"] == "generator"


def test_invalid_payload_propagates_validation_error(mock_context, parsed) -> None:
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        TelemetryHandler(mock_context).handle(parsed, b'{"device_id":"x"}')
    mock_context.writer.insert.assert_not_called()
