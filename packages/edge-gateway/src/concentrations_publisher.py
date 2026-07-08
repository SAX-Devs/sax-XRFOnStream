"""Publishes quantified concentrations from the equipment's measurements_log.

The equipment's quantification (currently iodine only) persists one row per
analysis in ``measurements_log``:

    id | MUESTRA (sample id, matches spectra) | ts (measurement time) | name |
    iodine_g_l_pred | created_at | Ag/I line sums...

Cloud payload (ConcentrationsPayload in the ingestion service):
    {device_id, ts, measurement_id, elements: {"I": <g/L>}, unit: "g/L"}

``ts`` is the MEASUREMENT time (not created_at, which lags by the analysis
duration) so concentrations align with their spectra on the timeline.
"""

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

from src.config import GatewayConfig
from src.db_reader import DbReader
from src.mqtt_client import MqttClient

logger = logging.getLogger("edge-gateway.concentrations")

TABLE = "measurements_log"
LAST_ID_FILE = "/var/lib/sax/last_concentration_id"

# Bounded reads — never sweep the historical table into RAM (incident
# 2026-07-02 class). measurements_log already holds ~15k rows.
BATCH_SIZE = 100

# One-time historical backfill on the very first run: publish the last N
# analyses (~5 days at ~150/day) so the cloud trend chart starts useful
# instead of empty. Bounded and drained in BATCH_SIZE chunks.
BACKFILL_ROWS = 700


class ConcentrationsPublisher:
    def __init__(
        self,
        config: GatewayConfig,
        mqtt_client: MqttClient,
        db_reader: DbReader,
    ) -> None:
        self._config = config
        self._mqtt = mqtt_client
        self._db = db_reader
        self._active: bool | None = None
        self._last_uploaded_id: int | None = self._load_last_id()
        self._topic = f"sax/{config.tenant_id}/{config.device_id}/concentrations"

    def _load_last_id(self) -> int | None:
        """Load the persisted cursor. None = first run ever."""
        try:
            return int(Path(LAST_ID_FILE).read_text().strip())
        except (FileNotFoundError, ValueError):
            return None

    def _save_last_id(self) -> None:
        try:
            path = Path(LAST_ID_FILE)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(str(self._last_uploaded_id))
        except Exception:
            logger.warning("Could not persist last_concentration_id")

    def _check_table(self) -> bool:
        try:
            exists = self._db.table_exists(TABLE)
            if not exists:
                logger.info(f"{TABLE} table not found. Publisher inactive.")
            return exists
        except Exception:
            logger.exception(f"Failed to check {TABLE} table")
            return False

    @staticmethod
    def _to_iso(value) -> str:
        if hasattr(value, "isoformat"):
            return value.isoformat()
        if value:
            return str(value)
        return datetime.now(timezone.utc).isoformat()

    def _tick(self) -> None:
        # Concentrations rows are small but there's no point advancing the
        # cursor while offline — pause and resume on reconnect.
        if not self._mqtt.is_connected:
            return

        if self._active is None:
            self._active = self._check_table()
            if not self._active:
                return

        if self._last_uploaded_id is None:
            # First run ever: start BACKFILL_ROWS behind the current max so the
            # cloud chart is born with recent history — NEVER the whole table.
            try:
                max_id = self._db.read_max_id(TABLE, "id")
            except Exception:
                logger.exception("Failed to initialize concentrations cursor")
                return
            self._last_uploaded_id = max(0, max_id - BACKFILL_ROWS)
            self._save_last_id()
            logger.info(
                f"First run: concentrations cursor at {self._last_uploaded_id} "
                f"(max {max_id}; backfilling last {BACKFILL_ROWS} analyses)"
            )
            return

        try:
            rows = self._db.read_rows_after(
                TABLE, "id", self._last_uploaded_id, limit=BATCH_SIZE
            )
        except Exception:
            logger.exception(f"Failed to read {TABLE}")
            return

        for row in rows:
            iodine = row.get("iodine_g_l_pred")
            measurement_id = str(row.get("MUESTRA") or row.get("name") or row.get("id", ""))
            if iodine is not None:
                payload = {
                    "device_id": self._config.device_id,
                    "ts": self._to_iso(row.get("ts")),
                    "measurement_id": measurement_id,
                    "elements": {"I": float(iodine)},
                    "unit": "g/L",
                }
                self._mqtt.publish(self._topic, json.dumps(payload, default=str).encode())
            self._last_uploaded_id = max(self._last_uploaded_id, row["id"])

        if rows:
            self._save_last_id()
            logger.info(
                f"Published {len(rows)} concentration analyses "
                f"(last_id={self._last_uploaded_id})"
            )

    def start(self, stop_event: threading.Event) -> None:
        logger.info(
            f"Concentrations publisher started (interval={self._config.concentrations_check_interval_s}s)"
        )
        while not stop_event.is_set():
            try:
                self._tick()
            except Exception:
                logger.exception("Error in concentrations tick")
            stop_event.wait(self._config.concentrations_check_interval_s)
        logger.info("Concentrations publisher stopped")
