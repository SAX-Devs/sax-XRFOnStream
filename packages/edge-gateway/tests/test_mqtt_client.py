"""Tests for MqttClient."""

import threading
import time
from unittest.mock import MagicMock, patch

from src.mqtt_client import MqttClient


@patch("src.mqtt_client.Path")
@patch("src.mqtt_client.mqtt.Client")
def test_publish_when_connected(mock_paho_client_cls, mock_path, mock_mqtt_config):
    """When connected, publish goes directly to MQTT, not to buffer."""
    mock_path.return_value.read_text.return_value = "testpassword"
    mock_paho = MagicMock()
    mock_paho_client_cls.return_value = mock_paho

    mock_buffer = MagicMock()

    client = MqttClient(mock_mqtt_config, mock_buffer, lwt_topic="sax/t/d/equipment_state")
    client._connected = True

    client.publish("sax/t/d/telemetry/gen", b'{"test": 1}', 1)

    # retain defaults to False and is always passed through to paho.
    mock_paho.publish.assert_called_once_with(
        "sax/t/d/telemetry/gen", b'{"test": 1}', 1, False
    )
    mock_buffer.enqueue.assert_not_called()


@patch("src.mqtt_client.Path")
@patch("src.mqtt_client.mqtt.Client")
def test_publish_when_disconnected_buffers(mock_paho_client_cls, mock_path, mock_mqtt_config):
    """When disconnected, publish goes to the offline buffer."""
    mock_path.return_value.read_text.return_value = "testpassword"
    mock_paho = MagicMock()
    mock_paho_client_cls.return_value = mock_paho

    mock_buffer = MagicMock()

    client = MqttClient(mock_mqtt_config, mock_buffer, lwt_topic="sax/t/d/equipment_state")
    client._connected = False

    client.publish("sax/t/d/telemetry/gen", b'{"test": 1}', 1)

    mock_paho.publish.assert_not_called()
    mock_buffer.enqueue.assert_called_once_with("sax/t/d/telemetry/gen", b'{"test": 1}', 1)


@patch("src.mqtt_client.Path")
@patch("src.mqtt_client.mqtt.Client")
def test_reconnect_drains_buffer(mock_paho_client_cls, mock_path, mock_mqtt_config):
    """After reconnect, buffered messages are published in bounded batches
    and deleted (the drain runs off paho's network loop — here we call the
    worker directly instead of racing the background thread)."""
    mock_path.return_value.read_text.return_value = "testpassword"
    mock_paho = MagicMock()
    mock_paho_client_cls.return_value = mock_paho

    mock_buffer = MagicMock()
    # drain_batch is called repeatedly until it returns an empty batch.
    mock_buffer.drain_batch.side_effect = [
        [
            (1, "sax/t/d/telemetry/gen", b'{"test": 1}', 1),
            (2, "sax/t/d/telemetry/vac", b'{"test": 2}', 1),
        ],
        [],
    ]

    client = MqttClient(mock_mqtt_config, mock_buffer, lwt_topic="sax/t/d/equipment_state")
    client._connected = True

    client._drain_buffer()

    assert mock_paho.publish.call_count == 2
    assert mock_buffer.delete.call_count == 2
    mock_buffer.delete.assert_any_call(1)
    mock_buffer.delete.assert_any_call(2)


@patch("src.mqtt_client.Path")
@patch("src.mqtt_client.mqtt.Client")
def test_connect_never_blocks(mock_paho_client_cls, mock_path, mock_mqtt_config):
    """connect() must hand the connection to paho's loop, never block on it.

    Regression guard for 2026-08-19: the blocking ``connect()`` raised
    ``TimeoutError`` straight out of ``main()`` when a path-MTU black hole
    stalled the TLS handshake, so systemd restarted the service every ~65 s for
    five days and not a single sample was collected in the meantime.
    """
    mock_path.return_value.read_text.return_value = "testpassword"
    mock_paho = MagicMock()
    mock_paho_client_cls.return_value = mock_paho

    client = MqttClient(mock_mqtt_config, MagicMock(), lwt_topic="sax/t/d/equipment_state")
    client.connect()

    mock_paho.connect.assert_not_called()
    mock_paho.connect_async.assert_called_once_with(
        mock_mqtt_config.broker_url, mock_mqtt_config.port
    )
    mock_paho.loop_start.assert_called_once()

    client.disconnect()


@patch("src.mqtt_client.Path")
@patch("src.mqtt_client.mqtt.Client")
def test_watchdog_revives_a_dead_network_loop(mock_paho_client_cls, mock_path, mock_mqtt_config):
    """While disconnected the watchdog re-arms paho's loop.

    ``loop_start`` is a no-op when paho's thread is healthy, so calling it every
    tick is safe and revives the client if that thread ever dies — the only case
    where paho stops retrying on its own.
    """
    mock_path.return_value.read_text.return_value = "testpassword"
    mock_paho = MagicMock()
    mock_paho_client_cls.return_value = mock_paho

    client = MqttClient(mock_mqtt_config, MagicMock(), lwt_topic="sax/t/d/equipment_state")
    client._connected = False
    mock_paho.loop_start.reset_mock()

    with patch("src.mqtt_client.WATCHDOG_INTERVAL_S", 0.05):
        thread = threading.Thread(target=client._watchdog, daemon=True)
        thread.start()
        time.sleep(0.25)
        client._watchdog_stop.set()
        thread.join(timeout=2)

    assert mock_paho.loop_start.call_count >= 2
    assert not thread.is_alive()


@patch("src.mqtt_client.Path")
@patch("src.mqtt_client.mqtt.Client")
def test_connect_failures_are_counted(mock_paho_client_cls, mock_path, mock_mqtt_config):
    """paho retries silently at DEBUG; we count the failures so they surface."""
    mock_path.return_value.read_text.return_value = "testpassword"
    mock_paho_client_cls.return_value = MagicMock()

    client = MqttClient(mock_mqtt_config, MagicMock(), lwt_topic="sax/t/d/equipment_state")
    client._on_connect_fail(None)
    client._on_connect_fail(None)

    assert client._connect_failures == 2
    assert client._disconnected_since is not None
