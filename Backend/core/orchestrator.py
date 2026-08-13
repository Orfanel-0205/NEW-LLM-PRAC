"""Build prompts, load memory, and route requests to Ollama."""

from __future__ import annotations

from typing import Dict, List, Optional

from core.config import DEFAULT_SYSTEM_PROMPT
from core.memory import ConversationMemory
from core.ollama_client import OllamaClient
from core.prompt_manager import system_prompt as prompt_for_mode


def build_messages(
    user_input: str,
    system_prompt: str = DEFAULT_SYSTEM_PROMPT,
    history: Optional[List[Dict[str, str]]] = None,
) -> List[Dict[str, str]]:
    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_input})
    return messages


class Orchestrator:
    def __init__(
        self,
        client: Optional[OllamaClient] = None,
        memory: Optional[ConversationMemory] = None,
    ) -> None:
        self.client = client or OllamaClient()
        self.memory = memory

    def respond(
        self,
        user_input: str,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT,
        history: Optional[List[Dict[str, str]]] = None,
        *,
        session_id: Optional[str] = None,
        mode: Optional[str] = None,
    ) -> str:
        if not user_input.strip():
            raise ValueError("Message cannot be empty")
        if session_id and self.memory:
            history = self.memory.history(session_id)
        selected_prompt = prompt_for_mode(mode) if mode else system_prompt
        messages = build_messages(user_input.strip(), selected_prompt, history)
        reply = self.client.chat(messages)
        if not reply:
            raise RuntimeError("Ollama returned an empty response")
        if session_id and self.memory:
            self.memory.add(session_id, "user", user_input.strip())
            self.memory.add(session_id, "assistant", reply)
        return reply
