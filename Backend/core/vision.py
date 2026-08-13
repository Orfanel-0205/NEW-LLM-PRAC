"""Privacy-safe, structured scene detection for the AR overlay."""

from __future__ import annotations

import base64
import json
from typing import Any, Dict, List

from pydantic import BaseModel, Field

from core.config import VISION_MODEL
from core.ollama_client import OllamaClient


class DetectedObject(BaseModel):
    id: str = Field(max_length=40)
    label: str = Field(max_length=60)
    category: str = Field(pattern=r"^(technical|device|tool|document|furniture|person|other)$")
    confidence: float = Field(ge=0, le=1)
    box: List[int] = Field(min_length=4, max_length=4)
    observation: str = Field(max_length=180)


class SceneDetection(BaseModel):
    scene: str = Field(max_length=240)
    objects: List[DetectedObject] = Field(max_length=10)
    suggestions: List[str] = Field(max_length=4)
    speak: str = Field(max_length=500)


DETECTION_PROMPT = """You are Jarvis real-time technical vision. Return JSON only:
{"scene":"brief factual scene","objects":[{"id":"unique_id","label":"visible object",
"category":"technical|device|tool|document|furniture|person|other","confidence":0.0,
"box":[x1,y1,x2,y2],"observation":"strictly visible fact"}],
"suggestions":["short contextual action"],"speak":"one concise useful spoken update addressed to Goshujin-sama"}.

Coordinates are integers normalized from 0 to 1000 relative to image width and height. Detect at most
10 important objects and prioritize screens, error messages, code, electronics, controls, tools, documents,
and obstacles. A person may be labeled only as "Person". Never infer identity, exact age, age range, health,
emotion, ethnicity, disability, attractiveness, or other sensitive traits from appearance. Suggestions must
be grounded in visible evidence; if text is unreadable, say so. Do not use markdown."""


class VisionDetector:
    def __init__(self, client: OllamaClient) -> None:
        self.client = client

    def detect(self, image: bytes, focus: str = "") -> SceneDetection:
        prompt = DETECTION_PROMPT
        if focus.strip():
            prompt += f"\nUser focus: {focus.strip()[:1000]}"
        raw = self.client.chat(
            [{
                "role": "user",
                "content": prompt,
                "images": [base64.b64encode(image).decode("ascii")],
            }],
            model_name=VISION_MODEL,
            format="json",
            options={"temperature": 0.1},
            keep_alive="30m",
        )
        try:
            payload: Dict[str, Any] = json.loads(raw)
            return SceneDetection.model_validate(self._normalize(payload))
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            raise RuntimeError("Vision model returned an invalid detection map") from exc

    @staticmethod
    def _normalize(payload: Dict[str, Any]) -> Dict[str, Any]:
        allowed = {"technical", "device", "tool", "document", "furniture", "person", "other"}
        objects = []
        for index, item in enumerate(payload.get("objects", [])[:10]):
            if not isinstance(item, dict):
                continue
            raw_box = item.get("box", [])
            if not isinstance(raw_box, list) or len(raw_box) != 4:
                continue
            try:
                box = [max(0, min(1000, int(value))) for value in raw_box]
            except (TypeError, ValueError):
                continue
            if box[2] <= box[0] or box[3] <= box[1]:
                continue
            category = str(item.get("category", "other")).lower()
            if category not in allowed:
                category = "other"
            label = "Person" if category == "person" else str(item.get("label", "Object"))[:60]
            objects.append({
                "id": str(item.get("id", f"object_{index}"))[:40],
                "label": label,
                "category": category,
                "confidence": max(0.0, min(1.0, float(item.get("confidence", 0.5)))),
                "box": box,
                "observation": str(item.get("observation", "Visible object"))[:180],
            })
        return {
            "scene": str(payload.get("scene", "Scene scanned"))[:240],
            "objects": objects,
            "suggestions": [str(value)[:180] for value in payload.get("suggestions", [])[:4]],
            "speak": str(payload.get("speak", "Scan complete, Goshujin-sama."))[:500],
        }
