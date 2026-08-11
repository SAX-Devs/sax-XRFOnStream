"""Security tests for CommandValidator."""

import hashlib
import hmac
import json
import time
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest

from src.command_validator import CommandPayload, CommandValidator


HMAC_SECRET = b"test-secret-key-for-testing-only"


def _sign_command(payload_dict: dict) -> str:
    """Helper to sign a command payload with HMAC-SHA256."""
    signing_payload = json.dumps(payload_dict, sort_keys=True, separators=(",", ":"))
    return hmac.new(HMAC_SECRET, signing_payload.encode(), hashlib.sha256).hexdigest()


def _make_valid_command(**overrides) -> CommandPayload:
    """Create a valid command payload with correct signature."""
    expires = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
    base = {
        "command_id": overrides.get("command_id", "cmd-001"),
        "module": overrides.get("module", "generator"),
        "command": overrides.get("command", "set_hv_state"),
        # set_hv_state declares one positional arg, so the generic "valid
        # command" used across these tests has to carry it (0 = HV off).
        "args": overrides.get("args", {"arg1": "0"}),
        "expires_at": overrides.get("expires_at", expires),
    }
    signature = overrides.get("signature", _sign_command(base))
    return CommandPayload(
        command_id=base["command_id"],
        module=base["module"],
        command=base["command"],
        args=base["args"],
        expires_at=base["expires_at"],
        signature=signature,
    )


@pytest.fixture
def validator(mock_gateway_config, mock_db_reader):
    with patch("src.command_validator.Path") as mock_path:
        # The key file is hex-encoded text; the validator decodes it to raw bytes.
        mock_path.return_value.read_text.return_value = HMAC_SECRET.hex()
        v = CommandValidator(mock_gateway_config, mock_db_reader)
    mock_db_reader.read_table.return_value = [
        {"name": "critical_flow", "severity": "OK", "message": None},
        {"name": "hermetic", "severity": "OK", "message": None},
        {"name": "air_tank", "severity": "OK", "message": None},
        {"name": "vacuum", "severity": "OK", "message": None},
    ]
    return v


def test_valid_command_passes(validator):
    cmd = _make_valid_command()
    result = validator.validate(cmd)
    assert result.ok is True


def test_invalid_signature_rejected(validator):
    cmd = _make_valid_command(signature="bad_signature_value")
    result = validator.validate(cmd)
    assert result.ok is False
    assert "HMAC" in result.reason


def test_expired_command_rejected(validator):
    expired = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    cmd = _make_valid_command(command_id="cmd-exp", expires_at=expired)
    result = validator.validate(cmd)
    assert result.ok is False
    assert "expired" in result.reason.lower()


def test_unknown_command_rejected(validator):
    cmd = _make_valid_command(command_id="cmd-unk", module="generator", command="self_destruct")
    result = validator.validate(cmd)
    assert result.ok is False
    assert "whitelist" in result.reason.lower()


