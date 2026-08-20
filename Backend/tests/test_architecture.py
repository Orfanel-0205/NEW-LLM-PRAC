import json

import pytest

from core.architecture import ArchitectureGenerator, ArchitectureBlueprint


class FakeClient:
    def __init__(self, payload: dict):
        self.payload = payload

    def chat(self, messages, **kwargs):
        assert isinstance(kwargs["format"], dict)
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


def test_architecture_discards_missing_edge_node():
    payload = {
        "title": "Broken",
        "summary": "Invalid reference.",
        "nodes": [
            {"id": "a", "label": "A", "kind": "client", "description": "A"},
            {"id": "b", "label": "B", "kind": "service", "description": "B"},
        ],
        "edges": [{"source": "a", "target": "missing", "label": "HTTP"}],
    }
    result = ArchitectureGenerator(FakeClient(payload)).generate("broken")
    assert result.edges == []


def test_architecture_repairs_ids_and_edge_references():
    payload = {
        "title": "UX flow",
        "summary": "A critical checkout flow.",
        "nodes": [
            {"id": "search screen", "label": "Search", "kind": "screen", "description": "Find products"},
            {"id": "checkout screen", "label": "Checkout", "kind": "screen", "description": "Pay"},
        ],
        "edges": [{"source": "search screen", "target": "checkout screen", "label": "select"}],
    }
    result = ArchitectureGenerator(FakeClient(payload)).generate("checkout UX")
    assert [node.id for node in result.nodes] == ["search_screen", "checkout_screen"]
    assert result.edges[0].target == "checkout_screen"
