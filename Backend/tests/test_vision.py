import json

from core.vision import VisionDetector


class FakeClient:
    def chat(self, messages, **kwargs):
        return json.dumps({
            "scene": "Desk with monitor",
            "objects": [{
                "id": "monitor", "label": "Monitor", "category": "device",
                "confidence": 0.9, "box": [100, 100, 700, 600], "observation": "Editor visible",
            }],
            "suggestions": ["Inspect the visible error"],
            "speak": "A monitor is visible, Goshujin-sama.",
        })


def test_detector_builds_normalized_map():
    result = VisionDetector(FakeClient()).detect(b"image")
    assert result.objects[0].box == [100, 100, 700, 600]
    assert "Goshujin-sama" in result.speak


def test_person_label_does_not_preserve_inferred_attributes():
    payload = {
        "scene": "Person present", "suggestions": [], "speak": "Person detected",
        "objects": [{"id": "p", "label": "Young person age 20", "category": "person", "confidence": 0.8, "box": [1, 1, 9, 9], "observation": "Standing"}],
    }
    normalized = VisionDetector._normalize(payload)
    assert normalized["objects"][0]["label"] == "Person"
