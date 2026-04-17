"""MQTT subscriber that dispatches incoming messages to the right handler.

Mirrors the Edge Gateway's ``MqttClient`` shape but inverted: this side only
subscribes (never publishes). Sessions are persistent (``clean_start=False``)
so any messages buffered by EMQX while we were down are redelivered on
reconnect — covering the Phase 2 acceptance criterion that 1-minute downtime
must not lose data.
"""

from __future__ import annotations

import json
import logging
import ssl
import threading
from datetime import datetime, timezone
from typing import Mapping

import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion
from pydantic import ValidationError

from src.config import IngestionConfig
from src.handlers.base import Handler
from src.topic_router import ParsedTopic, TopicKind, parse_topic

logger = logging.getLogger("ingestion-service.mqtt")


_SUBSCRIPTIONS: tuple[tuple[str, int], ...] = (
    ("sax/+/+/telemetry/+", 1),
    ("sax/+/+/spectra", 1),
    ("sax/+/+/concentrations", 1),
    ("sax/+/+/alerts", 1),
    ("sax/+/+/sentinel", 1),
    ("sax/+/+/equipment_state", 1),
    ("sax/+/+/command/ack", 1),
    ("sax/+/+/command/result", 1),
)


class MqttSubscriber:
    def __init__(
        self,
        config: IngestionConfig,
        handlers: Mapping[TopicKind, Handler],
    ) -> None:
        self._config = config
        self._handlers = dict(handlers)
        self._connected = threading.Event()
        self._last_message_at: datetime | None = None
        self._last_message_lock = threading.Lock()

        self._client = mqtt.Client(
            callback_api_version=CallbackAPIVersion.VERSION2,
            client_id=config.mqtt_client_id,
            clean_session=False,
        )
        self._client.username_pw_set(
            config.mqtt_username,
            config.mqtt_password.get_secret_value(),
        )

        if config.mqtt_use_tls:
            ctx = ssl.create_default_context()
            ctx.minimum_version = ssl.TLSVersion.TLSv1_2
            self._client.tls_set_context(ctx)

        self._client.reconnect_delay_set(min_delay=1, max_delay=60)
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        self._client.on_message = self._on_message

    # -- Lifecycle ---------------------------------------------------------

    def connect(self) -> None:
        logger.info(
            "Connecting to MQTT broker %s:%d as %s",
            self._config.mqtt_broker_url,
            self._config.mqtt_broker_port,
            self._config.mqtt_username,
        )
        self._client.connect(
            self._config.mqtt_broker_url,
            self._config.mqtt_broker_port,
            keepalive=self._config.mqtt_keepalive_s,
        )
        self._client.loop_start()

    def disconnect(self) -> None:
        logger.info("Disconnecting from MQTT broker")
        self._client.loop_stop()
        self._client.disconnect()
        self._connected.clear()

    # -- Health hooks ------------------------------------------------------

    @property
    def is_connected(self) -> bool:
        return self._connected.is_set()

    @property
    def last_message_at(self) -> datetime | None:
        with self._last_message_lock:
            return self._last_message_at

    # -- Paho callbacks ----------------------------------------------------

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code != 0:
            logger.error("MQTT connect failed (code=%s)", reason_code)
            return
        self._connected.set()
        logger.info("Connected to MQTT broker — subscribing to %d topic patterns", len(_SUBSCRIPTIONS))
        for topic, qos in _SUBSCRIPTIONS:
            client.subscribe(topic, qos)

    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None):
        self._connected.clear()
        if reason_code == 0:
            logger.info("MQTT disconnected (clean)")
        else:
            logger.warning("MQTT disconnected unexpectedly (code=%s) — auto-reconnect armed", reason_code)

    def _on_message(self, client, userdata, message):
        topic = message.topic
        payload = message.payload

        with self._last_message_lock:
            self._last_message_at = datetime.now(timezone.utc)

        parsed = parse_topic(topic)
        if parsed is None:
            logger.warning("Dropping message on unknown topic: %s", topic)
            return

        handler = self._handlers.get(parsed.kind)
        if handler is None:
            logger.warning("No handler registered for kind %s (topic=%s)", parsed.kind, topic)
            return

        try:
            handler.handle(parsed, payload)
        except ValidationError as exc:
            logger.warning(
                "Payload validation failed on %s: %s",
                topic, _short(exc),
            )
        except json.JSONDecodeError as exc:
            logger.warning("Invalid JSON on %s: %s", topic, exc)
        except Exception:
            logger.exception("Handler %s raised on topic %s", type(handler).__name__, topic)


def _short(exc: ValidationError) -> str:
    """Render a Pydantic error compactly so it fits one log line."""
    errors = exc.errors()
    if not errors:
        return str(exc)
    first = errors[0]
    loc = ".".join(str(p) for p in first.get("loc", ()))
    return f"{loc}: {first.get('msg')}"
