import { NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { parseConsultaRequest, type ConsultaMessage } from "@/shared/contracts/consulta"
import {
  fuentesPayload,
  validateCitations,
  finalizeCitation,
  classifyRetrievalIntent,
  extractExactRefs,
  buildCompactEvidence,
  type RetrievedSource,
} from "@/features/asistente/lib/retrieval-sources"
import {
  classifyAcompañamiento,
  isContinuation,
} from "@/features/asistente/lib/acompanamiento"
import {
  fetchSanitizedWorkerProfile,
  formatWorkerProfilePrompt,
  type SanitizedWorkerProfile,
} from "@/features/asistente/lib/worker-context-adapter"
import { normalizeForRetrieval } from "@/features/asistente/lib/canonical-dictionary"
import { recommendPlatformTools } from "@/features/asistente/lib/platform-tools"
import { APP_COMMIT_SHA, RAG_BACKEND, LLM_PROVIDER } from "@/features/asistente/lib/app-version"
import { ASSISTANT_POLICY, withAbortTimeout } from "@/features/asistente/lib/assistant-policy"
import {
  embedQueryLru,
  retrieveHybrid,
  buildMessages,
  buildPrompt,
  NO_EVIDENCE_RESPONSE,
  outputTokensForIntent,
  type MotorObservability,
} from "@/features/asistente/lib/motor"
import { classifyAssistantError, logAssistantError } from "@/features/asistente/lib/assistant-errors"
import { privateJson, privateJsonError } from "@/shared/lib/api-response"

type QuotaResult = "allowed" | "exceeded" | "error"

/** Respuesta cálida de respaldo si no hay fragmentos citables (punto 18+.5). */
const CITATION_FAILED_RESPONSE =
  "¡Con mucho gusto te apoyo, compañero! 😊 Para darte el dato exacto y seguro de nuestro Contrato Colectivo, cuéntame un poquito más de detalle (por ejemplo: el nombre de tu puesto o categoría, tu jornada de 6.5 u 8 horas, o qué trámite quieres revisar). ¡Aquí estoy para orientarte paso a paso!"

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY no está configurada")
  return new OpenAI({ apiKey })
}

function newRequestId(): string {
  return `con-${crypto.randomUUID()}`
}

