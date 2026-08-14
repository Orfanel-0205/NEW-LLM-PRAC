import json

from core.vision import VisionAnalyzer


class FakeVisionClient:
    def chat(self, messages, **kwargs):
        assert messages[0]["images"] == ["base64-image"]
        assert kwargs["format"] == "json"
        return json.dumps({
            "scene": "A browser showing an error",
            "spoken_update": "Goshujin-sama, a network error is visible.",
            "detections": [{
                "id": "error",
                "label": "Network error",
                "box": [100, 200, 800, 500],
                "observation": "ERR_CONNECTION_REFUSED is visible",
                "suggestion": "Verify the local API port",
            }],
        })


def test_vision_analyzer_returns_positioned_detections():
    result = VisionAnalyzer(FakeVisionClient()).analyze("base64-image", "inspect")
    assert result.detections[0].box == [100, 200, 800, 500]
    assert "Goshujin-sama" in result.spoken_update


def test_vision_analyzer_discards_invalid_boxes():
    class InvalidBoxClient(FakeVisionClient):
        def chat(self, messages, **kwargs):
            payload = json.loads(super().chat(messages, **kwargs))
            payload["detections"][0]["box"] = [900, 200, 100, 500]
            return json.dumps(payload)

    result = VisionAnalyzer(InvalidBoxClient()).analyze("base64-image", "inspect")
    assert result.detections == []
