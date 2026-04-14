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


class OfflineBuffer:
    def __init__(self, db_config: LocalDbConfig) -> None:
        self._db_config = db_config
        self._lock = threading.Lock()
        self._conn = self._create_connection()

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
        """Buffer a message for later delivery."""
        with self._lock:
            def op(conn):
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO edge_gateway_buffer (topic, payload, qos) VALUES (%s, %s, %s)",
                        (topic, payload, qos),
                    )

            self._execute_with_retry(op)
        logger.debug(f"Buffered message for topic: {topic}")

    def drain(self) -> list[tuple[int, str, bytes, int]]:
        """Return all buffered messages ordered by creation time."""
        with self._lock:
            def op(conn):
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id, topic, payload, qos FROM edge_gateway_buffer ORDER BY created_at ASC"
                    )
                    return [
                        (row["id"], row["topic"], bytes(row["payload"]), row["qos"])
                        for row in cur.fetchall()
                    ]

            return self._execute_with_retry(op)

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
