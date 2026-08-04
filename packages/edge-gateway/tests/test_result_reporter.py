"""Tests for the mapping-driven ResultReporter.

The behaviour that matters: a command's result must be reported exactly once,
even when the task finishes inside a single poll interval, and a terminal
status left over from BEFORE the command must never be reported as its result.
"""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from src.result_reporter import ResultReporter


ANCHOR = datetime(2026, 8, 4, 12, 0, 0, tzinfo=timezone.utc)


def _mapping(command: str, module: str = "circulation", created_at=ANCHOR) -> dict:
    return {
        "command_id": f"cmd-{command}",
        "module": module,
        "command": command,
        "created_at": created_at,
    }


def _action(task: str, status: str, ts) -> dict:
    return {"task": task, "status_task": status, "ts": ts, "error_log": ""}


def _make_reporter(config, mappings, action_rows):
    """Wire a reporter whose DB returns the given mappings and action rows."""
    db = MagicMock()
    db.read_table = MagicMock(return_value=action_rows)

    executed: list[str] = []

    def execute_with_retry(op):
        # The reporter uses _execute_with_retry for the mapping SELECT and for
        # the DELETEs; emulate both by inspecting the SQL it runs.
        cursor = MagicMock()
        cursor.fetchall = MagicMock(return_value=mappings)
        conn = MagicMock()
        conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
        conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        result = op(conn)
        for call in cursor.execute.call_args_list:
            executed.append(call[0][0])
        return result

    db._execute_with_retry = MagicMock(side_effect=execute_with_retry)

    mqtt = MagicMock()
    reporter = ResultReporter(config, mqtt, db)
    return reporter, mqtt, executed


def _published(mqtt) -> list[dict]:
    return [
        json.loads(call[0][1].decode()) for call in mqtt.publish.call_args_list
    ]


def test_completed_task_reported(mock_gateway_config):
    rows = [_action("tank_percentage_fill", "ready", ANCHOR + timedelta(seconds=30))]
    reporter, mqtt, _ = _make_reporter(
        mock_gateway_config, [_mapping("tank_percentage_fill")], rows
    )

    reporter._tick()

    results = _published(mqtt)
    assert len(results) == 1
    assert results[0]["status"] == "completed"
    assert results[0]["command_id"] == "cmd-tank_percentage_fill"
    assert results[0]["error_message"] is None


def test_fast_task_reported_without_observing_busy(mock_gateway_config):
    """The old transition-based reporter missed this case entirely: the task is
    already terminal the first time the reporter looks."""
    rows = [_action("usage_axial", "ready", ANCHOR + timedelta(milliseconds=800))]
    reporter, mqtt, _ = _make_reporter(
        mock_gateway_config,
        [_mapping("usage_axial", module="interchanger")],
        rows,
    )

    reporter._tick()

    assert len(_published(mqtt)) == 1


def test_stale_terminal_status_not_reported(mock_gateway_config):
    """A task that was left 'ready' BEFORE the command must not be reported —
    its result hasn't happened yet."""
    rows = [_action("empty_tank", "ready", ANCHOR - timedelta(minutes=5))]
    reporter, mqtt, _ = _make_reporter(
        mock_gateway_config, [_mapping("empty_tank")], rows
    )

    reporter._tick()

    assert _published(mqtt) == []


def test_in_progress_task_not_reported(mock_gateway_config):
    for status in ("command_received", "busy"):
        rows = [_action("empty_tank", status, ANCHOR + timedelta(seconds=5))]
        reporter, mqtt, _ = _make_reporter(
            mock_gateway_config, [_mapping("empty_tank")], rows
        )
        reporter._tick()
        assert _published(mqtt) == [], f"status {status} should not report"


def test_error_reports_equipment_error_log(mock_gateway_config):
    row = _action("empty_tank", "error", ANCHOR + timedelta(minutes=10))
    row["error_log"] = "Emptying tank timed out after 590 seconds."
    reporter, mqtt, _ = _make_reporter(
        mock_gateway_config, [_mapping("empty_tank")], [row]
    )

    reporter._tick()

    results = _published(mqtt)
    assert results[0]["status"] == "error"
    assert "timed out" in results[0]["error_message"]


def test_cancelled_reported_as_error_with_marker(mock_gateway_config):
    rows = [
        _action("tank_percentage_fill", "cancelled", ANCHOR + timedelta(seconds=42))
    ]
    reporter, mqtt, _ = _make_reporter(
        mock_gateway_config, [_mapping("tank_percentage_fill")], rows
    )

    reporter._tick()

    results = _published(mqtt)
    # The cloud audit vocabulary has no 'cancelled'; the marker message is what
    # lets the dashboard render it as a cancellation instead of a failure.
    assert results[0]["status"] == "error"
    assert results[0]["error_message"] == "Task cancelled"


def test_reported_mapping_is_deleted(mock_gateway_config):
    rows = [_action("empty_tank", "ready", ANCHOR + timedelta(seconds=1))]
    reporter, _, executed = _make_reporter(
        mock_gateway_config, [_mapping("empty_tank")], rows
    )

    reporter._tick()

    deletes = [
        sql
        for sql in executed
        if "DELETE" in sql and "WHERE command_id" in sql
    ]
    assert len(deletes) == 1


def test_cancel_command_itself_is_not_reported(mock_gateway_config):
    """'cancel' has no *_action row — nothing to match, nothing to publish."""
    rows = [_action("tank_percentage_fill", "busy", ANCHOR)]
    reporter, mqtt, _ = _make_reporter(
        mock_gateway_config, [_mapping("cancel")], rows
    )

    reporter._tick()

    assert _published(mqtt) == []


def test_mapping_select_is_bounded(mock_gateway_config):
    reporter, _, executed = _make_reporter(mock_gateway_config, [], [])

    reporter._tick()

    selects = [sql for sql in executed if "edge_gateway_command_map" in sql and "SELECT" in sql]
    assert selects, "expected a mapping SELECT"
    assert "LIMIT" in selects[0]
