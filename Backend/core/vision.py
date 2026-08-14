"""Structured, privacy-conscious scene analysis for the AR overlay."""

from __future__ import annotations

import json
from typing import List

from pydantic import BaseModel, Field, model_validator

from core.config import VISION_MODEL
from core.ollama_client import OllamaClient


class Detection(BaseModel):
    id: str = Field(max_length=40)
    label: str = Field(max_length=60)
    box: List[int] = Field(min_length=4, max_length=4)
    observation: str = Field(max_length=180)
    suggestion: str = Field(default="", max_length=220)

    @model_validator(mode="after")
    def valid_box(self) -> "Detection":
        x1, y1, x2, y2 = self.box
        if not (0 <= x1 < x2 <= 1000 and 0 <= y1 < y2 <= 1000):
            raise ValueError("box must be [x1,y1,x2,y2] normalized from 0 to 1000")
        return self


class VisionResult(BaseModel):
    scene: str = Field(max_length=300)
    spoken_update: str = Field(max_length=500)
    detections: List[Detection] = Field(default_factory=list, max_length=8)


VISION_PROMPT = """You are the visual system for a private technical AR assistant.
Inspect the image and return JSON only in this shape:
{"scene":"brief factual scene summary","spoken_update":"one concise useful update addressed to Goshujin-sama",
"detections":[{"id":"stable_short_id","label":"visible object or UI/error label","box":[x1,y1,x2,y2],
"observation":"what is visibly evidenced","suggestion":"one useful action, or empty"}]}.

Boxes use integer coordinates normalized 0-1000 for the displayed image. Detect at most 8 important items.
Prioritize errors, code, logs, browser/devtools, controls, screens, documents, hardware, tools, obstacles,
and objects relevant to the user's question. Do not infer age, health, emotion, ethnicity, identity, or other
sensitive traits from appearance. A person may only be labeled 'Person'. Distinguish evidence from hypotheses.
Do not invent text that is not legible. If nothing technical is visible, identify ordinary objects and give
only genuinely useful suggestions. Never include markdown."""


class VisionAnalyzer:
    def __init__(self, client: OllamaClient) -> None:
        self.client = client

    def analyze(self, image_data: str, question: str) -> VisionResult:
        raw = self.client.chat(
            [{
                "role": "user",
                "content": f"/no_think\n{VISION_PROMPT}\n\nUser focus: {question[:3000]}",
                "images": [image_data],
            }],
            model_name=VISION_MODEL,
            format="json",
            think=False,
            options={"temperature": 0.1, "num_predict": 1200},
            keep_alive="30m",
        )
        try:
            payload = json.loads(raw)
            payload["scene"] = str(payload.get("scene", "Scene analyzed"))[:300]
            payload["spoken_update"] = str(payload.get("spoken_update", ""))[:500]
            if payload["spoken_update"] and "goshujin-sama" not in payload["spoken_update"].lower():
                payload["spoken_update"] = f"Goshujin-sama, {payload['spoken_update']}"[:500]
            normalized = []
            for index, item in enumerate(payload.get("detections", [])[:8]):
                if not isinstance(item, dict):
                    continue
                box = item.get("box")
                if not isinstance(box, list) or len(box) != 4:
                    continue
                item["box"] = [max(0, min(1000, int(value))) for value in box]
                if item["box"][0] >= item["box"][2] or item["box"][1] >= item["box"][3]:
                    continue
                item["id"] = str(item.get("id", f"object_{index}"))[:40]
                item["label"] = str(item.get("label", "Object"))[:60]
                item["observation"] = str(item.get("observation", "Visible object"))[:180]
                item["suggestion"] = str(item.get("suggestion", ""))[:220]
                normalized.append(item)
            payload["detections"] = normalized
            return VisionResult.model_validate(payload)
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            raise RuntimeError("Jarvis could not create valid AR detections") from exc
