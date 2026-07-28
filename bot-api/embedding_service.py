import os
import fitz
from typing import List
from dotenv import load_dotenv

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from langchain_core.tools import create_retriever_tool
from langgraph.prebuilt import create_react_agent

load_dotenv()

HERE = os.path.dirname(os.path.abspath(__file__))
PDF_FOLDER = os.path.join(HERE, "pdfs")
VECTORSTORE_FOLDER = os.path.join(HERE, "vectorstore")

def cargar_pdfs() -> List[str]:
    textos = []
    if not os.path.exists(PDF_FOLDER):
        print(f"Advertencia: La carpeta {PDF_FOLDER} no existe. Creándola...")
        os.makedirs(PDF_FOLDER, exist_ok=True)
        return textos

    for fname in os.listdir(PDF_FOLDER):
        if fname.lower().endswith(".pdf"):
            ruta_pdf = os.path.join(PDF_FOLDER, fname)
            try:
                doc = fitz.open(ruta_pdf)
                contenido = "".join(page.get_text() for page in doc)
                textos.append(contenido)
            except Exception as e:
                print(f"Error al leer {fname}: {e}")
    return textos

def generar_y_guardar_vectorstore() -> None:
    print("Iniciando el procesamiento de PDFs...")
    textos = cargar_pdfs()

    if not textos:
        print("No se encontraron PDFs o están vacíos. No se generará el vectorstore.")
        return

    splitter = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=300)
    docs = []
    for t in textos:
        docs.extend(splitter.create_documents([t]))

    print(f"Generando embeddings para {len(docs)} fragmentos de texto...")
    embeddings = OpenAIEmbeddings()

    os.makedirs(VECTORSTORE_FOLDER, exist_ok=True)
    db = FAISS.from_documents(docs, embeddings)
    db.save_local(VECTORSTORE_FOLDER)
    print("Vectorstore generado y guardado exitosamente en:", VECTORSTORE_FOLDER)

def consulta_contrato(question: str, history: List[dict]) -> str:
    embeddings = OpenAIEmbeddings()
    try:
        db = FAISS.load_local(
            VECTORSTORE_FOLDER,
            embeddings,
            allow_dangerous_deserialization=True
        )
    except Exception:
        return "⚠️ Error: No se encontró la base de datos de documentos. Por favor, reinicia la aplicación para generarla."

    retriever = db.as_retriever(search_type="mmr", search_kwargs={"k": 6, "fetch_k": 20})

    herramienta_estatutos = create_retriever_tool(
        retriever,
        "buscar_estatutos_sntss",
        "Usa ESTA herramienta SIEMPRE para buscar información sobre: derechos sindicales, obligaciones de los trabajadores, estructura del sindicato, asambleas, comités, elecciones, sanciones, y cualquier tema relacionado con los ESTATUTOS del SNTSS (Sindicato Nacional de Trabajadores del Seguro Social). Si la pregunta es sobre el sindicato, DEBES usarla."
    )
    tools = [herramienta_estatutos]

    llm = ChatOpenAI(temperature=0.0, model="gpt-4o-mini")
    agent_executor = create_react_agent(llm, tools)

    system_message = """Eres un asesor experto en los ESTATUTOS del Sindicato Nacional de Trabajadores del Seguro Social (SNTSS).
Tu objetivo es ayudar a los trabajadores del IMSS resolviendo sus dudas sobre los estatutos sindicales de forma clara, precisa y directa.

REGLAS ESTRICTAS E INQUEBRANTABLES (CERO ALUCINACIONES):
1. FUENTE EXCLUSIVA: Tu respuesta debe basarse ÚNICA Y EXCLUSIVAMENTE en el texto recuperado al usar la herramienta 'buscar_estatutos_sntss'. Tienes ESTRICTAMENTE PROHIBIDO usar tu conocimiento general o inventar información.
2. MANEJO DE VACÍOS:
   - Si la herramienta devuelve información que responde parcialmente a la pregunta, entrégala aclarando que es la única referencia encontrada en los documentos.
   - Si la herramienta NO devuelve ninguna información relacionada con la pregunta, NO INVENTES NI DEDUZCAS NADA. Responde exactamente: «No encontré la referencia exacta en los estatutos cargados. ¿Podrías darme más detalles o usar el término técnico exacto de lo que buscas?»
3. CITAS PRECISAS: Siempre que fundamentes tu respuesta, especifica el número de artículo/cláusula y el nombre exacto del documento (ESTATUTOS SNTSS).
4. FORMATO:
   - Usa formato Markdown obligatoriamente.
   - Utiliza **negritas** para resaltar nombres de artículos, plazos y conceptos clave.
   - Usa viñetas para listar derechos, requisitos o pasos.
   - Mantén un tono profesional, empático e institucional."""

    mensajes_finales = [SystemMessage(content=system_message)]

    for msg in history:
        if msg.get("content") == question:
            continue
        if msg.get("role") == "user":
            mensajes_finales.append(HumanMessage(content=msg.get("content", "")))
        elif msg.get("role") == "assistant":
            mensajes_finales.append(AIMessage(content=msg.get("content", "")))

    mensajes_finales.append(HumanMessage(content=question))

    try:
        resultado = agent_executor.invoke({"messages": mensajes_finales})
        return resultado["messages"][-1].content
    except Exception as e:
        return f"Lo siento, hubo un problema al consultar los documentos: {str(e)}"
