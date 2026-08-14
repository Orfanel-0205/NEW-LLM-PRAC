"""Small wrapper around the local Ollama HTTP API."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from core.config import DEFAULT_MODEL, DEFAULT_OLLAMA_URL, DEFAULT_TIMEOUT


class OllamaClient:
    """Send chat requests to a local Ollama server."""

    def __init__(
        self,
        base_url: str = DEFAULT_OLLAMA_URL,
        model_name: str = DEFAULT_MODEL,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> None:
        self.base_url = base_url
        self.model_name = model_name
        self.timeout = timeout

    @property
    def server_url(self) -> str:
        return self.base_url.split("/api/", 1)[0]

    def is_available(self) -> bool:
        request = urllib.request.Request(f"{self.server_url}/api/tags", method="GET")
        try:
            with urllib.request.urlopen(request, timeout=min(self.timeout, 3)) as response:
                return 200 <= response.status < 300
        except (urllib.error.URLError, TimeoutError):
            return False

    def chat(
        self,
        messages: List[Dict[str, Any]],
        model_name: Optional[str] = None,
        stream: bool = False,
        options: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> str:
        payload: Dict[str, Any] = {
            "model": model_name or self.model_name,
            "messages": messages,
            "stream": stream,
            **kwargs,
        }
        if options:
            payload["options"] = options

        request = urllib.request.Request(
            self.base_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                data = json.load(response)
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Unable to reach Ollama at {self.base_url}: {exc}") from exc

        if isinstance(data, dict):
            message = data.get("message", {})
            if isinstance(message, dict):
                content = message.get("content")
                if isinstance(content, str) and content:
                    return content
                thinking = message.get("thinking")
                if isinstance(thinking, str) and thinking:
                    return thinking

            response_text = data.get("response")
            if isinstance(response_text, str):
                return response_text

        return ""
