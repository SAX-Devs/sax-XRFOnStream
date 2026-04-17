"""Persists Sentinel alerts (and the promoted critical alerts topic) into ``alerts``.

The Edge Gateway publishes change-only deltas: only severities that changed
appear in the payload. Each alert in the list becomes one row.

Severity normalisation: the Edge Gateway sends uppercase strings derived from
the Sentinel module (``OK``, ``INFO``, ``WARNING``, ``CRITICAL``, ``EMERGENCY``).
The Supabase enum is lowercase and does not include ``OK``; rows with severity
``OK`` are recoveries — we record them at ``info`` level so the dashboard can
show "alarm cleared" events.
"""

from __future__ import annotations

import logging

from src.handlers.base import Handler
from src.models import SentinelPayload
from src.topic_router import ParsedTopic

logger = logging.getLogger("ingestion-service.alerts")


_SEVERITY_MAP = {
    "ok": "info",
    "info": "info",
    "warning": "warning",
    "critical": "critical",
    "emergency": "emergency",
}


class AlertHandler(Handler):
    def handle(self, parsed: ParsedTopic, payload: bytes) -> None:
        data = SentinelPayload.model_validate_json(payload)
        device_ts = data.ts.isoformat()

        for alert in data.alerts:
            severity = _SEVERITY_MAP.get(alert.severity.lower())
            if severity is None:
                logger.warning(
                    "Unknown severity %r in alert %s — skipping",
                    alert.severity, alert.name,
                )
                continue

            row = {
                "device_id": parsed.device_id,
                "tenant_id": parsed.tenant_id,
                "severity": severity,
                "source": data.source or parsed.kind.value,
                "title": alert.name,
                "detail": {
                    "message": alert.message,
                    "raw_severity": alert.severity,
                    "updated_at": alert.updated_at,
                },
                "device_ts": device_ts,
            }
            self.ctx.writer.insert("alerts", row)

        self.ctx.writer.update_last_seen(parsed.device_id)
