"""Command validation pipeline — 7 security checks before execution."""

import hashlib
import hmac
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from src.config import GatewayConfig
from src.db_reader import DbReader

logger = logging.getLogger("edge-gateway.command-validator")

COMMAND_WHITELIST: dict[str, list[str]] = {
    # Reconciled with the real generator_action catalog. The full service
    # subset (SAX-defined 2026-08-19); role separation happens in the cloud
    # Route Handler — operators only reach the first five, service reaches
    # all. The whitelist is the catalog of anything the cloud may ever send.
    "generator": [
        "set_hv_state",
        "standby",
        "set_voltage",
        "set_current",
        "set_voltage_and_current",
        "power",
        "set_hv_state_service",
        "reset_faults",
        "set_filament_current_limit",
        "set_filament_preheat",
        "set_filament_ramp_time",
    ],
    # Reconciled with the real vacuum_action catalog (operator subset). The
    # previous pump_control/valve_control were planned-era names; the real
    # tasks are open_valve, close_valve, pump_switch, emergency_purge,
    # get_vaccum_pressure, rele_test, status, set_atmospheric_condition.
    # Operator: set_atmospheric_condition, emergency_purge. Service adds
    # individual valve/pump control. Role separation is enforced in the cloud
    # Route Handler; the whitelist is the union of anything the cloud may send.
    "vacuum": [
        "set_atmospheric_condition",
        "emergency_purge",
        "open_valve",
        "close_valve",
        "pump_switch",
    ],
    # Reconciled with the real circulation_action catalog (operator subset).
    # The previous entries (pump_control/valve_control) were planned-era names
    # that don't exist on the equipment — the real tasks are set_pump_state,
    # set_valve_state, set_operation_mode, tank_percentage_fill, empty_tank…
    # "cancel" is not a task: the CommandDaemon intercepts it and signals the
    # cancel_event of the task named in arg1 (see ARGUMENT_ENUMS).
    # Operator: set_operation_mode, tank_percentage_fill, empty_tank, cancel.
    # Service adds direct pump/valve/led/power control. Role separation is in
    # the cloud Route Handler; the whitelist is the union.
    "circulation": [
        "set_operation_mode",
        "tank_percentage_fill",
        "empty_tank",
        "cancel",
        "set_pump_state",
        "set_valve_state",
        "led_status",
        "emergency_stop",
        "power",
    ],
    # Reconciled with the real interchanger_action catalog (operator subset).
    # The equipment declares python_data_type per task: cam_interchange {str},
    # usage_axial/usage_rot {bool,int} — see ARGUMENT_ENUMS/REQUIRED_ARGS.
    "interchanger": ["cam_interchange", "usage_axial", "usage_rot"],
    "detector": ["set_detector", "set_gain", "set_threshold"],
    "temp_control": ["set_target_temperature", "valve_control"],
    "auxiliary": ["battery_test"],
}

