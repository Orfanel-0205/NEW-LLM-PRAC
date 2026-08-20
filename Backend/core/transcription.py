"""Lazy, local speech-to-text powered by faster-whisper."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Optional


class LocalTranscriber:
    def __init__(self, model_name: str = "tiny.en") -> None:
        self.model_name = model_name
        self._model: Optional[object] = None
        self._lock = threading.Lock()

    def _get_model(self) -> object:
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
            except ImportError as exc:
                raise RuntimeError("Voice transcription dependencies are not installed") from exc
            self._model = WhisperModel(self.model_name, device="cpu", compute_type="int8")
        return self._model

    def transcribe(self, audio_path: Path) -> str:
        with self._lock:
            model = self._get_model()
            segments, _ = model.transcribe(
                str(audio_path),
                beam_size=1,
                language="en",
                vad_filter=True,
                condition_on_previous_text=False,
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
        if not text:
            raise RuntimeError("No speech was detected")
        return text
