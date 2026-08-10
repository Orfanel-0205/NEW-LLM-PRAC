"""Configuration defaults for the Ollama-based orchestrator."""

import os

DEFAULT_OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
DEFAULT_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "60"))
DEFAULT_SYSTEM_PROMPT = os.getenv(
    "JARVIS_SYSTEM_PROMPT",
    "You are Jarvis, a helpful AI assistant for software development.",
)
