"""Offline buffer for MQTT messages when broker connection is lost.

Persists messages to a local PostgreSQL table and drains them
in order when the connection is restored.
"""

import logging
import threading
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from src.config import LocalDbConfig

logger = logging.getLogger("edge-gateway.offline-buffer")

# Bounded reads/size — an unbounded fetchall of a large table is what froze the
# equipment (incident 2026-07-02); the same applies to draining a buffer that
# grew during a long outage.
DRAIN_BATCH_SIZE = 200
# Disk cap: keep only the newest N messages (the buffer lives on the equipment's
# SD card). Spectra are no longer buffered (their cursor pauses while offline),
# so entries are small telemetry/state messages — 20k ≈ tens of MB worst case.
MAX_BUFFERED_MESSAGES = 20_000
TRIM_CHECK_EVERY = 100


class OfflineBuffer:
    def __init__(self, db_config: LocalDbConfig) -> None:
        self._db_config = db_config
        self._lock = threading.Lock()
        self._conn = self._create_connection()
        self._enqueues_since_trim = 0

    def _read_password(self) -> str:
        return Path(self._db_config.password_file).read_text().strip()

    def _create_connection(self) -> psycopg.Connection:
        password = self._read_password()
        conn = psycopg.connect(
            host=self._db_config.host,
            port=self._db_config.port,
            dbname=self._db_config.dbname,
            user=self._db_config.user,
            password=password,
            autocommit=True,
            row_factory=dict_row,
        )
        logger.info("Offline buffer connected to local PostgreSQL")
        return conn

    def _reconnect(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass
        self._conn = self._create_connection()
        logger.info("Offline buffer reconnected to local PostgreSQL")

    def _execute_with_retry(self, operation):
        """Execute a DB operation, reconnecting once on failure."""
        try:
            return operation(self._conn)
        except psycopg.OperationalError:
            logger.warning("DB connection lost, reconnecting...")
            self._reconnect()
            return operation(self._conn)

    def enqueue(self, topic: str, payload: bytes, qos: int = 1) -> None:
        """Buffer a message for later delivery (bounded: oldest are trimmed)."""
        with self._lock:
            def op(conn):
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO edge_gateway_buffer (topic, payload, qos) VALUES (%s, %s, %s)",
                        (topic, payload, qos),
                    )

            self._execute_with_retry(op)
            self._enqueues_since_trim += 1
            if self._enqueues_since_trim >= TRIM_CHECK_EVERY:
                self._enqueues_since_trim = 0
                self._trim_locked()
        logger.debug(f"Buffered message for topic: {topic}")

    def _trim_locked(self) -> None:
        """Delete everything but the newest MAX_BUFFERED_MESSAGES rows.

        Caller must hold self._lock. Keeps the buffer bounded on disk during
        long outages (it lives in the equipment's PostgreSQL on an SD card).
        """
        def op(conn):
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM edge_gateway_buffer WHERE id <= ("
                    "  SELECT id FROM edge_gateway_buffer"
                    "  ORDER BY id DESC OFFSET %s LIMIT 1"
                    ")",
                    (MAX_BUFFERED_MESSAGES,),
                )
                if cur.rowcount:
                    logger.warning(
                        f"Offline buffer capped: dropped {cur.rowcount} oldest messages"
                    )

        try:
            self._execute_with_retry(op)
        except Exception:
            logger.exception("Failed to trim offline buffer")

    def drain_batch(
        self, limit: int = DRAIN_BATCH_SIZE
    ) -> list[tuple[int, str, bytes, int]]:
        """Return up to `limit` oldest buffered messages.

        Bounded on purpose — never load the whole buffer into RAM at once.
        Callers loop until it returns an empty list.
        """
        with self._lock:
            def op(conn):
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id, topic, payload, qos FROM edge_gateway_buffer "
                        "ORDER BY id ASC LIMIT %s",
                        (limit,),
                    )
                    return [
                        (row["id"], row["topic"], bytes(row["payload"]), row["qos"])
                        for row in cur.fetchall()
                    ]

            return self._execute_with_retry(op)

    def drain(self) -> list[tuple[int, str, bytes, int]]:
        """DEPRECATED: unbounded read — kept only for tests. Use drain_batch()."""
        return self.drain_batch(limit=1_000_000)

    def delete(self, msg_id: int) -> None:
        """Delete a message after successful delivery."""
        with self._lock:
            def op(conn):
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM edge_gateway_buffer WHERE id = %s", (msg_id,))

            self._execute_with_retry(op)

    def count(self) -> int:
        """Return the number of buffered messages."""
        with self._lock:
            def op(conn):
                with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) AS cnt FROM edge_gateway_buffer")
                    return cur.fetchone()["cnt"]

            return self._execute_with_retry(op)

    def close(self) -> None:
        """Close the database connection."""
        with self._lock:
            try:
                self._conn.close()
                logger.info("Offline buffer connection closed")
            except Exception:
                pass
