"""Configuration defaults for the Ollama-based orchestrator."""

import os

DEFAULT_OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
DEFAULT_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "300"))
API_HOST = os.getenv("JARVIS_API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("JARVIS_API_PORT", "8000"))
API_TOKEN = os.getenv("JARVIS_API_TOKEN", "")
MEMORY_LIMIT = int(os.getenv("JARVIS_MEMORY_LIMIT", "20"))
DEFAULT_SYSTEM_PROMPT = os.getenv(
    "JARVIS_SYSTEM_PROMPT",
    "You are Jarvis, a helpful AI assistant for software development.",
)
