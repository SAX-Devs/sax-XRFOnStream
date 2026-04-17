from __future__ import annotations

import pytest

from src.handlers.alert_handler import AlertHandler
from src.topic_router import parse_topic
from tests.conftest import DEVICE_ID, TENANT_ID


@pytest.fixture
def parsed():
    return parse_topic(f"sax/{TENANT_ID}/{DEVICE_ID}/sentinel")


def test_inserts_one_row_per_alert(mock_context, sentinel_payload, parsed) -> None:
    AlertHandler(mock_context).handle(parsed, sentinel_payload)
    assert mock_context.writer.insert.call_count == 2

    rows = [c.args[1] for c in mock_context.writer.insert.call_args_list]
    severities = sorted(r["severity"] for r in rows)
    assert severities == ["critical", "info"]
    titles = sorted(r["title"] for r in rows)
    assert titles == ["critical_flow", "vacuum"]


def test_unknown_severity_skipped(mock_context, parsed) -> None:
    import json
    payload = json.dumps({
        "device_id": DEVICE_ID,
        "ts": "2026-04-16T12:00:00+00:00",
        "alerts": [{"name": "x", "severity": "WAT", "message": "?"}],
    }).encode()
    AlertHandler(mock_context).handle(parsed, payload)
    mock_context.writer.insert.assert_not_called()