async function consumeQuotaOnce(userId: string): Promise<QuotaResult> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("increment_api_usage", {
      p_user: userId,
      p_route: "consulta",
      p_limit: ASSISTANT_POLICY.dailyQuotaPerUser,
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

function getLastUserQuestion(history: ConsultaMessage[]): string | undefined {
  return [...history].reverse().find((m) => m.role === "user")?.content?.trim()
}

function baseObservability(intent: MotorObservability["intent"]): MotorObservability {
  return {
    intent,
    fastPath: false,
    embeddingSkipped: false,
    embeddingCacheHit: false,
    evidenceCount: 0,
    evidenceChars: 0,
    historyChars: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    embeddingMs: 0,
    retrievalMs: 0,
    llmTtftMs: 0,
    llmTotalMs: 0,
    totalMs: 0,
    provider: LLM_PROVIDER,
    model: ASSISTANT_POLICY.chatModel,
    thinkingMode: null,
    retryCount: 0,
    citationValidationPassed: false,
    citationFailClosed: false,
    outputBudgetTokens: outputTokensForIntent(intent),
    maxTokens: outputTokensForIntent(intent),
  }
}

function getQueryForRetrieval(history: ConsultaMessage[], question: string, intent: ReturnType<typeof classifyRetrievalIntent>): string {
  if (intent !== "FOLLOW_UP") return question
  // FOLLOW_UP muy corto ("y si?", "ya tengo mensajes") pierde contexto para FTS/vector.
  // Hereda la última pregunta sustantiva del historial para que el retrieval siga en el mismo caso.
  for (let i = history.length - 2; i >= 0; i--) {
    const m = history[i]
    if (m.role !== "user") continue
    const c = m.content.trim()
    if (c.length < 10) continue
    const prevIntent = classifyRetrievalIntent(c)
    if (prevIntent !== "FOLLOW_UP") return `${c}\n${question}`
  }
  const prev = [...history].reverse().find((m) => m.role === "user" && m.content.trim() !== question.trim())
  return prev ? `${prev.content.trim()}\n${question}` : question
}

async function respondDirect(
  history: ConsultaMessage[],
  question: string,
  requestId: string,
  userId: string,
  workerProfile?: SanitizedWorkerProfile,
): Promise<NextResponse> {
  const t0 = performance.now()
  const intent = classifyRetrievalIntent(question)
  const { expandedQuery, lexicalQuery } = normalizeForRetrieval(question, workerProfile)
  const retrievalQuery = getQueryForRetrieval(history, expandedQuery, intent)
  const ftsQuery = getQueryForRetrieval(history, lexicalQuery, intent)
  const obs = baseObservability(intent)
  try {
    const openai = getOpenAI()
    const refs = extractExactRefs(retrievalQuery)

    // ── 1. FAST PATH: EXACT_LOOKUP → 0 embedding, 0 LLM ──
    if (intent === "EXACT_LOOKUP") {
      const { sources } = await retrieveHybrid(ftsQuery, null, intent, refs, 3, question)
      obs.fastPath = true
      obs.embeddingSkipped = true
      obs.evidenceCount = sources.length
      obs.evidenceChars = sources.reduce((a, s) => a + s.fragmento.length, 0)
      obs.retrievalMs = 0 // no medido en fastpath sin embedding
      obs.totalMs = performance.now() - t0
      // respuesta determinista server-side (sin LLM)
      const respuesta = fastLookupAnswer(sources)
      return privateJson({ respuesta, fuentes: fuentesPayload(sources, sources[0] ? [sources[0].id] : []), chips: [] })
    }

    // ── 2. EMBEDDING (LRU) ──
    const emb = await embedQueryLru(retrievalQuery, intent)
    obs.embeddingSkipped = emb.skipped
    obs.embeddingCacheHit = emb.cacheHit
    obs.embeddingMs = emb.ms

    // ── 3. RETRIEVAL HÍBRIDO (1 RPC con RRF / fallback) ──
    const { sources, rpcMs } = await retrieveHybrid(ftsQuery, emb.embedding, intent, refs, 8, question)
    obs.retrievalMs = rpcMs
    obs.evidenceCount = sources.length
    obs.evidenceChars = sources.reduce((a, s) => a + s.fragmento.length, 0)

    // ── 4. FAIL CLOSED: 0 evidence o evidencia irrelevante → 0 LLM ──
    // Umbral de relevancia calibrado según backend (RRF ~10..60 vs suma legacy ~140..1000)
    const isRrf =
      sources.length > 0 &&
      Boolean(sources[0].origin && (sources[0].origin.includes("rrf") || sources[0].origin.includes("+")))
    const minScore = isRrf ? 10 : 140
    const ac = classifyAcompañamiento(question, intent)
    const toolRecs = recommendPlatformTools(question)
    const toolChips = toolRecs.map((t) => t.chipLabel)
    const chips = [...new Set([...toolChips, ...ac.chips])].slice(0, 4)

    if (sources.length === 0 || sources[0].score < minScore) {
      obs.totalMs = performance.now() - t0
      return privateJson({ respuesta: NO_EVIDENCE_RESPONSE, fuentes: [], chips })
    }

    // ── 5. CONTEXTO COMPACTO + PROMPT DINÁMICO CON PERFIL DEL TRABAJADOR ──
    const compactEvidence = buildCompactEvidence(sources)
    const workerProfilePrompt = workerProfile ? formatWorkerProfilePrompt(workerProfile) : undefined
    const systemPrompt = buildPrompt(intent, compactEvidence, workerProfilePrompt)
    const trimmedHistory = history.slice(-6)
    obs.historyChars = trimmedHistory.reduce((a, m) => a + m.content.length, 0)

    const messages = buildMessages(systemPrompt, trimmedHistory)

    const priorLabor = history.some((m) => m.role === "user" && /hostig|acoso|agresi|amenaz|sanci[oó]n|acta|jefe|fuera de categor|vacaciones|jornada|horas extra|riesgo de trabajo/i.test(m.content))
    // guía adicional de continuidad si aplica
    const cont = isContinuation(question, priorLabor)
    if (cont && !systemPrompt.includes("CONTINUIDAD")) {
      messages[0].content += "\n\nEl trabajador sigue contando un caso ya mencionado: reconoce lo aportado y continúa la misma línea."
    }

    // ── 6. LLM (1 llamada) con presupuesto de salida ──
    const maxTokens = outputTokensForIntent(intent)
    const comp = await runCompletion(openai, messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[], maxTokens)
    obs.llmTtftMs = comp.ttft
    obs.llmTotalMs = comp.total
    if (comp.provider) obs.provider = comp.provider
    if (comp.model) obs.model = comp.model
    let respuesta = comp.text
    if (!respuesta) respuesta = "Lo siento, no pude generar una respuesta."

    // ── 7. VALIDACIÓN DE CITAS + FAIL-CLOSED ──
    const first = validateCitations(respuesta, sources)
    let retries = 0
    let regenText: string | null = null
    if (first.citedIds.length === 0 && sources.length > 0) {
      retries = 1
      const regenMessages = [
        {
          role: "system",
          content:
            messages[0].content +
            "\n\nIMPORTANTE: Responde SIEMPRE en tono positivo y palabras sencillas para el trabajador. Comparte lo útil que aparece en el CONTEXTO e incluye OBLIGATORIAMENTE al menos una etiqueta [S1] (o [S2], etc.) al final de los datos tomados del contexto.",
        },
        ...messages.slice(1),
      ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[]
      const regen = await runCompletion(openai, regenMessages, maxTokens)
      if (regen.text) obs.llmTotalMs += regen.total
      regenText = regen.text ?? null
    }

    const outcome = finalizeCitation(respuesta, sources, regenText)
    if (outcome.kind === "fail_closed") {
      obs.retryCount = retries
      obs.citationFailClosed = true
      obs.citationValidationPassed = false
      obs.totalMs = performance.now() - t0
      logObservability(requestId, userId, obs)
      const fallbackPositivo = buildPositiveSourceFallback(sources)
      return privateJson({
        respuesta: fallbackPositivo.respuesta,
        fuentes: fuentesPayload(sources, fallbackPositivo.citedIds),
        chips,
      })
    }
    const respuestaFinal = outcome.respuesta
    const citedIds = outcome.citedIds
    obs.retryCount = retries
    obs.citationFailClosed = false
    obs.citationValidationPassed = citedIds.length > 0 || sources.length === 0

    obs.totalMs = performance.now() - t0
    logObservability(requestId, userId, obs)

    return privateJson({ respuesta: respuestaFinal, fuentes: fuentesPayload(sources, citedIds), chips })
  } catch (error) {
    obs.totalMs = performance.now() - t0
    logObservability(requestId, userId, obs)
    const classified = classifyAssistantError(error)
    logAssistantError({ requestId, userId, code: classified.code, retryable: classified.retryable, message: classified.internalMessage })
    return privateJsonError(classified.httpStatus, classified.publicMessage, requestId, classified.code)
  }
}

function fastLookupAnswer(sources: RetrievedSource[]): string {
  if (sources.length === 0) return NO_EVIDENCE_RESPONSE
  const s = sources[0]
  const loc = [s.numero, s.paginaInicio != null ? `pág. ${s.paginaInicio}` : null].filter(Boolean).join(" · ")
  return `¡Con gusto, compañero! 😊 Esto es lo que establece nuestro documento oficial:\n\n**[S1] ${s.documento}${loc ? ` · ${loc}` : ""}**\n${s.fragmento}`
}

/**
 * Si el modelo omitió la etiqueta [S#] pero existen fuentes verificadas del corpus,
 * entrega una orientación positiva basada directamente en el fragmento oficial [S1]
 * sin inventar ningún dato fuera del documento.
 */
function buildPositiveSourceFallback(sources: RetrievedSource[]): { respuesta: string; citedIds: string[] } {
  if (sources.length === 0) {
    return { respuesta: CITATION_FAILED_RESPONSE, citedIds: [] }
  }
  const s = sources[0]
  const loc = [s.numero, s.paginaInicio != null ? `pág. ${s.paginaInicio}` : null].filter(Boolean).join(" · ")
  const excerpt = s.fragmento.length > 600 ? `${s.fragmento.slice(0, 600).trim()}…` : s.fragmento.trim()
  return {
    respuesta: `¡Con mucho gusto te apoyo, compañero! 😊 Encontré esta referencia oficial en nuestros documentos que se relaciona con tu consulta:\n\n📋 **${s.documento}${loc ? ` (${loc})` : ""}** [S1]:\n${excerpt}\n\nSi quieres que revisemos un caso más específico (como tu categoría exacta, tu jornada de 6.5 u 8 horas o algún concepto de tu tarjetón), ¡escríbeme ese detalle y lo checamos juntos paso a paso!`,
    citedIds: [s.id],
  }
}

async function runCompletion(
  openai: OpenAI,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  maxTokens: number,
): Promise<{ text: string; ttft: number; total: number; provider?: string; model?: string }> {
  const t = performance.now()
  try {
    const stream = await withAbortTimeout(ASSISTANT_POLICY.completionTimeoutMs, (signal) =>
      openai.chat.completions.create(
        { model: ASSISTANT_POLICY.chatModel, temperature: 0, messages, stream: true, max_tokens: maxTokens },
        { signal },
      ),
    )
    let text = ""
    let ttft = 0
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta && ttft === 0) ttft = performance.now() - t
      if (delta) text += delta
    }
    return { text, ttft, total: performance.now() - t, provider: "openai", model: ASSISTANT_POLICY.chatModel }
  } catch (err) {
    const localUrl = process.env.LOCAL_LLM_URL || (process.env.NODE_ENV === "production" ? "http://127.0.0.1:11434" : null)
    if (localUrl) {
      try {
        console.warn("[consulta] OpenAI falló, recurriendo a motor local Ollama:", err instanceof Error ? err.message : err)
        return await runLocalOllamaCompletion(localUrl, messages, maxTokens)
      } catch (ollamaErr) {
        console.warn("[consulta] Fallback a Ollama local no disponible:", ollamaErr)
      }
    }
    throw err
  }
}

async function runLocalOllamaCompletion(
  baseUrl: string,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  maxTokens: number,
): Promise<{ text: string; ttft: number; total: number; provider: string; model: string }> {
  const t = performance.now()
  const model = process.env.LOCAL_LLM_MODEL || "qwen2.5:7b"
  const formatted = messages.map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }))

  const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: formatted,
      max_tokens: maxTokens,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(35000),
  })

  if (!resp.ok) throw new Error(`Ollama fallback HTTP ${resp.status}`)
  const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = data.choices?.[0]?.message?.content || ""
  return {
    text,
    ttft: performance.now() - t,
    total: performance.now() - t,
    provider: "ollama:local",
    model,
  }
}

