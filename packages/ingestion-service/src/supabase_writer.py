"""Thin wrapper around supabase-py with retry/backoff and a small device cache.

Why wrap supabase-py:
- Centralise retry policy (transient 5xx vs deterministic 4xx).
- Avoid hammering ``devices.last_seen_at`` with a cache TTL.
- Give handlers a tiny, explicit surface (``insert``, ``upsert``, ``update``)
  so they don't reach into the Supabase client directly.
"""

from __future__ import annotations

import logging
import random
import time
from datetime import datetime, timezone
from typing import Any, Callable, TypeVar

from supabase import Client, create_client

from src.config import IngestionConfig

logger = logging.getLogger("ingestion-service.writer")

T = TypeVar("T")

_RETRYABLE_HTTP_STATUSES = {408, 429, 500, 502, 503, 504}


class SupabaseWriter:
    """Persistence facade. All writes go through this.

    Methods raise on terminal failure so the caller (handler) can log + drop
    one bad message without crashing the subscriber loop.
    """

    def __init__(
        self,
        config: IngestionConfig,
        client: Client | None = None,
        last_seen_cache_ttl_s: float = 60.0,
    ) -> None:
        self._config = config
        self._client: Client = client or create_client(
            config.supabase_url,
            config.supabase_service_role_key.get_secret_value(),
        )
        self._last_seen_cache_ttl_s = last_seen_cache_ttl_s
        self._last_seen_cache: dict[str, float] = {}

    # -- Public API ---------------------------------------------------------

    def insert(self, table: str, row: dict[str, Any]) -> None:
        self._with_retry(lambda: self._client.table(table).insert(row).execute())

    def upsert(self, table: str, row: dict[str, Any], on_conflict: str) -> None:
        self._with_retry(
            lambda: self._client.table(table)
            .upsert(row, on_conflict=on_conflict)
            .execute()
        )

    def update(
        self,
        table: str,
        values: dict[str, Any],
        match: dict[str, Any],
    ) -> None:
        def op() -> Any:
            query = self._client.table(table).update(values)
            for col, val in match.items():
                query = query.eq(col, val)
            return query.execute()

        self._with_retry(op)

    def update_last_seen(self, device_id: str) -> None:
        """Bump ``devices.last_seen_at`` for one device, with TTL caching.

        Telemetry arrives every 2 s per device; without caching we'd issue 30+
        UPDATEs per minute per device. The TTL collapses that to one per minute.
        """
        now = time.monotonic()
        last = self._last_seen_cache.get(device_id, 0.0)
        if now - last < self._last_seen_cache_ttl_s:
            return
        self._last_seen_cache[device_id] = now
        try:
            self.update(
                "devices",
                {"last_seen_at": _now_iso()},
                {"id": device_id},
            )
        except Exception:
            logger.exception("Failed to update devices.last_seen_at for %s", device_id)

    # -- Retry policy -------------------------------------------------------

    def _with_retry(
        self,
        op: Callable[[], T],
        *,
        max_attempts: int = 3,
        base_delay_s: float = 0.5,
    ) -> T:
        """Run ``op`` with exponential backoff on retryable errors only.

        Deterministic 4xx errors (bad payload) re-raise immediately so the
        handler can log a structured warning. Transient 5xx and timeouts get
        up to ``max_attempts`` tries with jittered exponential backoff.
        """
        last_exc: Exception | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                return op()
            except Exception as exc:
                if not _is_retryable(exc) or attempt == max_attempts:
                    raise
                last_exc = exc
                delay = base_delay_s * (2 ** (attempt - 1))
                delay += random.uniform(0, base_delay_s)
                logger.warning(
                    "Supabase write attempt %d/%d failed (%s); retrying in %.2fs",
                    attempt, max_attempts, exc, delay,
                )
                time.sleep(delay)
        assert last_exc is not None
        raise last_exc


def _is_retryable(exc: Exception) -> bool:
    """Heuristic: retry only on transient HTTP failures."""
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if isinstance(status, int) and status in _RETRYABLE_HTTP_STATUSES:
        return True
    text = str(exc).lower()
    return any(token in text for token in ("timeout", "timed out", "connection", "temporarily"))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
