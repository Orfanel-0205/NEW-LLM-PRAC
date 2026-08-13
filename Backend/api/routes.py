"""HTTP routes consumed by the Expo app."""

from __future__ import annotations

import hmac
import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

from core.config import API_TOKEN, DEFAULT_MODEL
from core.architecture import ArchitectureBlueprint, ArchitectureGenerator
from core.memory import ConversationMemory
from core.ollama_client import OllamaClient
from core.orchestrator import Orchestrator
from core.prompt_manager import available_modes
from core.transcription import LocalTranscriber

router = APIRouter(prefix="/api")
client = OllamaClient()
memory = ConversationMemory()
orchestrator = Orchestrator(client=client, memory=memory)
architecture_generator = ArchitectureGenerator(client)
transcriber = LocalTranscriber()
MAX_AUDIO_BYTES = 15 * 1024 * 1024


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=20_000)
    session_id: Optional[str] = Field(default=None, max_length=100)
    mode: str = "coding"


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    mode: str


class ArchitectureRequest(BaseModel):
    request: str = Field(min_length=3, max_length=10_000)


def authorize(authorization: Optional[str] = Header(default=None)) -> None:
    if not API_TOKEN:
        return
    expected = f"Bearer {API_TOKEN}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Invalid API token")


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "ollama": client.is_available(),
        "model": DEFAULT_MODEL,
        "modes": available_modes(),
    }


@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(authorize)])
def chat(body: ChatRequest) -> ChatResponse:
    if body.mode not in available_modes():
        raise HTTPException(status_code=400, detail=f"Unknown mode: {body.mode}")
    session_id = body.session_id or memory.new_session_id()
    try:
        reply = orchestrator.respond(
            body.message,
            session_id=session_id,
            mode=body.mode,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return ChatResponse(reply=reply, session_id=session_id, mode=body.mode)


@router.post(
    "/architecture",
    response_model=ArchitectureBlueprint,
    dependencies=[Depends(authorize)],
)
def architecture(body: ArchitectureRequest) -> ArchitectureBlueprint:
    try:
        return architecture_generator.generate(body.request)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/transcribe", dependencies=[Depends(authorize)])
async def transcribe(audio: UploadFile = File(...)) -> dict:
    suffix = Path(audio.filename or "voice.m4a").suffix or ".m4a"
    temp_path: Optional[Path] = None
    try:
        contents = await audio.read(MAX_AUDIO_BYTES + 1)
        if len(contents) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="Audio recording is too large")
        if not contents:
            raise HTTPException(status_code=400, detail="Audio recording is empty")
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temporary:
            temporary.write(contents)
            temp_path = Path(temporary.name)
        return {"text": transcriber.transcribe(temp_path)}
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    finally:
        await audio.close()
        if temp_path and temp_path.exists():
            os.unlink(temp_path)


@router.get("/sessions/{session_id}/messages", dependencies=[Depends(authorize)])
def messages(session_id: str) -> dict:
    return {"session_id": session_id, "messages": memory.history(session_id, limit=100)}


@router.delete("/sessions/{session_id}", dependencies=[Depends(authorize)])
def clear_session(session_id: str) -> dict:
    memory.clear(session_id)
    return {"cleared": True, "session_id": session_id}
