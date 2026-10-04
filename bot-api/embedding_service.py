import os
from typing import List, Optional
from dotenv import load_dotenv

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS

load_dotenv()

HERE = os.path.dirname(os.path.abspath(__file__))
PDF_FOLDER = os.path.join(HERE, "pdfs")
VECTORSTORE_FOLDER = os.path.join(HERE, "vectorstore")
TRUST_MARKER_FILE = os.path.join(VECTORSTORE_FOLDER, ".trusted")
MAX_HISTORY_MESSAGES = 20
MAX_QUESTION_CHARS = 2000
MAX_RETRIEVED_CHUNKS = 6
MIN_RELEVANCE_SCORE = 0.4
NO_INFORMATION_RESPONSE = (
    "No encontré esa información específica en los documentos que tengo, "
    "pero puedo ayudarte con otros temas del CCT o los Estatutos. "
    "¿Quieres intentar con otra pregunta?"
)


def _vectorstore_is_trusted() -> bool:
    """El pickle de FAISS solo se carga si el directorio fue generado por el
    script de mantenimiento (regenerate.py / generar_y_guardar_vectorstore),
    que escribe un marcador de confianza al guardar. Sin el marcador, el
    deserializador peligroso nunca se activa."""
    return os.path.isfile(TRUST_MARKER_FILE)


def _split_pages_with_metadata(fname: str, doc) -> List[tuple]:
    """Divide el documento por páginas conservando metadata de documento,
    página y sección (CLAUSULA/ARTICULO) cuando se detecta."""
    import re

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=300,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    result: List[tuple] = []
    for page_index, page in enumerate(doc):
        text = page.get_text()
        if not text.strip():
            continue
        section = None
        m = re.search(r"\b(CLAUSULA|CLÁUSULA|ARTÍCULO|ARTICULO)\s+\d+", text, re.I)
        if m:
            section = m.group(0)
        for chunk in splitter.split_text(text):
            if chunk.strip():
                result.append(
                    (chunk, {"document": fname, "page": page_index + 1, "section": section})
                )
    return result


def _split_document(fname: str, text: str):
    """Divide un documento completo conservando metadata de documento y
    sección cuando la estructura lo permite."""
    import re

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=300,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    parts = re.split(r"(?=(?:CL[AÁ]USULA|ART[ÍI]CULO)\s+\d+)", text, flags=re.I)
    if len(parts) < 3:
        for chunk in splitter.split_text(text):
            if chunk.strip():
                yield chunk, {"document": fname, "page": None, "section": None}
        return

    buffer = ""
    section = None
    for part in parts:
        if not part.strip():
            continue
        m = re.match(r"\s*((?:CL[AÁ]USULA|ART[ÍI]CULO)\s+\d+)", part, re.I)
        new_section = m.group(1) if m else None
        if new_section is not None:
            if buffer:
                yield buffer.strip(), {"document": fname, "page": None, "section": section}
            buffer = part
            section = new_section
        else:
            buffer += "\n\n" + part
    if buffer.strip():
        yield buffer.strip(), {"document": fname, "page": None, "section": section}


def cargar_pdfs() -> List[str]:
    textos = []
    if not os.path.exists(PDF_FOLDER):
        os.makedirs(PDF_FOLDER, exist_ok=True)
        return textos

    for fname in os.listdir(PDF_FOLDER):
        if fname.lower().endswith(".pdf"):
            ruta_pdf = os.path.join(PDF_FOLDER, fname)
            try:
                import fitz

                doc = fitz.open(ruta_pdf)
                contenido = "\n".join(page.get_text() for page in doc)
                textos.append(contenido)
            except Exception as e:
                print(f"Error al leer {fname}: {e}")
    return textos


def generar_y_guardar_vectorstore() -> None:
    """Genera el vectorstore FAISS. Solo se ejecuta manualmente desde
    regenerate.py o el script de despliegue; NUNCA en el arranque del
    servidor. Conserva metadata de documento/página/sección y escribe el
    marcador .trusted que autoriza la deserialización posterior."""
    import fitz

    print("Iniciando el procesamiento de PDFs...")
    if not os.path.exists(PDF_FOLDER):
        print("La carpeta pdfs/ no existe. No se generará el vectorstore.")
        return

    docs = []
    for fname in sorted(os.listdir(PDF_FOLDER)):
        if not fname.lower().endswith(".pdf"):
            continue
        ruta_pdf = os.path.join(PDF_FOLDER, fname)
        try:
            doc = fitz.open(ruta_pdf)
            text = "\n".join(page.get_text() for page in doc)
        except Exception as e:
            print(f"Error al leer {fname}: {e}")
            continue
        for chunk, metadata in _split_document(fname, text):
            from langchain_core.documents import Document

            docs.append(Document(page_content=chunk, metadata=metadata))
        print(f"  {fname}: {len(doc)} páginas procesadas")

    if not docs:
        print("No se encontraron PDFs o están vacíos. No se generará el vectorstore.")
        return

    print(f"Generando embeddings para {len(docs)} fragmentos de texto...")
    embeddings = OpenAIEmbeddings()

    os.makedirs(VECTORSTORE_FOLDER, exist_ok=True)
    db = FAISS.from_documents(docs, embeddings)
    db.save_local(VECTORSTORE_FOLDER)
    with open(TRUST_MARKER_FILE, "w", encoding="utf-8") as f:
        f.write("generado por scripts de mantenimiento de bot-api\n")
    print("Vectorstore generado y guardado exitosamente en:", VECTORSTORE_FOLDER)


