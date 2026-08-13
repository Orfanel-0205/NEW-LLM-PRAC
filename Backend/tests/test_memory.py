from pathlib import Path
from tempfile import TemporaryDirectory

from core.memory import ConversationMemory


def test_memory_add_read_and_clear():
    with TemporaryDirectory() as directory:
        memory = ConversationMemory(Path(directory) / "test.db")
        session = memory.new_session_id()
        memory.add(session, "user", "hello")
        memory.add(session, "assistant", "hi")

        assert memory.history(session) == [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
        ]

        memory.clear(session)
        assert memory.history(session) == []
