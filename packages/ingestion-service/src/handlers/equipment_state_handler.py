"""Upserts the inferred equipment state into ``device_equipment_state``.

Also handles the MQTT Last Will payload ``{"status":"offline"}``, which the
Pydantic model normalises to ``state="offline"``.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from src.handlers.base import Handler
from src.models import EquipmentStatePayload
from src.topic_router import ParsedTopic

logger = logging.getLogger("ingestion-service.equipment-state")


class EquipmentStateHandler(Handler):
    def handle(self, parsed: ParsedTopic, payload: bytes) -> None:
        data = EquipmentStatePayload.model_validate_json(payload)
        device_ts = (data.ts or datetime.now(timezone.utc)).isoformat()

        row = {
            "device_id": parsed.device_id,
            "tenant_id": parsed.tenant_id,
            "state": data.state,
            "detail": data.detail,
            "device_ts": device_ts,
            "received_at": datetime.now(timezone.utc).isoformat(),
        }
        self.ctx.writer.upsert("device_equipment_state", row, on_conflict="device_id")

        if data.state != "offline":
            self.ctx.writer.update_last_seen(parsed.device_id)
