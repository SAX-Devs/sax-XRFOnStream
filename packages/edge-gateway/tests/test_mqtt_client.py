"""Tests for MqttClient."""

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

    mock_paho.publish.assert_called_once_with("sax/t/d/telemetry/gen", b'{"test": 1}', 1)
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
    """On reconnect, buffered messages are published and deleted."""
    mock_path.return_value.read_text.return_value = "testpassword"
    mock_paho = MagicMock()
    mock_paho_client_cls.return_value = mock_paho

    mock_buffer = MagicMock()
    mock_buffer.drain.return_value = [
        (1, "sax/t/d/telemetry/gen", b'{"test": 1}', 1),
        (2, "sax/t/d/telemetry/vac", b'{"test": 2}', 1),
    ]

    client = MqttClient(mock_mqtt_config, mock_buffer, lwt_topic="sax/t/d/equipment_state")

    # Simulate on_connect callback
    client._on_connect(mock_paho, None, None, 0)

    assert mock_paho.publish.call_count == 2
    assert mock_buffer.delete.call_count == 2
    mock_buffer.delete.assert_any_call(1)
    mock_buffer.delete.assert_any_call(2)
