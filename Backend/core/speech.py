"""Local Piper speech synthesis using the user's Danny voice."""

from __future__ import annotations

import io
import threading
import wave
from pathlib import Path
from typing import Optional


class SpeechSynthesizer:
    def __init__(self) -> None:
        voice_dir = Path(__file__).resolve().parents[1] / "data" / "voices"
        self.model_path = voice_dir / "en_US-danny-low.onnx"
        self.config_path = voice_dir / "en_US-danny-low.onnx.json"
        self._voice: Optional[object] = None
        self._lock = threading.Lock()

    def _get_voice(self) -> object:
        if self._voice is None:
            if not self.model_path.exists() or not self.config_path.exists():
                raise RuntimeError("Danny voice model is not configured")
            from piper import PiperVoice

            self._voice = PiperVoice.load(self.model_path, self.config_path, use_cuda=False)
        return self._voice

    def synthesize(self, text: str) -> bytes:
        clean_text = " ".join(text.split())[:1200]
        if not clean_text:
            raise ValueError("Speech text cannot be empty")
        output = io.BytesIO()
        with self._lock, wave.open(output, "wb") as wav_file:
            self._get_voice().synthesize_wav(clean_text, wav_file)
        return output.getvalue()
