"""Supabase Storage helper for large XRF spectra payloads.

Spectra above ``SPECTRA_INLINE_THRESHOLD_BYTES`` are uploaded to a dedicated
private bucket (default ``device-spectra``) and the table row stores only the
``storage_path``. Smaller payloads stay inline as JSONB for fast dashboard
reads.
"""

from __future__ import annotations

import logging

from supabase import Client

from src.config import IngestionConfig

logger = logging.getLogger("ingestion-service.spectra-storage")


class SpectraStorage:
    def __init__(self, config: IngestionConfig, client: Client) -> None:
        self._client = client
        self._bucket = config.spectra_storage_bucket

    def upload(
        self,
        tenant_id: str,
        device_id: str,
        measurement_id: str,
        payload_bytes: bytes,
    ) -> str:
        """Upload one spectrum and return the path written to ``device_spectra.storage_path``.

        Idempotent: re-uploads with the same key replace the existing object.
        Path scheme keeps tenant data isolated for future per-tenant policies.
        """
        path = self._build_path(tenant_id, device_id, measurement_id)
        self._client.storage.from_(self._bucket).upload(
            path=path,
            file=payload_bytes,
            file_options={
                "content-type": "application/json",
                "upsert": "true",
            },
        )
        return path

    @staticmethod
    def _build_path(tenant_id: str, device_id: str, measurement_id: str) -> str:
        safe_id = measurement_id or "unknown"
        return f"{tenant_id}/{device_id}/{safe_id}.json"
