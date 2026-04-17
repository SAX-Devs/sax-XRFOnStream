"""Pure parser for MQTT topic strings.

Encapsulates the SAX topic grammar:

    sax/{tenant_id}/{device_id}/telemetry/{module}
    sax/{tenant_id}/{device_id}/spectra
    sax/{tenant_id}/{device_id}/concentrations
    sax/{tenant_id}/{device_id}/alerts
    sax/{tenant_id}/{device_id}/sentinel
    sax/{tenant_id}/{device_id}/equipment_state
    sax/{tenant_id}/{device_id}/command/ack
    sax/{tenant_id}/{device_id}/command/result

No I/O. Easy to unit-test. Returns ``None`` for unrecognised topics so the
caller can log + drop without exceptions.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Final
from uuid import UUID


class TopicKind(str, Enum):
    TELEMETRY = "telemetry"
    SPECTRA = "spectra"
    CONCENTRATIONS = "concentrations"
    ALERTS = "alerts"
    SENTINEL = "sentinel"
    EQUIPMENT_STATE = "equipment_state"
    COMMAND_ACK = "command_ack"
    COMMAND_RESULT = "command_result"


@dataclass(frozen=True)
class ParsedTopic:
    tenant_id: str
    device_id: str
    kind: TopicKind
    module: str | None = None  # Only set for TELEMETRY


_NAMESPACE: Final[str] = "sax"


def parse_topic(topic: str) -> ParsedTopic | None:
    """Parse a topic string into its components, or return None if invalid.

    Validates the namespace prefix, UUID shape of tenant/device segments, and
    that the kind segment matches a known pattern. ``None`` is the signal for
    "drop this message"; callers should log a warning, not crash.
    """
    if not topic:
        return None

    parts = topic.split("/")
    if len(parts) < 4 or parts[0] != _NAMESPACE:
        return None

    tenant_id, device_id = parts[1], parts[2]
    if not _is_uuid(tenant_id) or not _is_uuid(device_id):
        return None

    tail = parts[3:]
    return _classify(tenant_id, device_id, tail)


def _classify(tenant_id: str, device_id: str, tail: list[str]) -> ParsedTopic | None:
    head = tail[0]

    if head == "telemetry":
        if len(tail) != 2 or not tail[1]:
            return None
        return ParsedTopic(tenant_id, device_id, TopicKind.TELEMETRY, module=tail[1])

    if head == "command":
        if len(tail) != 2:
            return None
        if tail[1] == "ack":
            return ParsedTopic(tenant_id, device_id, TopicKind.COMMAND_ACK)
        if tail[1] == "result":
            return ParsedTopic(tenant_id, device_id, TopicKind.COMMAND_RESULT)
        return None

    if len(tail) != 1:
        return None

    simple_kinds = {
        "spectra": TopicKind.SPECTRA,
        "concentrations": TopicKind.CONCENTRATIONS,
        "alerts": TopicKind.ALERTS,
        "sentinel": TopicKind.SENTINEL,
        "equipment_state": TopicKind.EQUIPMENT_STATE,
    }
    kind = simple_kinds.get(head)
    if kind is None:
        return None
    return ParsedTopic(tenant_id, device_id, kind)


def _is_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except (ValueError, AttributeError, TypeError):
        return False
