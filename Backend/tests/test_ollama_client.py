from core.config import DEFAULT_MODEL, DEFAULT_OLLAMA_URL, DEFAULT_TIMEOUT
from core.ollama_client import OllamaClient


def test_ollama_client_uses_config_defaults():
    client = OllamaClient()

    assert client.base_url == DEFAULT_OLLAMA_URL
    assert client.model_name == DEFAULT_MODEL
    assert client.timeout == DEFAULT_TIMEOUT
