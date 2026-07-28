import os
import re
from typing import List, Literal
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from embedding_service import generar_y_guardar_vectorstore, consulta_contrato

load_dotenv()
BASE = os.getcwd()
VECTORSTORE_DIR = os.path.join(BASE, "vectorstore")

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.path.exists(VECTORSTORE_DIR):
        print("Vectorstore no encontrado. Generando uno nuevo a partir de los PDFs...")
        generar_y_guardar_vectorstore()
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/static",
    StaticFiles(directory=os.path.join(BASE, "static")),
    name="static"
)

@app.get("/")
async def index():
    return FileResponse(os.path.join(BASE, "static", "index.html"))

@app.head("/")
async def head_index():
    return FileResponse(os.path.join(BASE, "static", "index.html"))

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class ConsultaRequest(BaseModel):
    history: List[Message]

@app.post("/consulta")
async def endpoint_consulta(req: ConsultaRequest):
    history = req.history
    if not history:
        return {"respuesta": "No recibí ninguna pregunta. ¿En qué puedo ayudar?"}

    if len(history) == 1 and history[0].role == "user":
        saludo = history[0].content.strip()
        if re.match(r'^(hola|buenos días|buenas tardes|buenas noches|hey|qué tal)\s*$', saludo, re.I):
            return {
                "respuesta": (
                    "¡Hola! 👋 Soy tu **Asistente SNTSS**, tu aliado en temas laborales del IMSS. "
                    "Tengo acceso al **Contrato Colectivo de Trabajo** y a los **Estatutos del SNTSS** "
                    "para orientarte sobre tus derechos, prestaciones y obligaciones. ¿En qué puedo ayudarte hoy?"
                )
            }

    question = None
    for msg in reversed(history):
        if msg.role == "user":
            question = msg.content.strip()
            break

    if not question:
        return {"respuesta": "No pude encontrar tu pregunta en el historial."}

    try:
        historial_dicts = [h.model_dump() if hasattr(h, 'model_dump') else h.dict() for h in history]
        respuesta = consulta_contrato(question, historial_dicts)
        return {"respuesta": respuesta}

    except Exception as e:
        return {"error": f"Ocurrió un error interno: {str(e)}"}

@app.get("/health")
async def health():
    return {"status": "ok"}
