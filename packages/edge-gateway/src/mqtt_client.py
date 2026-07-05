"""MQTT client wrapper with TLS, reconnection, and offline buffering."""

import json
import logging
import ssl
import threading
from collections.abc import Callable
from pathlib import Path

import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion

from src.config import MqttConfig
from src.offline_buffer import OfflineBuffer

logger = logging.getLogger("edge-gateway.mqtt")


class MqttClient:
    def __init__(
        self,
        config: MqttConfig,
        offline_buffer: OfflineBuffer,
        lwt_topic: str,
    ) -> None:
        self._config = config
        self._offline_buffer = offline_buffer
        self._connected = False
        self._connect_count = 0
        self._subscriptions: dict[str, tuple[Callable, int]] = {}

        password = Path(config.password_file).read_text().strip()

        self._client = mqtt.Client(
            callback_api_version=CallbackAPIVersion.VERSION2,
            client_id=config.client_id,
        )
        self._client.username_pw_set(config.username, password)
        # Cap paho's in-memory outbound queue: on a stalled link, an unbounded
        # queue grows in RAM (excess messages are dropped instead — acceptable
        # for telemetry, and heavy spectra are gated on connectivity upstream).
        self._client.max_queued_messages_set(10_000)

        if config.use_tls:
            context = ssl.create_default_context()
            context.minimum_version = ssl.TLSVersion.TLSv1_2
            self._client.tls_set_context(context)

        self._client.will_set(
            lwt_topic,
            payload=json.dumps({"status": "offline"}).encode(),
            qos=1,
            retain=True,
        )

        self._client.reconnect_delay_set(min_delay=1, max_delay=60)

        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._client.on_message = self._on_message

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            self._connected = True
            self._connect_count += 1
            logger.info("Connected to MQTT broker")
            for topic, (callback, qos) in self._subscriptions.items():
                client.subscribe(topic, qos)
                logger.info(f"Re-subscribed to {topic}")
            # Drain in a separate thread: a large backlog must not block paho's
            # network loop (blocking it starves keepalives → disconnect loop).
            threading.Thread(target=self._drain_buffer, daemon=True).start()
        else:
            logger.error(f"Connection failed with code: {reason_code}")

    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None):
        self._connected = False
        if reason_code == 0:
            logger.info("Disconnected from MQTT broker (clean)")
        else:
            logger.warning(f"Unexpected disconnect, code: {reason_code}")

    def _on_message(self, client, userdata, message):
        topic = message.topic
        for sub_topic, (callback, _) in self._subscriptions.items():
            if mqtt.topic_matches_sub(sub_topic, topic):
                try:
                    callback(topic, message.payload)
                except Exception:
                    logger.exception(f"Error in callback for topic {topic}")
                break

    def _drain_buffer(self) -> None:
        """Send buffered messages after reconnection, in bounded batches.

        Never loads the whole buffer into RAM (incident 2026-07-02 class);
        aborts early if the connection drops mid-drain.
        """
        total = 0
        while self._connected:
            messages = self._offline_buffer.drain_batch()
            if not messages:
                break
            if total == 0:
                logger.info("Draining buffered messages...")
            for msg_id, topic, payload, qos in messages:
                if not self._connected:
                    break
                self._client.publish(topic, payload, qos)
                self._offline_buffer.delete(msg_id)
                total += 1
        if total:
            logger.info(f"Buffer drained: {total} messages sent")

    def connect(self) -> None:
        """Connect to the MQTT broker and start the network loop."""
        logger.info(f"Connecting to {self._config.broker_url}:{self._config.port}")
        self._client.connect(self._config.broker_url, self._config.port)
        self._client.loop_start()

    def disconnect(self) -> None:
        """Disconnect from the broker and stop the network loop."""
        self._client.loop_stop()
        self._client.disconnect()
        self._connected = False
        logger.info("MQTT client disconnected")

    def publish(
        self, topic: str, payload: bytes, qos: int = 1, retain: bool = False
    ) -> None:
        """Publish a message, buffering if disconnected.

        Buffered messages lose the retain flag — acceptable: the only retained
        publisher (equipment state) force-republishes on every reconnect.
        """
        if self._connected:
            self._client.publish(topic, payload, qos, retain)
        else:
            self._offline_buffer.enqueue(topic, payload, qos)

    @property
    def connection_generation(self) -> int:
        """Increments on every (re)connect — lets publishers detect reconnects."""
        return self._connect_count

    def subscribe(self, topic: str, callback: Callable, qos: int = 1) -> None:
        """Subscribe to a topic with a callback."""
        self._subscriptions[topic] = (callback, qos)
        if self._connected:
            self._client.subscribe(topic, qos)
            logger.info(f"Subscribed to {topic}")

    @property
    def is_connected(self) -> bool:
        return self._connected
