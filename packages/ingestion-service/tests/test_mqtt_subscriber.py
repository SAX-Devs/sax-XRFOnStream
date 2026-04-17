"""MQTT subscriber dispatch tests — exercise the on_message routing only."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from src.mqtt_subscriber import MqttSubscriber
from src.topic_router import TopicKind
from tests.conftest import DEVICE_ID, TENANT_ID


def _make_subscriber(mock_config) -> tuple[MqttSubscriber, dict[TopicKind, MagicMock]]:
    handlers = {kind: MagicMock() for kind in TopicKind}
    sub = MqttSubscriber(mock_config, handlers)
    return sub, handlers


def _msg(topic: str, payload: bytes = b"{}") -> MagicMock:
    m = MagicMock()
    m.topic = topic
    m.payload = payload
    return m


def test_dispatches_to_telemetry_handler(mock_config) -> None:
    sub, handlers = _make_subscriber(mock_config)
    sub._on_message(None, None, _msg(f"sax/{TENANT_ID}/{DEVICE_ID}/telemetry/generator"))
    handlers[TopicKind.TELEMETRY].handle.assert_called_once()


def test_unknown_topic_drops_silently(mock_config) -> None:
    sub, handlers = _make_subscriber(mock_config)
    sub._on_message(None, None, _msg("nonsense/topic"))
    for h in handlers.values():
        h.handle.assert_not_called()


def test_handler_exception_does_not_propagate(mock_config) -> None:
    sub, handlers = _make_subscriber(mock_config)
    handlers[TopicKind.SPECTRA].handle.side_effect = RuntimeError("boom")
    sub._on_message(None, None, _msg(f"sax/{TENANT_ID}/{DEVICE_ID}/spectra"))


def test_last_message_at_updated_on_message(mock_config) -> None:
    sub, _ = _make_subscriber(mock_config)
    before = datetime.now(timezone.utc) - timedelta(seconds=1)
    sub._on_message(None, None, _msg(f"sax/{TENANT_ID}/{DEVICE_ID}/spectra"))
    assert sub.last_message_at is not None
    assert sub.last_message_at > before
