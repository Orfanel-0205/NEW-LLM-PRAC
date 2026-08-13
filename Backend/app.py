"""Jarvis API entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router

app = FastAPI(title="Jarvis Personal Assistant", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)


@app.get("/")
def root() -> dict:
    return {"name": "Jarvis", "docs": "/docs", "health": "/api/health"}


if __name__ == "__main__":
    import uvicorn

    from core.config import API_HOST, API_PORT

    uvicorn.run("app:app", host=API_HOST, port=API_PORT, reload=True)
