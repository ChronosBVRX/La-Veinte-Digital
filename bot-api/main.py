import os
import re
import secrets
from typing import List, Literal
from fastapi import FastAPI, Request, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from embedding_service import consulta_contrato

load_dotenv()
BASE = os.getcwd()

SHARED_SECRET = os.getenv("BOT_API_SHARED_SECRET", "")

CORS_ORIGIN = os.getenv(
    "BOT_CORS_ORIGIN", "https://la-veinte-digital.vercel.app"
)

MAX_HISTORY_LENGTH = 20
MAX_CONTENT_CHARS = 2000

app = FastAPI(
    title="Bot SNTSS (privado)",
    docs_url="/docs" if SHARED_SECRET else None,
    openapi_url="/openapi.json" if SHARED_SECRET else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "X-Bot-Secret"],
)


def _require_secret(x_bot_secret: str | None = Header(default=None)) -> None:
    if not SHARED_SECRET:
        raise HTTPException(status_code=503, detail="Servicio no configurado")
    if not x_bot_secret or not secrets.compare_digest(x_bot_secret, SHARED_SECRET):
        raise HTTPException(status_code=401, detail="No autorizado")


app.mount(
    "/static",
    StaticFiles(directory=os.path.join(BASE, "static")),
    name="static",
)


@app.get("/")
async def index():
    return FileResponse(os.path.join(BASE, "static", "index.html"))


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_CONTENT_CHARS)


class ConsultaRequest(BaseModel):
    # Pregunta canónica. Si no se envía, se deriva del historial por compatibilidad.
    question: str | None = Field(default=None, max_length=MAX_CONTENT_CHARS)
    history: List[Message] = Field(default_factory=list, max_length=MAX_HISTORY_LENGTH)


@app.post("/consulta")
async def endpoint_consulta(req: ConsultaRequest, x_bot_secret: str | None = Header(default=None)):
    _require_secret(x_bot_secret)
    history = req.history

    # La pregunta canónica viene explícitamente; si falta, se deriva del
    # último mensaje del usuario para mantener compatibilidad con clientes
    # anteriores y para detectar saludos antes de llamar al motor.
    question = req.question.strip() if req.question else None

    if not question:
        for msg in reversed(history):
            if msg.role == "user":
                question = msg.content.strip()
                break

    if not question:
        if history:
            return {"respuesta": "No pude encontrar tu pregunta en el historial."}
        return {"respuesta": "No recibí ninguna pregunta. ¿En qué puedo ayudar?"}

    if (
        len(history) <= 1
        and re.match(r"^(hola|buenos días|buenas tardes|buenas noches|hey|qué tal)\s*$", question, re.I)
    ):
        return {
            "respuesta": (
                "¡Hola! 👋 Soy tu **Asistente SNTSS**, tu aliado en temas laborales del IMSS. "
                "Tengo acceso al **Contrato Colectivo de Trabajo** y a los **Estatutos del SNTSS** "
                "para orientarte sobre tus derechos, prestaciones y obligaciones. ¿En qué puedo ayudarte hoy?"
            )
        }

    historial_dicts = [h.model_dump() for h in history]
    respuesta = consulta_contrato(question, historial_dicts)
    return {"respuesta": respuesta}


@app.get("/health")
async def health(x_bot_secret: str | None = Header(default=None)):
    _require_secret(x_bot_secret)
    return {"status": "ok"}