# Ranges are keyed by the POSITIONAL argument name the protocol actually uses
# (arg1..arg5 of the equipment's `command` table). The previous
# set_voltage_and_current entry was keyed by "voltage_kv"/"current_ua", names
# that are never sent, so that check silently never ran.
ARGUMENT_RANGES: dict[str, dict[str, tuple[float, float]]] = {
    # Generator limits read from the equipment's GENERATOR_CONFIG:
    # MAX_VOLTAGE=50 kV, MAX_CURRENT=2000 uA, MAX_POWER=50 W.
    "set_voltage": {
        "arg1": (0, 50),
    },
    # set_current has no power guard of its own (only set_voltage_and_current
    # clamps power), so it is bounded to the current that respects MAX_POWER
    # even at MAX_VOLTAGE: 50 W / 50 kV = 1000 uA.
    "set_current": {
        "arg1": (0, 1000),
    },
    # Here the equipment clamps the pair to MAX_POWER itself, so the full
    # current range is safe.
    "set_voltage_and_current": {
        "arg1": (0, 50),
        "arg2": (0, 2000),
    },
    # Filament limits from the equipment's GENERATOR_CONFIG:
    # MAX_FIL_CURRENT=3500 mA, MAX_FIL_PREHEAT=2000 mA.
    "set_filament_current_limit": {
        "arg1": (0, 3500),
    },
    "set_filament_preheat": {
        "arg1": (0, 2000),
    },
    # arg2 = ramp time in ms (generator command "47" accepts 0-10000). The
    # coupled rule (disable→0, enable→>0) is enforced by the equipment itself.
    "set_filament_ramp_time": {
        "arg2": (0, 10000),
    },
    "set_target_temperature": {
        "temperature_c": (15, 35),
    },
    "set_gain": {
        "gain": (0.1, 10.0),
    },
    "set_threshold": {
        "threshold": (1, 1000),
    },
    # arg2 = task timeout in seconds (equipment defaults: axial 5, rot 20).
    "usage_axial": {
        "arg2": (1, 30),
    },
    "usage_rot": {
        "arg2": (1, 60),
    },
    # Relative amount to add to the tank level; the equipment itself rejects
    # anything outside 0-100 (as a silent no-op), so bound it here.
    "tank_percentage_fill": {
        "arg1": (0, 100),
    },
}

# Enum-valued positional args, sent verbatim to the equipment's command table.
# Booleans must be the strings 'true'/'false' (the CommandDaemon's
# DataTransformer accepts them case-insensitively); cam_interchange takes the
# literal position names (case-sensitive on the equipment side).
ARGUMENT_ENUMS: dict[str, dict[str, tuple[str, ...]]] = {
    "cam_interchange": {"arg1": ("Chamber", "Recal")},
    "usage_axial": {"arg1": ("true", "false")},
    "usage_rot": {"arg1": ("true", "false")},
    # Cancellation only really interrupts tasks whose signature declares
    # cancel_event/stop_event — the daemon inspects it (_get_cancel_kwargs).
    # For any other task the event is set but the function runs to completion
    # and is then mislabelled "cancelled", so only the genuinely cancellable
    # task may be targeted. Verified on the equipment: of the operator set,
    # only tank_percentage_fill takes cancel_event.
    "cancel": {"arg1": ("tank_percentage_fill",)},
    # set_hv_state(state: int): 1 = radiate, 0 = stop. The equipment itself
    # refuses to turn HV on unless the door and chamber locks are engaged.
    "set_hv_state": {"arg1": ("0", "1")},
    # The service variant SKIPS that interlock check (maintenance bypass).
    "set_hv_state_service": {"arg1": ("0", "1")},
    # Vacuum individual valve control — the three real valves.
    "open_valve": {"arg1": ("INLET_VALVE", "OUTLET_VALVE", "PURGE_VALVE")},
    "close_valve": {"arg1": ("INLET_VALVE", "OUTLET_VALVE", "PURGE_VALVE")},
    # pump_switch(pump_1: bool, pump_2: bool).
    "pump_switch": {"arg1": ("true", "false"), "arg2": ("true", "false")},
    # Circulation direct control.
    "set_pump_state": {"arg1": ("FORWARD", "REVERSE", "STOP")},
    "set_valve_state": {
        "arg1": (
            "BRINE_IN_VALVE",
            "WATER_IN_VALVE",
            "OUT_VALVE",
            "RECIRCULATION_IN_VALVE",
            "RECIRCULATION_OUT_VALVE",
            "BYPASS_VALVE",
        ),
        "arg2": ("true", "false"),
    },
    "led_status": {"arg1": ("true", "false")},
    # power(on_state: bool) — the generator's 24V supply relay.
    "power": {"arg1": ("true", "false")},
    # set_filament_ramp_time(enable: 0/1, ramp_time_ms).
    "set_filament_ramp_time": {"arg1": ("0", "1")},
    # The 5 branches of Vacuum.set_atmospheric_condition; anything else hits
    # the final else and raises ValueError("Unknown status") on the equipment.
    "set_atmospheric_condition": {
        "arg1": ("Atmospheric", "Vacuum", "Purge", "Clean", "Closed")
    },
    # The 7 branches of Circulation.set_operation_mode; any other value falls
    # through every branch and silently does nothing.
    "set_operation_mode": {
        "arg1": (
            "Closed",
            "Brine",
            "Water",
            "Recirculation",
            "Purge",
            "Sample_taking",
            "Pump_Cleaning",
        )
    },
}

