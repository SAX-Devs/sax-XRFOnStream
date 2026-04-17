from __future__ import annotations

import json

import pytest

from src.handlers.concentrations_handler import ConcentrationsHandler
from src.topic_router import parse_topic
from tests.conftest import DEVICE_ID, TENANT_ID, _TS  # noqa: WPS450


@pytest.fixture
def parsed():
    return parse_topic(f"sax/{TENANT_ID}/{DEVICE_ID}/concentrations")


def test_inserts_when_elements_present(mock_context, concentrations_payload, parsed) -> None:
    ConcentrationsHandler(mock_context).handle(parsed, concentrations_payload)
    row = mock_context.writer.insert.call_args.args[1]
    assert row["elements"] == {"Cu": 1.23, "Fe": 0.45}
    assert row["measurement_id"] == "m-003"


def test_skips_when_elements_empty(mock_context, parsed) -> None:
    payload = json.dumps({
        "device_id": DEVICE_ID,
        "ts": _TS,
        "measurement_id": "",
        "elements": {},
    }).encode()
    ConcentrationsHandler(mock_context).handle(parsed, payload)
    mock_context.writer.insert.assert_not_called()
    mock_context.writer.update_last_seen.assert_not_called()
