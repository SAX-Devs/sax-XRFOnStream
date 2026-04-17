"""Topic parser tests — pure, no I/O."""

from __future__ import annotations

import pytest

from src.topic_router import TopicKind, parse_topic

T = "a1b2c3d4-0000-0000-0000-000000000001"
D = "d1e2f3a4-0000-0000-0000-000000000001"


@pytest.mark.parametrize(
    "topic, expected_kind, expected_module",
    [
        (f"sax/{T}/{D}/telemetry/generator", TopicKind.TELEMETRY, "generator"),
        (f"sax/{T}/{D}/telemetry/temp_control", TopicKind.TELEMETRY, "temp_control"),
        (f"sax/{T}/{D}/spectra", TopicKind.SPECTRA, None),
        (f"sax/{T}/{D}/concentrations", TopicKind.CONCENTRATIONS, None),
        (f"sax/{T}/{D}/alerts", TopicKind.ALERTS, None),
        (f"sax/{T}/{D}/sentinel", TopicKind.SENTINEL, None),
        (f"sax/{T}/{D}/equipment_state", TopicKind.EQUIPMENT_STATE, None),
        (f"sax/{T}/{D}/command/ack", TopicKind.COMMAND_ACK, None),
        (f"sax/{T}/{D}/command/result", TopicKind.COMMAND_RESULT, None),
    ],
)
def test_valid_topics(topic, expected_kind, expected_module) -> None:
    parsed = parse_topic(topic)
    assert parsed is not None
    assert parsed.tenant_id == T
    assert parsed.device_id == D
    assert parsed.kind == expected_kind
    assert parsed.module == expected_module


@pytest.mark.parametrize(
    "topic",
    [
        "",
        "sax/not-a-uuid/also-not/spectra",
        f"sax/{T}/{D}/unknown_kind",
        f"sax/{T}/{D}/command/unknown",
        f"sax/{T}/{D}/telemetry",  # missing module
        f"sax/{T}/{D}/telemetry/",  # empty module
        "wrong_namespace/x/y/spectra",
        f"sax/{T}/{D}/spectra/extra/segments",
    ],
)
def test_invalid_topics_return_none(topic: str) -> None:
    assert parse_topic(topic) is None
