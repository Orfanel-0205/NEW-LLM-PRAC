"""Small SQLite-backed conversation store."""

from __future__ import annotations

import sqlite3
import threading
import uuid
from contextlib import closing
from pathlib import Path
from typing import Dict, List, Optional


class ConversationMemory:
    def __init__(self, database_path: Optional[Path] = None) -> None:
        default_path = Path(__file__).resolve().parents[1] / "data" / "jarvis.db"
        self.database_path = Path(database_path or default_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with closing(self._connect()) as connection, connection:
            connection.execute(
                """CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )"""
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id)"
            )

    @staticmethod
    def new_session_id() -> str:
        return str(uuid.uuid4())

    def add(self, session_id: str, role: str, content: str) -> None:
        if role not in {"user", "assistant"}:
            raise ValueError("role must be 'user' or 'assistant'")
        with self._lock, closing(self._connect()) as connection, connection:
            connection.execute(
                "INSERT INTO messages(session_id, role, content) VALUES (?, ?, ?)",
                (session_id, role, content),
            )

    def history(self, session_id: str, limit: int = 20) -> List[Dict[str, str]]:
        safe_limit = max(1, min(limit, 100))
        with closing(self._connect()) as connection:
            rows = connection.execute(
                """SELECT role, content FROM (
                    SELECT id, role, content FROM messages
                    WHERE session_id = ? ORDER BY id DESC LIMIT ?
                ) ORDER BY id ASC""",
                (session_id, safe_limit),
            ).fetchall()
        return [{"role": row["role"], "content": row["content"]} for row in rows]

    def clear(self, session_id: str) -> None:
        with self._lock, closing(self._connect()) as connection, connection:
            connection.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
