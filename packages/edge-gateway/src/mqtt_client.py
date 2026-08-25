"""MQTT client wrapper with TLS, reconnection, and offline buffering."""

import json
import logging
import ssl
import threading
import time
from collections.abc import Callable
from pathlib import Path

import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion

from src.config import MqttConfig
from src.offline_buffer import OfflineBuffer

logger = logging.getLogger("edge-gateway.mqtt")

# paho retries a failed connection on its own but only logs it at DEBUG, so a
# broker it cannot reach produces a completely silent log (incident 2026-08-19:
# 5 days offline, not one line). Surface it, throttled so a long outage does not
# flood the journal.
DOWN_LOG_INTERVAL_S = 300.0

# How often the watchdog checks that the network loop is still alive.
WATCHDOG_INTERVAL_S = 30.0


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
        self._connect_failures = 0
        self._disconnected_since: float | None = time.monotonic()
        self._last_down_log = 0.0
        self._watchdog_stop = threading.Event()
        self._watchdog_thread: threading.Thread | None = None

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
        self._client.on_connect_fail = self._on_connect_fail

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            self._connected = True
            self._connect_count += 1
            if self._disconnected_since is not None:
                down_s = int(time.monotonic() - self._disconnected_since)
                logger.info(
                    f"Connected to MQTT broker (after {down_s}s down, "
                    f"{self._connect_failures} failed attempts)"
                )
            else:
                logger.info("Connected to MQTT broker")
            self._disconnected_since = None
            self._connect_failures = 0
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
        if self._disconnected_since is None:
            self._disconnected_since = time.monotonic()
        if reason_code == 0:
            logger.info("Disconnected from MQTT broker (clean)")
        else:
            logger.warning(f"Unexpected disconnect, code: {reason_code}")

    def _on_connect_fail(self, client, userdata=None):
        """Count paho's silent retries so the watchdog can report them."""
        self._connect_failures += 1
        if self._disconnected_since is None:
            self._disconnected_since = time.monotonic()

    def _watchdog(self) -> None:
        """Keep the network loop alive and make long outages visible.

        paho retries by itself, but only for as long as its loop thread lives:
        if that thread ever dies the client goes quiet for good. ``loop_start``
        is a no-op while the thread is healthy and revives it when it is not,
        which makes this safe to call on every tick.
        """
        while not self._watchdog_stop.wait(WATCHDOG_INTERVAL_S):
            if self._connected:
                continue

            self._client.loop_start()

            now = time.monotonic()
            if now - self._last_down_log >= DOWN_LOG_INTERVAL_S:
                self._last_down_log = now
                down_s = int(now - (self._disconnected_since or now))
                logger.warning(
                    f"Still disconnected from MQTT broker after {down_s}s "
                    f"({self._connect_failures} failed attempts) - buffering locally"
                )

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
        """Start the network loop; the connection itself proceeds in background.

        ``connect_async`` never blocks, so an unreachable broker no longer takes
        the whole gateway down with it: the publishers still start and buffer to
        disk, and paho's loop thread owns the retry loop
        (``loop_forever(retry_first_connection=True)``).

        The blocking ``connect()`` used before raised ``TimeoutError`` straight
        out of ``main()`` whenever the TLS handshake stalled. On 2026-08-19 a
        path-MTU black hole stalled every handshake, so systemd restarted the
        service every ~65 s for five days and not a single sample was collected
        in the meantime.
        """
        logger.info(f"Connecting to {self._config.broker_url}:{self._config.port}")
        self._client.connect_async(self._config.broker_url, self._config.port)
        self._client.loop_start()
        if self._watchdog_thread is None:
            self._watchdog_thread = threading.Thread(
                target=self._watchdog, daemon=True, name="mqtt-watchdog"
            )
            self._watchdog_thread.start()

    def disconnect(self) -> None:
        """Disconnect from the broker and stop the network loop."""
        self._watchdog_stop.set()
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
