"""Generate a constrained software-architecture blueprint with Ollama."""

from __future__ import annotations

import json
from typing import Dict, List

from pydantic import BaseModel, Field, model_validator

from core.ollama_client import OllamaClient


class ArchitectureNode(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]+$", max_length=40)
    label: str = Field(max_length=60)
    kind: str = Field(pattern=r"^(client|service|data|external|actor|screen|action|decision)$")
    description: str = Field(max_length=180)


class ArchitectureEdge(BaseModel):
    source: str
    target: str
    label: str = Field(default="", max_length=50)


class ArchitectureBlueprint(BaseModel):
    title: str = Field(max_length=100)
    summary: str = Field(max_length=600)
    nodes: List[ArchitectureNode] = Field(min_length=2, max_length=10)
    edges: List[ArchitectureEdge] = Field(max_length=16)

    @model_validator(mode="after")
    def validate_edges(self) -> "ArchitectureBlueprint":
        node_ids = {node.id for node in self.nodes}
        if len(node_ids) != len(self.nodes):
            raise ValueError("Node IDs must be unique")
        for edge in self.edges:
            if edge.source not in node_ids or edge.target not in node_ids:
                raise ValueError("Every edge must reference an existing node")
        return self


ARCHITECT_PROMPT = """You are a software architect. Convert the request into a small, practical
software architecture. Return JSON only with this exact shape:
{"title":"...","summary":"spoken explanation in 2-4 sentences","nodes":[{"id":"short_id",
"label":"...","kind":"client|service|data|external|actor|screen|action|decision","description":"..."}],
"edges":[{"source":"node_id","target":"node_id","label":"protocol or data"}]}.
Use 2-10 nodes, valid referenced IDs, and no markdown. For a UX/workflow request, use actor, screen,
action, and decision nodes in journey order and include error/recovery paths. For software systems, use
client, service, data, and external. Include security and observability only when justified. The summary
must explain the main flow and tradeoff."""


class ArchitectureGenerator:
    def __init__(self, client: OllamaClient) -> None:
        self.client = client

    def generate(self, request: str) -> ArchitectureBlueprint:
        raw = self.client.chat(
            [
                {"role": "system", "content": ARCHITECT_PROMPT},
                {"role": "user", "content": request.strip()},
            ],
            format="json",
            options={"temperature": 0.2},
        )
        try:
            payload: Dict[str, object] = json.loads(raw)
            self._normalize(payload)
            return ArchitectureBlueprint.model_validate(payload)
        except (json.JSONDecodeError, ValueError) as exc:
            raise RuntimeError("Jarvis could not create a valid architecture blueprint") from exc

    @staticmethod
    def _normalize(payload: Dict[str, object]) -> None:
        """Normalize predictable small-model schema drift without inventing topology."""
        kind_aliases = {
            "frontend": "client", "mobile": "client", "ui": "client",
            "server": "service", "backend": "service", "api": "service",
            "database": "data", "datastore": "data", "data-store": "data", "storage": "data",
            "third-party": "external", "provider": "external",
        }
        nodes = payload.get("nodes")
        if not isinstance(nodes, list):
            return
        for raw_node in nodes:
            if not isinstance(raw_node, dict):
                continue
            kind = str(raw_node.get("kind", "service")).lower().strip()
            valid_kinds = {"client", "service", "data", "external", "actor", "screen", "action", "decision"}
            raw_node["kind"] = kind_aliases.get(kind, kind if kind in valid_kinds else "service")
            raw_node["label"] = str(raw_node.get("label", "Component"))[:60]
            raw_node["description"] = str(raw_node.get("description", ""))[:180]
        payload["title"] = str(payload.get("title", "Software Architecture"))[:100]
        payload["summary"] = str(payload.get("summary", ""))[:600]
