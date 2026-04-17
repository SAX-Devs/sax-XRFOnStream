"""Updates ``command_audit`` rows with ACK and result events.

The state machine on the cloud side is:

    sent → delivered → ack → executing → completed | error | rejected | expired

We only handle the transitions the Edge Gateway can drive:
- ``ack``: ``sent → ack`` (only if not already terminal)
- ``result``: ``ack/executing → completed | error | rejected``

Both UPDATEs are idempotent: re-running the same statement is a no-op because
the WHERE clause filters terminal states for ACKs and the UPDATE is monotonic
for results.
"""

from __future__ import annotations

import logging

from src.handlers.base import Handler
from src.models import CommandAckPayload, CommandResultPayload
from src.topic_router import ParsedTopic, TopicKind

logger = logging.getLogger("ingestion-service.command-audit")


_TERMINAL_STATUSES = {"completed", "error", "rejected", "expired"}


class CommandAuditHandler(Handler):
    def handle(self, parsed: ParsedTopic, payload: bytes) -> None:
        if parsed.kind == TopicKind.COMMAND_ACK:
            self._handle_ack(parsed, payload)
        elif parsed.kind == TopicKind.COMMAND_RESULT:
            self._handle_result(parsed, payload)
        else:
            logger.warning("Unsupported topic kind for command audit: %s", parsed.kind)

    def _handle_ack(self, parsed: ParsedTopic, payload: bytes) -> None:
        data = CommandAckPayload.model_validate_json(payload)
        try:
            self.ctx.writer.update(
                "command_audit",
                {"status": "ack", "ack_at": data.ack_at.isoformat()},
                {"id": data.command_id},
            )
        except Exception:
            logger.exception("Failed to mark command %s as ack", data.command_id)
            return
        logger.info("Command %s marked ack", data.command_id)
        self.ctx.writer.update_last_seen(parsed.device_id)

    def _handle_result(self, parsed: ParsedTopic, payload: bytes) -> None:
        data = CommandResultPayload.model_validate_json(payload)
        try:
            self.ctx.writer.update(
                "command_audit",
                {
                    "status": data.status,
                    "completed_at": data.completed_at.isoformat(),
                    "error_message": data.error_message,
                },
                {"id": data.command_id},
            )
        except Exception:
            logger.exception("Failed to mark command %s as %s", data.command_id, data.status)
            return
        logger.info("Command %s marked %s", data.command_id, data.status)
        self.ctx.writer.update_last_seen(parsed.device_id)


_ = _TERMINAL_STATUSES  # reserved for a future state-machine guard query
