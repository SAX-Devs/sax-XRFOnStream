"""Pydantic models for every MQTT payload the Ingestion Service consumes.

Each model is a 1-to-1 mirror of what the corresponding Edge Gateway publisher
emits. Validation happens in the handlers; an invalid payload is logged at
WARNING level and dropped (it never crashes the dispatch loop).

Reference publishers in ``packages/edge-gateway/src/``:
- telemetry_publisher.py
- spectra_uploader.py
- concentrations_publisher.py
- sentinel_publisher.py
- equipment_state_publisher.py
- command_receiver.py    (publishes ACK)
- result_reporter.py     (publishes result)

The Edge Gateway also publishes a Last Will message ``{"status": "offline"}``
to the equipment_state topic; ``EquipmentStatePayload`` translates that shape
into a normal state="offline" record so the rest of the pipeline stays simple.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class _PayloadBase(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


# --- Telemetry --------------------------------------------------------------


class TelemetryPayload(_PayloadBase):
    device_id: str
    module: str
    ts: datetime
    data: dict[str, Any]


# --- Spectra ----------------------------------------------------------------


class SpectraPayload(_PayloadBase):
    device_id: str
    ts: datetime
    measurement_id: str = ""
    spectra_data: Any = None
    run_data: Any = None


# --- Concentrations ---------------------------------------------------------


class ConcentrationsPayload(_PayloadBase):
    device_id: str
    ts: datetime
    measurement_id: str = ""
    elements: dict[str, float] = Field(default_factory=dict)
    unit: str = "g/L"


# --- Alerts / Sentinel ------------------------------------------------------


class SentinelAlertItem(_PayloadBase):
    name: str
    severity: str
    message: str | None = None
    updated_at: str | None = None


class SentinelPayload(_PayloadBase):
    device_id: str
    ts: datetime
    source: str = "sentinel"
    alerts: list[SentinelAlertItem] = Field(default_factory=list)


# --- Equipment state --------------------------------------------------------


_VALID_EQUIPMENT_STATES = {
    "unknown", "idle", "measuring", "initializing",
    "standby", "error", "offline",
}


class EquipmentStatePayload(_PayloadBase):
    device_id: str = ""
    ts: datetime | None = None
    state: str = "unknown"
    detail: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def _translate_lwt(cls, data: Any) -> Any:
        """Translate the MQTT Last Will payload ``{"status": "offline"}``.

        The Edge Gateway sets ``{"status":"offline"}`` as a retained Last Will
        on the equipment_state topic. That shape doesn't match the normal
        publisher payload, so we normalise it here. Also accepts ``status``
        as an alias of ``state`` for forward-compat.
        """
        if not isinstance(data, dict):
            return data
        if "state" not in data and "status" in data:
            data = dict(data)
            data["state"] = data.pop("status")
        return data

    @model_validator(mode="after")
    def _coerce_unknown_state(self) -> "EquipmentStatePayload":
        if self.state not in _VALID_EQUIPMENT_STATES:
            self.state = "unknown"
        return self


# --- Command audit ----------------------------------------------------------


class CommandAckPayload(_PayloadBase):
    command_id: str
    module: str = ""
    command: str = ""
    status: Literal["ack"] = "ack"
    ack_at: datetime


class CommandResultPayload(_PayloadBase):
    command_id: str
    module: str = ""
    command: str = ""
    status: Literal["completed", "error", "rejected"]
    error_message: str | None = None
    completed_at: datetime