function logObservability(requestId: string, userId: string, obs: MotorObservability): void {
  // Intencionalmente sin contenido sensible: solo métricas.
  console.log("[consulta:obs] " + [
    `req=${requestId}`, `user=${userId}`, `commit=${APP_COMMIT_SHA}`, `back=${RAG_BACKEND}`,
    `intent=${obs.intent}`, `fast=${obs.fastPath}`, `embSkip=${obs.embeddingSkipped}`, `cacheHit=${obs.embeddingCacheHit}`,
    `ev=${obs.evidenceCount}`, `evChars=${obs.evidenceChars}`, `histChars=${obs.historyChars}`,
    `inTk=${obs.inputTokens}`, `cachedTk=${obs.cachedInputTokens}`, `outTk=${obs.outputTokens}`, `reasonTk=${obs.reasoningTokens}`,
    `embMs=${Math.round(obs.embeddingMs)}`, `retMs=${Math.round(obs.retrievalMs)}`,
    `ttft=${Math.round(obs.llmTtftMs)}`, `llmMs=${Math.round(obs.llmTotalMs)}`, `total=${Math.round(obs.totalMs)}`,
    `prov=${obs.provider}`, `model=${obs.model}`, `think=${obs.thinkingMode ?? "-"}`,
    `retry=${obs.retryCount}`, `citeOK=${obs.citationValidationPassed}`, `citeFailClosed=${obs.citationFailClosed}`, `maxTk=${obs.maxTokens}`,
  ].join(" "))
}

