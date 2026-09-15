import logging
import asyncio
from typing import Optional
from contextlib import contextmanager
from pathlib import Path

import duckdb
import pandas as pd

logger = logging.getLogger(__name__)


class DuckDBClient:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = str(db_path)
        self._conn: Optional[duckdb.DuckDBPyConnection] = None

    def connect(self) -> None:
        if self._conn is None:
            logger.info(f"[DuckDBClient] Connecting to DuckDB at {self.db_path}")
            self._conn = duckdb.connect(database=self.db_path, read_only=True)
            self._conn.execute("PRAGMA memory_limit='4GB'")

    def disconnect(self) -> None:
        if self._conn:
            logger.info("[DuckDBClient] Closing DuckDB connection")
            self._conn.close()
            self._conn = None

    @contextmanager
    def get_cursor(self):
        if not self._conn:
            raise RuntimeError("Database connection is not initialized.")

        cursor = self._conn.cursor()
        try:
            yield cursor
        finally:
            cursor.close()

    async def fetch_dataframe(
        self, query: str, parameters: tuple | None = None
    ) -> pd.DataFrame:
        def _execute() -> pd.DataFrame:
            with self.get_cursor() as cursor:
                if parameters:
                    cursor.execute(query, parameters)
                else:
                    cursor.execute(query)
                return cursor.df()

        return await asyncio.to_thread(_execute)
