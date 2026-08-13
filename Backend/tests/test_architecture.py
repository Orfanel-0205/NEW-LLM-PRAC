import json

import pytest

from core.architecture import ArchitectureGenerator, ArchitectureBlueprint


class FakeClient:
    def __init__(self, payload: dict):
        self.payload = payload

    def chat(self, messages, **kwargs):
        assert kwargs["format"] == "json"
        return json.dumps(self.payload)


def test_architecture_generator_validates_blueprint():
    payload = {
        "title": "Local Jarvis",
        "summary": "The phone sends requests to a local API, which calls Ollama.",
        "nodes": [
            {"id": "phone", "label": "Expo App", "kind": "client", "description": "UI"},
            {"id": "api", "label": "Jarvis API", "kind": "service", "description": "Orchestration"},
        ],
        "edges": [{"source": "phone", "target": "api", "label": "HTTP"}],
    }
    result = ArchitectureGenerator(FakeClient(payload)).generate("build Jarvis")
    assert isinstance(result, ArchitectureBlueprint)
    assert result.edges[0].target == "api"


def test_architecture_rejects_missing_edge_node():
    payload = {
        "title": "Broken",
        "summary": "Invalid reference.",
        "nodes": [
            {"id": "a", "label": "A", "kind": "client", "description": "A"},
            {"id": "b", "label": "B", "kind": "service", "description": "B"},
        ],
        "edges": [{"source": "a", "target": "missing", "label": "HTTP"}],
    }
    with pytest.raises(RuntimeError):
        ArchitectureGenerator(FakeClient(payload)).generate("broken")