export async function POST(req: Request) {
  const requestId = newRequestId()
  const auth = await requireUser()
  if (auth.response) return auth.response
  const user = auth.user

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return privateJsonError(400, "El cuerpo debe ser JSON válido.", requestId, "invalid_request")
  }

  const parsed = parseConsultaRequest(body)
  if (!parsed.ok) return privateJsonError(400, parsed.error, requestId, "invalid_request")

  const { history } = parsed.value
  const question = getLastUserQuestion(history)
  if (!question) return privateJsonError(400, "No pude encontrar tu pregunta.", requestId, "invalid_request")
  if (question.length > ASSISTANT_POLICY.maxQuestionChars) {
    return privateJsonError(400, `La pregunta excede los ${ASSISTANT_POLICY.maxQuestionChars} caracteres.`, requestId, "invalid_request")
  }

  // Cuota: UNA sola unidad por mensaje, aunque exista retry interno (punto 19).
  const quota = await consumeQuotaOnce(user.id)
  if (quota === "exceeded") return privateJsonError(429, "Cuota diaria alcanzada. Intenta mañana.", requestId, "quota_exceeded")
  if (quota === "error") {
    const classified = classifyAssistantError(new Error("No se pudo verificar la cuota"), "quota")
    logAssistantError({ requestId, userId: user.id, code: classified.code, retryable: classified.retryable, message: classified.internalMessage })
    return privateJsonError(classified.httpStatus, classified.publicMessage, requestId, classified.code)
  }

  // ── Perfil no sensible del trabajador para personalización ──
  let workerProfile: SanitizedWorkerProfile | undefined
  try {
    const supabase = await createClient()
    workerProfile = await fetchSanitizedWorkerProfile(user, supabase, requestId)
  } catch (err) {
    console.warn("[consulta] no se pudo cargar perfil de trabajador:", err instanceof Error ? err.message : err)
  }

  return await respondDirect(history, question, requestId, user.id, workerProfile)
}