# The equipment's DataTransformer raises when the arg count doesn't match the
# task's declared python_data_type, so missing args must be rejected here
# instead of failing (as a task error) on the equipment.
REQUIRED_ARGS: dict[str, tuple[str, ...]] = {
    "cam_interchange": ("arg1",),
    "usage_axial": ("arg1", "arg2"),
    "usage_rot": ("arg1", "arg2"),
    "set_operation_mode": ("arg1",),
    "set_atmospheric_condition": ("arg1",),
    "tank_percentage_fill": ("arg1",),
    "cancel": ("arg1",),
    "set_hv_state": ("arg1",),
    "set_hv_state_service": ("arg1",),
    "power": ("arg1",),
    "set_voltage": ("arg1",),
    "set_current": ("arg1",),
    "set_voltage_and_current": ("arg1", "arg2"),
    "set_filament_current_limit": ("arg1",),
    "set_filament_preheat": ("arg1",),
    "set_filament_ramp_time": ("arg1", "arg2"),
    "open_valve": ("arg1",),
    "close_valve": ("arg1",),
    "pump_switch": ("arg1", "arg2"),
    "set_pump_state": ("arg1",),
    "set_valve_state": ("arg1", "arg2"),
    "led_status": ("arg1",),
}

# Tasks whose declared python_data_type is {None}: the equipment's transformer
# raises on ANY argument, so reject commands that carry one.
NO_ARG_COMMANDS: dict[str, tuple[str, ...]] = {
    "circulation": ("empty_tank", "emergency_stop"),
    "vacuum": ("emergency_purge",),
    "generator": ("standby", "reset_faults"),
}

RATE_LIMITS: dict[tuple[str, str], float] = {
    ("generator", "set_hv_state"): 5.0,
    ("generator", "set_hv_state_service"): 5.0,
    ("generator", "set_voltage_and_current"): 3.0,
    ("generator", "set_voltage"): 3.0,
    ("generator", "set_current"): 3.0,
    ("generator", "standby"): 10.0,
    ("generator", "power"): 10.0,
    ("generator", "reset_faults"): 5.0,
    ("generator", "set_filament_current_limit"): 3.0,
    ("generator", "set_filament_preheat"): 3.0,
    ("generator", "set_filament_ramp_time"): 3.0,
    # Reaching Vacuum waits ~35s for a pressure target; re-firing meanwhile is
    # always a mistake. The emergency purge runs a ~15s valve sequence.
    ("vacuum", "set_atmospheric_condition"): 10.0,
    ("vacuum", "emergency_purge"): 20.0,
    ("vacuum", "open_valve"): 2.0,
    ("vacuum", "close_valve"): 2.0,
    ("vacuum", "pump_switch"): 5.0,
    ("interchanger", "cam_interchange"): 10.0,
    ("interchanger", "usage_axial"): 5.0,
    ("interchanger", "usage_rot"): 5.0,
    # Mode changes actuate five valves + the pump; the tank actions run for
    # minutes, so re-firing them quickly is always a mistake.
    ("circulation", "set_pump_state"): 3.0,
    ("circulation", "set_valve_state"): 2.0,
    ("circulation", "led_status"): 2.0,
    ("circulation", "emergency_stop"): 5.0,
    ("circulation", "power"): 10.0,
    ("circulation", "set_operation_mode"): 5.0,
    ("circulation", "tank_percentage_fill"): 15.0,
    ("circulation", "empty_tank"): 15.0,
    # Stopping something must stay responsive — just enough to absorb a
    # double-click.
    ("circulation", "cancel"): 2.0,
}

