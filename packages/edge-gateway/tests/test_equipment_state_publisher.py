"""Tests for EquipmentStatePublisher (state inference + change detection)."""

import json

from src.equipment_state_publisher import EquipmentStatePublisher

TANK_LOW = {
    "module_name": "auxiliary",
    "validation_name": "auxiliary_tank_pressure_low",
    "severity": "alarm",
    "message": "Alarm: The tank pressure is too low.",
}
TANK_HIGH_WARN = {
    "module_name": "auxiliary",
    "validation_name": "auxiliary_tank_pressure_high",
    "severity": "warning",
    "message": "Warning: The tank pressure is too high.",
}
LEAK_OK = {
    "module_name": "circulation",
    "validation_name": "circulation_analyzer_chamber_leaking_or_blocked",
    "severity": "OK",
    "message": "OK",
}
MEASURE_TASK = {"module_name": "detector", "task_id": 7, "task_name": "measure_routine"}


def _publisher(mock_gateway_config, mock_mqtt_client, mock_db_reader, *, sentinel, tasks=None, generator=None):
    # The lists are shared with the caller on purpose: tests mutate them
    # between ticks to simulate the equipment changing.
    tables = {"sp_sentinel_view()": sentinel, "current_busy_tasks": tasks if tasks is not None else []}
    mock_db_reader.read_table.side_effect = lambda name: tables[name]
    mock_db_reader.read_single_row.side_effect = lambda name: generator if name == "generator_status" else None
    mock_mqtt_client.connection_generation = 1
    return EquipmentStatePublisher(mock_gateway_config, mock_mqtt_client, mock_db_reader)


def test_measuring_wins_over_active_alarm(mock_gateway_config, mock_mqtt_client, mock_db_reader):
    """2026-09-29 incident: a fouled tank-pressure sensor kept the dashboard on
    ERROR for a day while the equipment measured normally. Activity must win;
    the alarm travels in detail.alerts."""
    pub = _publisher(mock_gateway_config, mock_mqtt_client, mock_db_reader,
                     sentinel=[TANK_LOW, LEAK_OK], tasks=[MEASURE_TASK])

    state, detail = pub.infer_state()

    assert state == "measuring"
    assert detail["alerts"] == [{"name": "auxiliary_tank_pressure_low", "severity": "alarm"}]
    assert detail["active_tasks"] == ["measure_routine"]


def test_error_only_when_idle_with_alarm(mock_gateway_config, mock_mqtt_client, mock_db_reader):
    pub = _publisher(mock_gateway_config, mock_mqtt_client, mock_db_reader,
                     sentinel=[TANK_LOW], generator={"hv_on": False})

    state, detail = pub.infer_state()

    assert state == "error"
    assert detail == {"alerts": [{"name": "auxiliary_tank_pressure_low", "severity": "alarm"}]}


def test_warning_alone_is_not_an_error(mock_gateway_config, mock_mqtt_client, mock_db_reader):
    pub = _publisher(mock_gateway_config, mock_mqtt_client, mock_db_reader,
                     sentinel=[TANK_HIGH_WARN, LEAK_OK])

    state, detail = pub.infer_state()

    assert state == "idle"
    assert detail["alerts"] == [{"name": "auxiliary_tank_pressure_high", "severity": "warning"}]


def test_standby_keeps_alerts(mock_gateway_config, mock_mqtt_client, mock_db_reader):
    pub = _publisher(mock_gateway_config, mock_mqtt_client, mock_db_reader,
                     sentinel=[TANK_LOW], generator={"hv_on": True})

    state, detail = pub.infer_state()

    assert state == "standby"
    assert detail["hv_on"] is True
    assert detail["alerts"][0]["name"] == "auxiliary_tank_pressure_low"


def test_healthy_idle_has_empty_alerts(mock_gateway_config, mock_mqtt_client, mock_db_reader):
    pub = _publisher(mock_gateway_config, mock_mqtt_client, mock_db_reader, sentinel=[LEAK_OK])

    assert pub.infer_state() == ("idle", {"alerts": []})


def test_unknown_when_sentinel_unreadable(mock_gateway_config, mock_mqtt_client, mock_db_reader):
    pub = _publisher(mock_gateway_config, mock_mqtt_client, mock_db_reader, sentinel=[], tasks=[MEASURE_TASK])
    mock_db_reader.read_table.side_effect = RuntimeError("function sp_sentinel_view() does not exist")

    assert pub.infer_state() == ("unknown", {})


def test_republishes_when_alerts_change_within_same_state(mock_gateway_config, mock_mqtt_client, mock_db_reader):
    """An alarm tripping mid-measurement must reach the dashboard even though
    the state string stays "measuring"."""
    sentinel = [LEAK_OK]
    pub = _publisher(mock_gateway_config, mock_mqtt_client, mock_db_reader,
                     sentinel=sentinel, tasks=[MEASURE_TASK])

    pub.publish_if_changed()
    assert mock_mqtt_client.publish.call_count == 1

    sentinel.append(TANK_LOW)
    pub.publish_if_changed()
    assert mock_mqtt_client.publish.call_count == 2

    payload = json.loads(mock_mqtt_client.publish.call_args[0][1])
    assert payload["state"] == "measuring"
    assert payload["detail"]["alerts"] == [{"name": "auxiliary_tank_pressure_low", "severity": "alarm"}]
    assert mock_mqtt_client.publish.call_args.kwargs["retain"] is True

    pub.publish_if_changed()
    assert mock_mqtt_client.publish.call_count == 2, "unchanged state+alerts must not republish"


def test_active_tasks_churn_does_not_republish(mock_gateway_config, mock_mqtt_client, mock_db_reader):
    tasks = [dict(MEASURE_TASK)]
    pub = _publisher(mock_gateway_config, mock_mqtt_client, mock_db_reader, sentinel=[], tasks=tasks)

    pub.publish_if_changed()
    tasks.append({"module_name": "circulation", "task_id": 8, "task_name": "measure_fill"})
    pub.publish_if_changed()

    assert mock_mqtt_client.publish.call_count == 1


def test_reconnect_forces_republish(mock_gateway_config, mock_mqtt_client, mock_db_reader):
    pub = _publisher(mock_gateway_config, mock_mqtt_client, mock_db_reader, sentinel=[TANK_LOW])

    pub.publish_if_changed()
    pub.publish_if_changed()
    assert mock_mqtt_client.publish.call_count == 1

    mock_mqtt_client.connection_generation = 2
    pub.publish_if_changed()
    assert mock_mqtt_client.publish.call_count == 2
