"""Persists XRF spectra to ``device_spectra``, offloading large payloads to Storage."""

from __future__ import annotations

import json
import logging

from src.handlers.base import Handler
from src.models import SpectraPayload
from src.topic_router import ParsedTopic

logger = logging.getLogger("ingestion-service.spectra")


class SpectraHandler(Handler):
    def handle(self, parsed: ParsedTopic, payload: bytes) -> None:
        data = SpectraPayload.model_validate_json(payload)

        spectra_field = data.spectra_data
        spectra_bytes = json.dumps(spectra_field, default=str).encode("utf-8") if spectra_field is not None else b""
        threshold = self.ctx.config.spectra_inline_threshold_bytes

        row: dict = {
            "device_id": parsed.device_id,
            "tenant_id": parsed.tenant_id,
            "measurement_id": data.measurement_id or None,
            "run_data": data.run_data,
            "device_ts": data.ts.isoformat(),
        }

        if spectra_field is not None and len(spectra_bytes) > threshold:
            try:
                storage_path = self.ctx.storage.upload(
                    tenant_id=parsed.tenant_id,
                    device_id=parsed.device_id,
                    measurement_id=data.measurement_id or _fallback_measurement_id(data.ts),
                    payload_bytes=spectra_bytes,
                )
                row["spectra_data"] = None
                row["storage_path"] = storage_path
                logger.info(
                    "Spectrum %s offloaded to Storage (%d bytes)",
                    data.measurement_id, len(spectra_bytes),
                )
            except Exception:
                logger.exception(
                    "Storage upload failed for spectrum %s; falling back to inline JSONB",
                    data.measurement_id,
                )
                row["spectra_data"] = spectra_field
                row["storage_path"] = None
        else:
            row["spectra_data"] = spectra_field
            row["storage_path"] = None

        self.ctx.writer.insert("device_spectra", row)
        self.ctx.writer.update_last_seen(parsed.device_id)


def _fallback_measurement_id(ts) -> str:
    return ts.strftime("%Y%m%dT%H%M%S%f")
