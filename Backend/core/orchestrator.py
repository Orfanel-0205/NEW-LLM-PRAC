"""Simple orchestrator for building chat messages and routing them to Ollama."""

from __future__ import annotations

from typing import List, Dict, Optional

from core.config import DEFAULT_SYSTEM_PROMPT
from core.ollama_client import OllamaClient


def build_messages(
    user_input: str,
    system_prompt: str = DEFAULT_SYSTEM_PROMPT,
    history: Optional[List[Dict[str, str]]] = None,
) -> List[Dict[str, str]]:
    """Build a message list for the Ollama chat endpoint."""
    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_input})
    return messages


class Orchestrator:
    """Coordinate prompt building and model calls."""

    def __init__(self, client: Optional[OllamaClient] = None) -> None:
        self.client = client or OllamaClient()

    def respond(
        self,
        user_input: str,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        messages = build_messages(user_input, system_prompt=system_prompt, history=history)
        return self.client.chat(messages)

