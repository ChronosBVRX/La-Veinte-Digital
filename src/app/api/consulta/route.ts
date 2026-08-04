import { NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { parseConsultaRequest, type ConsultaMessage } from "@/shared/contracts/consulta"
import { retrieveTopChunks } from "@/features/asistente/lib/rag"

const MAX_HISTORY_LENGTH = 20
const MAX_QUESTION_CHARS = 2000
const DAILY_QUOTA_PER_USER = 100
const OPENAI_TIMEOUT_MS = 30000

const NO_INFORMATION_RESPONSE =
  "No encontré esa información específica en los documentos que tengo, pero puedo ayudarte con otros temas del CCT o los Estatutos. ¿Quieres intentar con otra pregunta?"

type QuotaResult = "allowed" | "exceeded" | "error"

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no está configurada")
  }
  return new OpenAI({ apiKey })
}

function newRequestId(): string {
  return `con-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

async function consumeQuota(userId: string): Promise<QuotaResult> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("increment_api_usage", {
      p_user: userId,
      p_route: "consulta",
      p_limit: DAILY_QUOTA_PER_USER,
    })
    if (error) {
      console.error("[consulta] error de cuota:", error.message)
      return "error"
    }
    return data === true ? "allowed" : "exceeded"
  } catch (err) {
    console.error("[consulta] error inesperado de cuota:", err instanceof Error ? err.message : err)
    return "error"
  }
}

/**
 * Backend Python privado (opcional). El navegador nunca lo llama directo:
 * pasa por /api/consulta, que lo invoca con el secreto interno cuando
 * BOT_API_URL está configurado. Si no responde, se degrada al motor
 * directo de OpenAI dentro de Next.js.
 */
async function respondViaPythonBot(
  history: ConsultaMessage[],
  question: string,
  requestId: string,
): Promise<string | null> {
  const botUrl = process.env.BOT_API_URL
  const secret = process.env.BOT_API_SHARED_SECRET
  if (!botUrl || !secret) return null

  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)
    const res = await fetch(`${botUrl.replace(/\/$/, "")}/consulta`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bot-Secret": secret,
      },
      body: JSON.stringify({ history: history.slice(-MAX_HISTORY_LENGTH) }),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.warn(`[consulta] ${requestId} bot python ${res.status}, usando motor directo`)
      return null
    }
    const data = await res.json()
    if (typeof data.respuesta !== "string" || data.respuesta.length === 0) {
      console.warn(`[consulta] ${requestId} bot python sin respuesta, usando motor directo`)
      return null
    }
    return data.respuesta
  } catch (err) {
    console.warn(
      `[consulta] ${requestId} bot python no disponible, usando motor directo:`,
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

async function respondDirect(
  history: ConsultaMessage[],
  question: string,
  requestId: string,
): Promise<NextResponse> {
  try {
    const openai = getOpenAI()
    const signal = withTimeout(OPENAI_TIMEOUT_MS)
    const embeddingResp = await openai.embeddings.create(
      {
        model: "text-embedding-ada-002",
        input: question,
      },
      { signal },
    )
    const queryEmbedding = embeddingResp.data[0].embedding

    const relevantChunks = retrieveTopChunks(queryEmbedding, question)
    if (relevantChunks.length === 0) {
      return NextResponse.json({ respuesta: NO_INFORMATION_RESPONSE })
    }
    const context = relevantChunks.join("\n\n---\n\n")

    const systemPrompt = `Eres el Asistente SNTSS, un aliado confiable y cercano para los trabajadores del IMSS afiliados al Sindicato Nacional de Trabajadores del Seguro Social. Tu personalidad es amigable, empática y profesional — hablas como un compañero que conoce bien los derechos laborales y siempre busca ayudar.

Tienes conocimiento de estos documentos: **Contrato Colectivo de Trabajo (CCT)** del IMSS, **Estatutos del SNTSS**, reglamentos varios (Escalafón, Interior de Trabajo, Becas, etc.), Catálogo, Profesiogramas, Tabulador de sueldos y Régimen de Jubilaciones y Pensiones. Cada fragmento del contexto inicia con el nombre del documento entre corchetes, ej: [Clausulas.pdf], [estatutos-sntss-2022.pdf]

REGLAS ESTRICTAS (CERO ALUCINACIONES):
1. FUENTE EXCLUSIVA: Responde ÚNICA Y EXCLUSIVAMENTE con base en el CONTEXTO que se te proporciona. Tienes ESTRICTAMENTE PROHIBIDO usar tu conocimiento general o inventar información.
2. CITAS LITERALES: Cita solo cláusulas, artículos y nombres de documento que aparezcan literalmente en el CONTEXTO. Nunca cites un documento, cláusula o artículo que no esté en el contexto. No agregues números, cifras, plazos o montos que no provengan del contexto.
3. MANEJO DE VACÍOS:
   - Si el contexto responde parcialmente, entrégala aclarando que es la única referencia encontrada en los documentos.
   - Si el contexto NO contiene nada relacionado, responde de forma empática: "${NO_INFORMATION_RESPONSE}"
4. FORMATO Y TONO:
   - Responde SIEMPRE en español, conversacional y cercano, como un compañero de trabajo.
   - Usa **negritas** para conceptos clave, listas con viñetas para derechos/obligaciones y párrafos cortos.
   - Usa emojis con moderación (✅, 📋, ⚖️).
   - Cuando el trabajador hable de sus derechos, vacaciones o prestaciones, demuestra empatía.
   - Si la pregunta es vaga o general, ofrece orientación con preguntas de seguimiento. No seas robótico.

Contexto:
${context}`

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-MAX_HISTORY_LENGTH).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ]

    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.0,
        messages,
      },
      { signal },
    )

    const respuesta = completion.choices[0]?.message?.content ?? "Lo siento, no pude generar una respuesta."

    return NextResponse.json({ respuesta })
  } catch {
    return NextResponse.json(
      { error: "Ocurrió un error al procesar tu consulta.", requestId },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  const requestId = newRequestId()

  const auth = await requireUser()
  if (auth.response) {
    return auth.response
  }
  const user = auth.user

  const quota = await consumeQuota(user.id)
  if (quota === "exceeded") {
    return NextResponse.json(
      { error: "Cuota diaria alcanzada. Intenta mañana.", requestId },
      { status: 429 },
    )
  }
  if (quota === "error") {
    return NextResponse.json(
      { error: "No se pudo verificar tu cuota. Intenta de nuevo en unos minutos.", requestId },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "El cuerpo debe ser JSON válido.", requestId },
      { status: 400 },
    )
  }

  const parsed = parseConsultaRequest(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, requestId }, { status: 400 })
  }

  const { history } = parsed.value

  const question = [...history].reverse().find((m) => m.role === "user")?.content?.trim()
  if (!question) {
    return NextResponse.json({ error: "No pude encontrar tu pregunta.", requestId }, { status: 400 })
  }

  if (question.length > MAX_QUESTION_CHARS) {
    return NextResponse.json(
      { error: `La pregunta excede los ${MAX_QUESTION_CHARS} caracteres.`, requestId },
      { status: 400 },
    )
  }

  const pythonResponse = await respondViaPythonBot(history, question, requestId)
  if (pythonResponse !== null) {
    return NextResponse.json({ respuesta: pythonResponse })
  }

  return await respondDirect(history, question, requestId)
}
