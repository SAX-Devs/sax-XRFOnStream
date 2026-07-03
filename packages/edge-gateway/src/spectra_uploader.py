"""Uploads new spectra from local DB to MQTT."""

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

from src.config import GatewayConfig
from src.db_reader import DbReader
from src.mqtt_client import MqttClient

logger = logging.getLogger("edge-gateway.spectra-uploader")

LAST_ID_FILE = "/var/lib/sax/last_spectra_id"

# Hard cap per tick. Loading the whole historical spectras table at once (each
# row carries an 8192-channel array) exhausted the equipment's RAM and froze the
# device (incident 2026-07-02) — reads must always be small and bounded.
BATCH_SIZE = 20


class SpectraUploader:
    def __init__(
        self,
        config: GatewayConfig,
        mqtt_client: MqttClient,
        db_reader: DbReader,
    ) -> None:
        self._config = config
        self._mqtt = mqtt_client
        self._db = db_reader
        self._topic = f"sax/{config.tenant_id}/{config.device_id}/spectra"
        self._last_uploaded_id = self._load_last_id()

    def _load_last_id(self) -> int | None:
        """Load last uploaded spectra ID from persistent file.

        Returns None on first run (no state file) — the first tick then
        initializes from the CURRENT max id, skipping the historical backlog.
        """
        try:
            return int(Path(LAST_ID_FILE).read_text().strip())
        except (FileNotFoundError, ValueError):
            return None

    def _save_last_id(self) -> None:
        """Persist last uploaded spectra ID to file."""
        try:
            path = Path(LAST_ID_FILE)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(str(self._last_uploaded_id))
        except Exception:
            logger.warning("Could not persist last_spectra_id to file")

    def _tick(self) -> None:
        # Spectra are heavy (8192-channel arrays) — never buffer them while
        # offline. The cursor simply pauses here and resumes on reconnect;
        # the spectra themselves are safe in the equipment's spectras table.
        if not self._mqtt.is_connected:
            return

        if self._last_uploaded_id is None:
            # First run on this equipment: publish only spectra created from now
            # on. Sweeping months of historical spectra in one go is what froze
            # the device (2026-07-02) — the backlog is deliberately skipped.
            try:
                self._last_uploaded_id = self._db.read_max_id("spectras", "id")
            except Exception:
                logger.exception("Failed to initialize last spectra id")
                return
            self._save_last_id()
            logger.info(
                f"First run: starting at spectras id {self._last_uploaded_id} "
                "(historical backlog skipped)"
            )
            return

        try:
            rows = self._db.read_rows_after(
                "spectras", "id", self._last_uploaded_id, limit=BATCH_SIZE
            )
        except Exception:
            logger.exception("Failed to read spectras table")
            return

        for row in rows:
            # The equipment's `spectras` table holds the spectrum in the `spectrum`
            # int[] column and the run metadata in separate columns — build the
            # cloud payload from those. The frontend (toSpectrum / runField)
            # consumes {spectrum:[...]} and these run_data keys.
            spectrum = row.get("spectrum")
            payload = {
                "device_id": self._config.device_id,
                "ts": datetime.now(timezone.utc).isoformat(),
                "measurement_id": str(row.get("sample_id") or row.get("id", "")),
                "spectra_data": {"spectrum": spectrum} if spectrum is not None else None,
                "run_data": {
                    "livetime": row.get("livetime"),
                    "runtime": row.get("runtime"),
                    "triggers": row.get("triggers"),
                    "events_in_run": row.get("events_in_run"),
                    "input_count_rate": row.get("input_count_rate"),
                    "output_count_rate": row.get("output_count_rate"),
                    "sample_id": row.get("sample_id"),
                },
            }
            self._mqtt.publish(self._topic, json.dumps(payload, default=str).encode())
            self._last_uploaded_id = max(self._last_uploaded_id, row["id"])

        if rows:
            self._save_last_id()
            logger.info(f"Uploaded {len(rows)} spectra (last_id={self._last_uploaded_id})")

    def start(self, stop_event: threading.Event) -> None:
        logger.info(f"Spectra uploader started (interval={self._config.spectra_check_interval_s}s)")
        while not stop_event.is_set():
            try:
                self._tick()
            except Exception:
                logger.exception("Error in spectra uploader tick")
            stop_event.wait(self._config.spectra_check_interval_s)
        logger.info("Spectra uploader stopped")
