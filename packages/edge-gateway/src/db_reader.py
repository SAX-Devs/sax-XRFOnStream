"""Database reader for local PostgreSQL tables."""

import logging
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from src.config import LocalDbConfig

logger = logging.getLogger("edge-gateway.db-reader")


class DbReader:
    def __init__(self, db_config: LocalDbConfig) -> None:
        self._db_config = db_config
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
        logger.info("DbReader connected to local PostgreSQL")
        return conn

    def _reconnect(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass
        self._conn = self._create_connection()
        logger.info("DbReader reconnected to local PostgreSQL")

    def _execute_with_retry(self, operation):
        """Execute a DB operation, reconnecting once on failure."""
        try:
            return operation(self._conn)
        except psycopg.OperationalError:
            logger.warning("DB connection lost, reconnecting...")
            self._reconnect()
            return operation(self._conn)

    def read_single_row(self, table_name: str) -> dict | None:
        """Read a single row from a status table (expected to have 1 row)."""
        def op(conn):
            with conn.cursor() as cur:
                cur.execute(f"SELECT * FROM {table_name} LIMIT 1")  # noqa: S608
                row = cur.fetchone()
                return dict(row) if row else None

        return self._execute_with_retry(op)

    def read_table(self, table_name: str) -> list[dict]:
        """Read all rows from a table."""
        def op(conn):
            with conn.cursor() as cur:
                cur.execute(f"SELECT * FROM {table_name}")  # noqa: S608
                return [dict(row) for row in cur.fetchall()]

        return self._execute_with_retry(op)

    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists in the local database."""
        def op(conn):
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s)",
                    (table_name,),
                )
                return cur.fetchone()["exists"]

        return self._execute_with_retry(op)

    def read_rows_after(self, table_name: str, id_column: str, after_id: int) -> list[dict]:
        """Read rows with id greater than after_id, ordered ascending."""
        def op(conn):
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT * FROM {table_name} WHERE {id_column} > %s ORDER BY {id_column} ASC",  # noqa: S608
                    (after_id,),
                )
                return [dict(row) for row in cur.fetchall()]

        return self._execute_with_retry(op)

    def close(self) -> None:
        """Close the database connection."""
        try:
            self._conn.close()
            logger.info("DbReader connection closed")
        except Exception:
            pass
