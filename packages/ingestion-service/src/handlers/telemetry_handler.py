"""Persists per-module telemetry into ``device_telemetry``."""

from __future__ import annotations

import json
import logging

from src.handlers.base import Handler
from src.models import TelemetryPayload
from src.topic_router import ParsedTopic

logger = logging.getLogger("ingestion-service.telemetry")


class TelemetryHandler(Handler):
    def handle(self, parsed: ParsedTopic, payload: bytes) -> None:
        data = TelemetryPayload.model_validate_json(payload)

        if parsed.module and data.module != parsed.module:
            logger.warning(
                "Module mismatch: topic=%s payload=%s — using topic value",
                parsed.module, data.module,
            )

        row = {
            "device_id": parsed.device_id,
            "tenant_id": parsed.tenant_id,
            "module": parsed.module or data.module,
            "data": data.data,
            "device_ts": data.ts.isoformat(),
        }
        self.ctx.writer.insert("device_telemetry", row)
        self.ctx.writer.update_last_seen(parsed.device_id)


# A defensive json.loads helper isn't needed: Pydantic v2 raises ValidationError
# on bad JSON via model_validate_json — caught by the dispatcher.
_ = json  # keep linter happy without exposing helper at module level