def test_out_of_range_args_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-range",
        command="set_voltage_and_current",
        args={"arg1": "999", "arg2": "50"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "out of range" in result.reason.lower()


def test_rate_limit_enforced(validator):
    cmd1 = _make_valid_command(command_id="cmd-rl1")
    result1 = validator.validate(cmd1)
    assert result1.ok is True

    cmd2 = _make_valid_command(command_id="cmd-rl2")
    result2 = validator.validate(cmd2)
    assert result2.ok is False
    assert "rate limit" in result2.reason.lower()


def test_sentinel_block(validator, mock_db_reader):
    mock_db_reader.read_table.return_value = [
        {"name": "vacuum", "severity": "CRITICAL", "message": "Vacuum failure"},
    ]
    cmd = _make_valid_command(command_id="cmd-sent")
    result = validator.validate(cmd)
    assert result.ok is False
    assert "Sentinel" in result.reason


def test_replay_attack_blocked(validator):
    cmd1 = _make_valid_command(command_id="cmd-replay")
    result1 = validator.validate(cmd1)
    assert result1.ok is True

    cmd2 = _make_valid_command(command_id="cmd-replay")
    result2 = validator.validate(cmd2)
    assert result2.ok is False
    assert "replay" in result2.reason.lower()


def test_valid_command_with_args_passes(validator):
    cmd = _make_valid_command(
        command_id="cmd-args",
        command="set_voltage_and_current",
        args={"arg1": "30", "arg2": "100"},
    )
    result = validator.validate(cmd)
    assert result.ok is True


def test_missing_expires_at_rejected(validator):
    cmd = _make_valid_command(command_id="cmd-noexp", expires_at="")
    result = validator.validate(cmd)
    assert result.ok is False


def test_cam_interchange_valid_positions(validator):
    for i, position in enumerate(("Chamber", "Recal")):
        cmd = _make_valid_command(
            command_id=f"cmd-cam-{i}",
            module="interchanger",
            command="cam_interchange",
            args={"arg1": position},
        )
        result = validator.validate(cmd)
        assert result.ok is True, result.reason
        # Reset the rate limiter between iterations.
        validator._last_command_times.clear()


def test_cam_interchange_invalid_position_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-cam-bad",
        module="interchanger",
        command="cam_interchange",
        args={"arg1": "Sideways"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "not allowed" in result.reason


def test_cam_interchange_missing_arg_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-cam-noarg",
        module="interchanger",
        command="cam_interchange",
        args={},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "Missing required argument" in result.reason


def test_usage_axial_valid(validator):
    cmd = _make_valid_command(
        command_id="cmd-axial",
        module="interchanger",
        command="usage_axial",
        args={"arg1": "true", "arg2": "5"},
    )
    result = validator.validate(cmd)
    assert result.ok is True, result.reason


def test_usage_rot_valid(validator):
    cmd = _make_valid_command(
        command_id="cmd-rot",
        module="interchanger",
        command="usage_rot",
        args={"arg1": "false", "arg2": "20"},
    )
    result = validator.validate(cmd)
    assert result.ok is True, result.reason


def test_usage_axial_bad_bool_rejected(validator):
    # 'True' (capitalized) is NOT allowed — args travel verbatim and the UI
    # always sends lowercase; anything else is suspicious.
    cmd = _make_valid_command(
        command_id="cmd-axial-bad",
        module="interchanger",
        command="usage_axial",
        args={"arg1": "True", "arg2": "5"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "not allowed" in result.reason


def test_usage_axial_missing_timeout_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-axial-noto",
        module="interchanger",
        command="usage_axial",
        args={"arg1": "true"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "Missing required argument" in result.reason


def test_usage_rot_timeout_out_of_range_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-rot-to",
        module="interchanger",
        command="usage_rot",
        args={"arg1": "true", "arg2": "9999"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "out of range" in result.reason.lower()


def test_lock_control_no_longer_whitelisted(validator):
    # Planned-era command that doesn't exist on the real equipment.
    cmd = _make_valid_command(
        command_id="cmd-lock",
        module="interchanger",
        command="lock_control",
        args={},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "whitelist" in result.reason.lower()


def test_set_operation_mode_valid_modes(validator):
    modes = (
        "Closed",
        "Brine",
        "Water",
        "Recirculation",
        "Purge",
        "Sample_taking",
        "Pump_Cleaning",
    )
    for i, mode in enumerate(modes):
        cmd = _make_valid_command(
            command_id=f"cmd-mode-{i}",
            module="circulation",
            command="set_operation_mode",
            args={"arg1": mode},
        )
        result = validator.validate(cmd)
        assert result.ok is True, f"{mode}: {result.reason}"
        validator._last_command_times.clear()


def test_set_operation_mode_invalid_mode_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-mode-bad",
        module="circulation",
        command="set_operation_mode",
        args={"arg1": "Recirculacion"},  # missing accent handling / wrong name
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "not allowed" in result.reason


def test_tank_percentage_fill_valid(validator):
    cmd = _make_valid_command(
        command_id="cmd-fill",
        module="circulation",
        command="tank_percentage_fill",
        args={"arg1": "25"},
    )
    result = validator.validate(cmd)
    assert result.ok is True, result.reason


def test_tank_percentage_fill_out_of_range_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-fill-bad",
        module="circulation",
        command="tank_percentage_fill",
        args={"arg1": "150"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "out of range" in result.reason.lower()


def test_tank_percentage_fill_missing_arg_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-fill-noarg",
        module="circulation",
        command="tank_percentage_fill",
        args={},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "Missing required argument" in result.reason


def test_empty_tank_valid_without_args(validator):
    cmd = _make_valid_command(
        command_id="cmd-empty",
        module="circulation",
        command="empty_tank",
        args={},
    )
    result = validator.validate(cmd)
    assert result.ok is True, result.reason


def test_empty_tank_with_args_rejected(validator):
    # python_data_type is {None}: the equipment's transformer raises on any
    # argument, so the gateway must refuse instead of causing a task error.
    cmd = _make_valid_command(
        command_id="cmd-empty-args",
        module="circulation",
        command="empty_tank",
        args={"arg1": "50"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "takes no arguments" in result.reason


def test_circulation_planned_era_commands_rejected(validator):
    # pump_control/valve_control never existed on the equipment.
    for i, command in enumerate(("pump_control", "valve_control")):
        cmd = _make_valid_command(
            command_id=f"cmd-planned-{i}",
            module="circulation",
            command=command,
            args={},
        )
        result = validator.validate(cmd)
        assert result.ok is False
        assert "whitelist" in result.reason.lower()


def test_cancel_of_cancellable_task_allowed(validator):
    cmd = _make_valid_command(
        command_id="cmd-cancel",
        module="circulation",
        command="cancel",
        args={"arg1": "tank_percentage_fill"},
    )
    result = validator.validate(cmd)
    assert result.ok is True, result.reason


def test_cancel_of_non_cancellable_task_rejected(validator):
    # empty_tank has no cancel_event parameter: the daemon would set the event,
    # let the task run to completion and then mislabel it "cancelled".
    cmd = _make_valid_command(
        command_id="cmd-cancel-bad",
        module="circulation",
        command="cancel",
        args={"arg1": "empty_tank"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "not allowed" in result.reason


def test_cancel_without_target_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-cancel-noarg",
        module="circulation",
        command="cancel",
        args={},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "Missing required argument" in result.reason


def test_cancel_not_allowed_on_interchanger(validator):
    # None of the interchanger's operator tasks are cancellable, so the module
    # doesn't whitelist 'cancel' at all.
    cmd = _make_valid_command(
        command_id="cmd-cancel-inter",
        module="interchanger",
        command="cancel",
        args={"arg1": "cam_interchange"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "whitelist" in result.reason.lower()


def test_set_atmospheric_condition_valid_values(validator):
    for i, status in enumerate(
        ("Atmospheric", "Vacuum", "Purge", "Clean", "Closed")
    ):
        cmd = _make_valid_command(
            command_id=f"cmd-atm-{i}",
            module="vacuum",
            command="set_atmospheric_condition",
            args={"arg1": status},
        )
        result = validator.validate(cmd)
        assert result.ok is True, f"{status}: {result.reason}"
        validator._last_command_times.clear()


def test_set_atmospheric_condition_invalid_value_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-atm-bad",
        module="vacuum",
        command="set_atmospheric_condition",
        args={"arg1": "Vacio"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "not allowed" in result.reason


def test_emergency_purge_valid_without_args(validator):
    cmd = _make_valid_command(
        command_id="cmd-purge",
        module="vacuum",
        command="emergency_purge",
        args={},
    )
    result = validator.validate(cmd)
    assert result.ok is True, result.reason


def test_emergency_purge_with_args_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-purge-args",
        module="vacuum",
        command="emergency_purge",
        args={"arg1": "Clean"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "takes no arguments" in result.reason


def test_vacuum_planned_era_commands_rejected(validator):
    for i, command in enumerate(("pump_control", "valve_control")):
        cmd = _make_valid_command(
            command_id=f"cmd-vac-planned-{i}",
            module="vacuum",
            command=command,
            args={},
        )
        result = validator.validate(cmd)
        assert result.ok is False
        assert "whitelist" in result.reason.lower()


def test_set_hv_state_valid_values(validator):
    for i, state in enumerate(("0", "1")):
        cmd = _make_valid_command(
            command_id=f"cmd-hv-{i}",
            module="generator",
            command="set_hv_state",
            args={"arg1": state},
        )
        result = validator.validate(cmd)
        assert result.ok is True, f"{state}: {result.reason}"
        validator._last_command_times.clear()


def test_set_hv_state_invalid_value_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-hv-bad",
        module="generator",
        command="set_hv_state",
        args={"arg1": "true"},  # the equipment wants an int, not a bool string
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "not allowed" in result.reason


def test_standby_valid_without_args(validator):
    cmd = _make_valid_command(
        command_id="cmd-standby",
        module="generator",
        command="standby",
        args={},
    )
    result = validator.validate(cmd)
    assert result.ok is True, result.reason


def test_standby_with_args_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-standby-args",
        module="generator",
        command="standby",
        args={"arg1": "20"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "takes no arguments" in result.reason


def test_set_voltage_within_range(validator):
    cmd = _make_valid_command(
        command_id="cmd-kv",
        module="generator",
        command="set_voltage",
        args={"arg1": "20"},
    )
    result = validator.validate(cmd)
    assert result.ok is True, result.reason


def test_set_voltage_above_max_rejected(validator):
    # MAX_VOLTAGE on the equipment is 50 kV.
    cmd = _make_valid_command(
        command_id="cmd-kv-bad",
        module="generator",
        command="set_voltage",
        args={"arg1": "60"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "out of range" in result.reason.lower()


def test_set_current_bounded_below_equipment_max(validator):
    # The equipment's MAX_CURRENT is 2000 uA, but set_current has no power
    # guard, so the gateway caps it at the current that respects MAX_POWER
    # even at MAX_VOLTAGE (50 W / 50 kV = 1000 uA).
    ok = _make_valid_command(
        command_id="cmd-ua-ok",
        module="generator",
        command="set_current",
        args={"arg1": "1000"},
    )
    assert validator.validate(ok).ok is True
    validator._last_command_times.clear()

    too_high = _make_valid_command(
        command_id="cmd-ua-bad",
        module="generator",
        command="set_current",
        args={"arg1": "1500"},
    )
    result = validator.validate(too_high)
    assert result.ok is False
    assert "out of range" in result.reason.lower()


def test_set_voltage_and_current_range_is_actually_enforced(validator):
    # Regression: the range for this command used to be keyed by
    # "voltage_kv"/"current_ua", names the positional protocol never sends, so
    # the check silently never ran and any value passed.
    cmd = _make_valid_command(
        command_id="cmd-kvua-bad",
        module="generator",
        command="set_voltage_and_current",
        args={"arg1": "999", "arg2": "100"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "out of range" in result.reason.lower()


def test_set_voltage_and_current_accepts_full_current_range(validator):
    # Unlike set_current, here the equipment clamps power itself.
    cmd = _make_valid_command(
        command_id="cmd-kvua-ok",
        module="generator",
        command="set_voltage_and_current",
        args={"arg1": "20", "arg2": "2000"},
    )
    result = validator.validate(cmd)
    assert result.ok is True, result.reason


def test_set_voltage_and_current_missing_second_arg_rejected(validator):
    cmd = _make_valid_command(
        command_id="cmd-kvua-noarg",
        module="generator",
        command="set_voltage_and_current",
        args={"arg1": "20"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "Missing required argument" in result.reason


def test_generator_power_not_whitelisted_for_cloud(validator):
    # Cutting the supply is a service action, not an operator one.
    cmd = _make_valid_command(
        command_id="cmd-power",
        module="generator",
        command="power",
        args={"arg1": "false"},
    )
    result = validator.validate(cmd)
    assert result.ok is False
    assert "whitelist" in result.reason.lower()


def test_sentinel_ok_allows_command(validator, mock_db_reader):
    mock_db_reader.read_table.return_value = [
        {"name": "critical_flow", "severity": "OK", "message": None},
        {"name": "hermetic", "severity": "OK", "message": None},
        {"name": "air_tank", "severity": "OK", "message": None},
        {"name": "vacuum", "severity": "OK", "message": None},
    ]
    cmd = _make_valid_command(command_id="cmd-sentinel-ok")
    result = validator.validate(cmd)
    assert result.ok is True
