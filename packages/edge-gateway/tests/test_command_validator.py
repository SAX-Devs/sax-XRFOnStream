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
        "args": overrides.get("args", {}),
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
        args={"voltage_kv": 999, "current_ua": 50},
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
        args={"voltage_kv": 30, "current_ua": 100},
    )
    result = validator.validate(cmd)
    assert result.ok is True


def test_missing_expires_at_rejected(validator):
    cmd = _make_valid_command(command_id="cmd-noexp", expires_at="")
    result = validator.validate(cmd)
    assert result.ok is False


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
