"""SupabaseWriter retry/backoff and last-seen cache tests."""

from __future__ import annotations

import time
from unittest.mock import MagicMock

import pytest

from src.supabase_writer import SupabaseWriter, _is_retryable


def _make_writer(mock_config) -> tuple[SupabaseWriter, MagicMock]:
    client = MagicMock()
    writer = SupabaseWriter(mock_config, client=client, last_seen_cache_ttl_s=60.0)
    return writer, client


def test_insert_calls_supabase_table(mock_config) -> None:
    writer, client = _make_writer(mock_config)
    writer.insert("device_telemetry", {"x": 1})
    client.table.assert_called_with("device_telemetry")
    client.table().insert.assert_called_with({"x": 1})


def test_upsert_uses_on_conflict(mock_config) -> None:
    writer, client = _make_writer(mock_config)
    writer.upsert("device_equipment_state", {"device_id": "d"}, on_conflict="device_id")
    client.table().upsert.assert_called_with({"device_id": "d"}, on_conflict="device_id")


def test_update_chains_eq_filters(mock_config) -> None:
    writer, client = _make_writer(mock_config)
    writer.update("command_audit", {"status": "ack"}, {"id": "cmd-1"})
    client.table().update.assert_called_with({"status": "ack"})
    client.table().update().eq.assert_called_with("id", "cmd-1")


def test_last_seen_cached_within_ttl(mock_config) -> None:
    writer, _ = _make_writer(mock_config)
    writer.update = MagicMock()
    writer.update_last_seen("device-1")
    writer.update_last_seen("device-1")
    assert writer.update.call_count == 1


def test_last_seen_separate_devices_not_shared(mock_config) -> None:
    writer, _ = _make_writer(mock_config)
    writer.update = MagicMock()
    writer.update_last_seen("device-1")
    writer.update_last_seen("device-2")
    assert writer.update.call_count == 2


def test_retry_on_retryable_error(mock_config, monkeypatch) -> None:
    monkeypatch.setattr(time, "sleep", lambda *_: None)
    writer, _ = _make_writer(mock_config)
    calls = {"n": 0}

    def flaky() -> str:
        calls["n"] += 1
        if calls["n"] < 3:
            raise TimeoutError("timed out")
        return "ok"

    result = writer._with_retry(flaky, max_attempts=3, base_delay_s=0.01)
    assert result == "ok"
    assert calls["n"] == 3


def test_no_retry_on_deterministic_error(mock_config) -> None:
    writer, _ = _make_writer(mock_config)
    calls = {"n": 0}

    def boom() -> None:
        calls["n"] += 1
        raise ValueError("bad payload")

    with pytest.raises(ValueError):
        writer._with_retry(boom, max_attempts=3, base_delay_s=0.01)
    assert calls["n"] == 1


def test_is_retryable_classifies_status_codes() -> None:
    err = Exception("boom")
    err.status_code = 503  # type: ignore[attr-defined]
    assert _is_retryable(err)
    err.status_code = 400  # type: ignore[attr-defined]
    assert not _is_retryable(err)