def _cargar_vectorstore(embeddings) -> Optional[FAISS]:
    if not _vectorstore_is_trusted():
        return None
    try:
        return FAISS.load_local(
            VECTORSTORE_FOLDER,
            embeddings,
            allow_dangerous_deserialization=True,
        )
    except Exception as e:
        print(f"Error cargando vectorstore: {e}")
        return None


def _formatear_contexto(resultados) -> str:
    bloques = []
    for i, doc in enumerate(resultados, start=1):
        metadata = doc.metadata or {}
        fname = metadata.get("document", "documento")
        page = metadata.get("page")
        section = metadata.get("section")
        cabecera = f"[{fname}]"
        if page:
            cabecera += f" (página {page})"
        if section:
            cabecera += f" — {section}"
        bloques.append(f"{cabecera}\n{doc.page_content}")
    return "\n\n---\n\n".join(bloques)


def _recuperar_fragmentos(db, question: str):
    """Recupera fragmentos con umbral mínimo de relevancia. Preguntas sin
    relación con los documentos devuelven lista vacía para que el asistente
    responda honestamente en lugar de inventar o usar contexto irrelevante."""
    pares = db.similarity_search_with_relevance_scores(
        question, k=MAX_RETRIEVED_CHUNKS
    )
    return [doc for doc, score in pares if score >= MIN_RELEVANCE_SCORE]


def consulta_contrato(question: str, history: List[dict]) -> str:
    if len(question) > MAX_QUESTION_CHARS:
        return "Lo siento, tu pregunta es demasiado larga. Intenta resumirla en menos de 2000 caracteres."

    embeddings = OpenAIEmbeddings()
    db = _cargar_vectorstore(embeddings)
    if db is None:
        return "⚠️ Error: La base de documentos no está disponible en este entorno. Intenta de nuevo más tarde."

    resultados = _recuperar_fragmentos(db, question)
    if not resultados:
        return NO_INFORMATION_RESPONSE
    contexto = _formatear_contexto(resultados)

    llm = ChatOpenAI(temperature=0.0, model="gpt-4o-mini")

    system_message = f"""Eres el **Asistente SNTSS**, un compañero sindical cercano, amable y positivo del Sindicato Nacional de Trabajadores del Seguro Social. Tu misión es escuchar, dar tranquilidad y orientar al trabajador con respuestas siempre útiles, claras y alentadoras. Hablas en español de México cotidiano y respetuoso, usando **negritas** para lo importante y emojis con moderación (😊, ✅, 📋).

Tienes conocimiento del **Contrato Colectivo de Trabajo (CCT)** del IMSS, **Estatutos del SNTSS**, reglamentos, Catálogo, Profesiogramas, Tabulador de sueldos y Régimen de Jubilaciones y Pensiones.

LENGUAJE SENCILLO (CERO TECNICISMOS):
- Explica todo como se lo platicarías a un compañero de trabajo que no conoce de leyes ni del Contrato Colectivo.
- Prohibido usar jerga técnica o burocrática sin traducirla ("percepciones ordinarias", "fundamento contractual explícito", "normatividad bilateral", "corpus", "síntesis deductiva").
- Traduce siempre los términos oficiales a palabras sencillas:
  * "Tabulador / Sueldo Hora-Mes": explícalo como el **sueldo base mensual en papel** según su jornada (ej. 6.5 u 8 horas), aclarando siempre en positivo que **en su pago real (tarjetón) recibe más** porque se suman prestaciones del contrato (ayuda de renta, antigüedad, puntualidad, asistencia o pagos extra por áreas de riesgo).
  * "Profesiograma": llámalo **las actividades y requisitos oficiales de tu puesto**.
  * "Infectocontagiosidad / Emanaciones radiactivas": llámalo **pago o protección extra por trabajar en áreas con riesgo de contagio o radiación**.
  * "Cláusula / Artículo": explícalo como **la regla de tu Contrato Colectivo** que te respalda, indicando su número exacto.

REGLAS ESTRICTAS (CERO ALUCINACIONES Y ACTITUD SIEMPRE POSITIVA):
1. FUENTE EXCLUSIVA: Responde ÚNICA Y EXCLUSIVAMENTE con base en el CONTEXTO que se te proporciona. Tienes ESTRICTAMENTE PROHIBIDO usar conocimiento general o inventar montos, plazos o derechos.
2. CITAS LITERALES: Cita solo reglas, cláusulas, artículos y documentos que aparezcan literalmente en el CONTEXTO.
3. RESPUESTA SIEMPRE POSITIVA Y ÚTIL:
   - Si el contexto tiene solo una parte de lo que busca el trabajador, comparte primero con entusiasmo todo lo útil que sí aparece en el CONTEXTO y oriéntalo amablemente sobre el siguiente paso (revisar su Tarjetón, usar las calculadoras o acercarse a su representación sindical).
   - Si el contexto NO contiene nada relacionado, responde de forma cálida: "{NO_INFORMATION_RESPONSE}"
4. DISTINCIÓN LABORAL Y ÁMBITO: Distingue con claridad entre personal de base y de confianza. Enfócate siempre en los derechos del trabajador del IMSS (CCT y Estatutos SNTSS).

Contexto:
{contexto}
"""

    mensajes: List[dict] = [{"role": "system", "content": system_message}]
    for msg in history[-MAX_HISTORY_MESSAGES:]:
        if msg.get("content") == question:
            continue
        role = msg.get("role")
        if role not in ("user", "assistant"):
            continue
        content = str(msg.get("content", ""))[:MAX_QUESTION_CHARS]
        if content.strip():
            mensajes.append({"role": role, "content": content})
    mensajes.append({"role": "user", "content": question})

    try:
        respuesta = llm.invoke(mensajes)
        return respuesta.content
    except Exception:
        return "Lo siento, hubo un problema al consultar los documentos. Intenta de nuevo en unos momentos."
