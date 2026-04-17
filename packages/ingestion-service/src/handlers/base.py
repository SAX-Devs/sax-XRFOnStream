"""Handler protocol and shared dependency context.

Every handler receives the same ``HandlerContext`` (writer + storage + config)
through its constructor, so wiring in ``main.py`` is uniform and swap-ins
during tests need only one mock object.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

from src.config import IngestionConfig
from src.spectra_storage import SpectraStorage
from src.supabase_writer import SupabaseWriter
from src.topic_router import ParsedTopic


logger = logging.getLogger("ingestion-service.handler")


@dataclass(frozen=True)
class HandlerContext:
    config: IngestionConfig
    writer: SupabaseWriter
    storage: SpectraStorage


class Handler(ABC):
    """Abstract base for message handlers.

    Subclasses implement ``handle``; they are responsible for:
    1. Parsing the payload bytes into a Pydantic model (validation errors are
       caught by the dispatcher and logged).
    2. Writing to Supabase via ``self.ctx.writer``.
    3. Bumping ``devices.last_seen_at`` (via ``writer.update_last_seen``) when
       the message constitutes a heartbeat.
    """

    def __init__(self, ctx: HandlerContext) -> None:
        self.ctx = ctx

    @abstractmethod
    def handle(self, parsed: ParsedTopic, payload: bytes) -> None: ...