SENTINEL_BLOCKING_RULES: dict[str, list[str]] = {
    "critical_flow": ["generator"],
    "hermetic": ["interchanger"],
    "air_tank": ["interchanger", "vacuum"],
    "vacuum": ["generator"],
}


@dataclass
class CommandPayload:
    command_id: str
    module: str
    command: str
    args: dict = field(default_factory=dict)
    expires_at: str = ""
    signature: str = ""
    issued_by: str = ""
    issued_by_email: str = ""
    issued_by_role: str = ""

    @classmethod
    def from_json(cls, data: bytes) -> "CommandPayload":
        d = json.loads(data)
        return cls(
            command_id=d["command_id"],
            module=d["module"],
            command=d["command"],
            args=d.get("args", {}),
            expires_at=d.get("expires_at", ""),
            signature=d.get("signature", ""),
            issued_by=d.get("issued_by", ""),
            issued_by_email=d.get("issued_by_email", ""),
            issued_by_role=d.get("issued_by_role", ""),
        )


@dataclass
class ValidationResult:
    ok: bool
    reason: str = ""


class CommandValidator:
    def __init__(self, config: GatewayConfig, db_reader: DbReader) -> None:
        self._config = config
        self._db = db_reader
        # The HMAC key is stored hex-encoded (text) and shared with the cloud
        # Route Handler, which signs with the same raw bytes (Buffer.from(hex)).
        self._hmac_secret = bytes.fromhex(
            Path(config.hmac_secret_path).read_text().strip()
        )
        self._seen_command_ids: set[str] = set()
        self._last_command_times: dict[tuple[str, str], float] = {}

    def validate(self, command: CommandPayload) -> ValidationResult:
        """Run all validation checks in order. Return on first failure."""
        checks = [
            self._check_signature,
            self._check_expiration,
            self._check_replay,
            self._check_whitelist,
            self._check_required_args,
            self._check_argument_enums,
            self._check_argument_ranges,
            self._check_rate_limit,
            self._check_sentinel_conditions,
        ]
        for check in checks:
            result = check(command)
            if not result.ok:
                logger.warning(f"Command {command.command_id} rejected: {result.reason}")
                return result
        return ValidationResult(ok=True)

    def _check_signature(self, command: CommandPayload) -> ValidationResult:
        """Verify HMAC-SHA256 signature."""
        signing_payload = json.dumps({
            "command_id": command.command_id,
            "module": command.module,
            "command": command.command,
            "args": command.args,
            "expires_at": command.expires_at,
        }, sort_keys=True, separators=(",", ":"))

        expected = hmac.new(
            self._hmac_secret,
            signing_payload.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, command.signature):
            return ValidationResult(ok=False, reason="Invalid HMAC signature")
        return ValidationResult(ok=True)

    def _check_expiration(self, command: CommandPayload) -> ValidationResult:
        """Check if command has expired."""
        try:
            expires = datetime.fromisoformat(command.expires_at.replace("Z", "+00:00"))
            if expires < datetime.now(timezone.utc):
                return ValidationResult(ok=False, reason=f"Command expired at {command.expires_at}")
        except (ValueError, AttributeError):
            return ValidationResult(ok=False, reason="Invalid or missing expires_at")
        return ValidationResult(ok=True)

    def _check_replay(self, command: CommandPayload) -> ValidationResult:
        """Block duplicate command IDs."""
        if command.command_id in self._seen_command_ids:
            return ValidationResult(ok=False, reason=f"Replay attack: command_id {command.command_id} already seen")
        self._seen_command_ids.add(command.command_id)
        if len(self._seen_command_ids) > 10000:
            oldest = list(self._seen_command_ids)[:5000]
            self._seen_command_ids -= set(oldest)
        return ValidationResult(ok=True)

    def _check_whitelist(self, command: CommandPayload) -> ValidationResult:
        """Verify module+command is in the allowed list."""
        allowed = COMMAND_WHITELIST.get(command.module, [])
        if command.command not in allowed:
            return ValidationResult(
                ok=False,
                reason=f"Command {command.module}.{command.command} not in whitelist",
            )
        return ValidationResult(ok=True)

    def _check_required_args(self, command: CommandPayload) -> ValidationResult:
        """Reject commands whose args don't match what the task declares."""
        if command.command in NO_ARG_COMMANDS.get(command.module, ()):
            supplied = [
                name
                for name, value in command.args.items()
                if value is not None and str(value) != ""
            ]
            if supplied:
                return ValidationResult(
                    ok=False,
                    reason=(
                        f"{command.command} takes no arguments, got {supplied}"
                    ),
                )
            return ValidationResult(ok=True)

        required = REQUIRED_ARGS.get(command.command, ())
        for arg_name in required:
            value = command.args.get(arg_name)
            if value is None or str(value) == "":
                return ValidationResult(
                    ok=False,
                    reason=f"Missing required argument {arg_name} for {command.command}",
                )
        return ValidationResult(ok=True)

    def _check_argument_enums(self, command: CommandPayload) -> ValidationResult:
        """Validate enum-valued args against their exact allowed values."""
        enums = ARGUMENT_ENUMS.get(command.command)
        if not enums:
            return ValidationResult(ok=True)

        for arg_name, allowed in enums.items():
            if arg_name in command.args:
                value = str(command.args[arg_name])
                if value not in allowed:
                    return ValidationResult(
                        ok=False,
                        reason=(
                            f"Argument {arg_name}='{value}' not allowed for "
                            f"{command.command} (expected one of {list(allowed)})"
                        ),
                    )
        return ValidationResult(ok=True)

    def _check_argument_ranges(self, command: CommandPayload) -> ValidationResult:
        """Validate argument values are within safe ranges."""
        ranges = ARGUMENT_RANGES.get(command.command)
        if not ranges:
            return ValidationResult(ok=True)

        for arg_name, (min_val, max_val) in ranges.items():
            if arg_name in command.args:
                try:
                    val = float(command.args[arg_name])
                    if not (min_val <= val <= max_val):
                        return ValidationResult(
                            ok=False,
                            reason=f"Argument {arg_name}={val} out of range [{min_val}, {max_val}]",
                        )
                except (ValueError, TypeError):
                    return ValidationResult(ok=False, reason=f"Invalid value for argument {arg_name}")
        return ValidationResult(ok=True)

    def _check_rate_limit(self, command: CommandPayload) -> ValidationResult:
        """Enforce rate limiting per module+command."""
        key = (command.module, command.command)
        limit_seconds = RATE_LIMITS.get(key)
        if limit_seconds is None:
            return ValidationResult(ok=True)

        now = time.monotonic()
        last_time = self._last_command_times.get(key, 0)
        if now - last_time < limit_seconds:
            remaining = limit_seconds - (now - last_time)
            return ValidationResult(
                ok=False,
                reason=f"Rate limit: {command.module}.{command.command} — wait {remaining:.1f}s",
            )
        self._last_command_times[key] = now
        return ValidationResult(ok=True)

    def _check_sentinel_conditions(self, command: CommandPayload) -> ValidationResult:
        """Read validations_sentinel and block if critical conditions exist."""
        try:
            rows = self._db.read_table("validations_sentinel")
        except Exception:
            logger.warning("Could not read validations_sentinel, allowing command")
            return ValidationResult(ok=True)

        for row in rows:
            name = row.get("name", "")
            severity = row.get("severity", "OK")
            if severity not in ("OK",) and command.module in SENTINEL_BLOCKING_RULES.get(name, []):
                return ValidationResult(
                    ok=False,
                    reason=f"Sentinel: {name} = {severity} — {row.get('message', '')}",
                )
        return ValidationResult(ok=True)
