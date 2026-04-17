"""Persists element concentrations into ``device_concentrations`` (DEP-01)."""

from __future__ import annotations

import logging

from src.handlers.base import Handler
from src.models import ConcentrationsPayload
from src.topic_router import ParsedTopic

logger = logging.getLogger("ingestion-service.concentrations")


class ConcentrationsHandler(Handler):
    def handle(self, parsed: ParsedTopic, payload: bytes) -> None:
        data = ConcentrationsPayload.model_validate_json(payload)

        if not data.elements:
            logger.debug(
                "Empty concentrations payload from %s — skipping (DEP-01 not active)",
                parsed.device_id,
            )
            return

        row = {
            "device_id": parsed.device_id,
            "tenant_id": parsed.tenant_id,
            "measurement_id": data.measurement_id or None,
            "elements": data.elements,
            "device_ts": data.ts.isoformat(),
        }
        self.ctx.writer.insert("device_concentrations", row)
        self.ctx.writer.update_last_seen(parsed.device_id)
