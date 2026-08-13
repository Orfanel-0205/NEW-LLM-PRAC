import importlib
import os
import unittest
from unittest.mock import patch


class ConfigTests(unittest.TestCase):
    def test_defaults_are_used_when_environment_is_missing(self) -> None:
        import core.config as config_module

        with patch.dict(os.environ, {}, clear=False):
            reloaded = importlib.reload(config_module)

        self.assertEqual(reloaded.DEFAULT_OLLAMA_URL, "http://localhost:11434/api/chat")
        self.assertEqual(reloaded.DEFAULT_MODEL, "llama3.2")
        self.assertEqual(reloaded.DEFAULT_TIMEOUT, 300)

    def test_environment_variables_override_defaults(self) -> None:
        import core.config as config_module

        with patch.dict(
            os.environ,
            {
                "OLLAMA_URL": "http://127.0.0.1:11434/api/chat",
                "OLLAMA_MODEL": "phi3",
                "OLLAMA_TIMEOUT": "45",
                "JARVIS_SYSTEM_PROMPT": "You are Test Jarvis",
            },
            clear=False,
        ):
            reloaded = importlib.reload(config_module)

        self.assertEqual(reloaded.DEFAULT_OLLAMA_URL, "http://127.0.0.1:11434/api/chat")
        self.assertEqual(reloaded.DEFAULT_MODEL, "phi3")
        self.assertEqual(reloaded.DEFAULT_TIMEOUT, 45)
        self.assertEqual(reloaded.DEFAULT_SYSTEM_PROMPT, "You are Test Jarvis")
