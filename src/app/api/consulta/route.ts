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

/** Fail-closed tras validación de citas sin resultado (punto 18+.5). */
const CITATION_FAILED_RESPONSE =
  "Encontré información relacionada en el corpus, pero no pude validar con suficiente seguridad las referencias de la respuesta. Prefiero no darte una orientación normativa sin fuentes verificables. Puedes intentarlo de nuevo o reformular la pregunta."

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

async function respondDirect(history: ConsultaMessage[], question: string, requestId: string, userId: string): Promise<NextResponse> {
  const t0 = performance.now()
  const intent = classifyRetrievalIntent(question)
  const obs = baseObservability(intent)
  try {
    const openai = getOpenAI()
    const refs = extractExactRefs(question)

    // ── 1. FAST PATH: EXACT_LOOKUP → 0 embedding, 0 LLM ──
    if (intent === "EXACT_LOOKUP") {
      const { sources } = await retrieveHybrid(question, null, intent, refs, 3)
      obs.fastPath = true
      obs.embeddingSkipped = true
      obs.evidenceCount = sources.length
      obs.evidenceChars = sources.reduce((a, s) => a + s.fragmento.length, 0)
      obs.retrievalMs = 0 // no medido en fastpath sin embedding
      obs.totalMs = performance.now() - t0
      // respuesta determinista server-side (sin LLM)
      const respuesta = fastLookupAnswer(sources)
      return privateJson({ respuesta, fuentes: fuentesPayload(sources, []), chips: [] })
    }

    // ── 2. EMBEDDING (LRU) ──
    const emb = await embedQueryLru(question, intent)
    obs.embeddingSkipped = emb.skipped
    obs.embeddingCacheHit = emb.cacheHit
    obs.embeddingMs = emb.ms

    // ── 3. RETRIEVAL HÍBRIDO (1 RPC) ──
    const { sources, rpcMs } = await retrieveHybrid(question, emb.embedding, intent, refs, 8)
    obs.retrievalMs = rpcMs
    obs.evidenceCount = sources.length
    obs.evidenceChars = sources.reduce((a, s) => a + s.fragmento.length, 0)

    // ── 4. FAIL CLOSED: 0 evidence o evidencia irrelevante → 0 LLM ──
    // Umbral de relevancia: si ni la mejor evidencia alcanza puntaje
    // significativo, no hay contexto real. Preguntas reales ~157-219;
    // consultas sin relación ~109-118. 140 separa ambos grupos sin falsos
    // positivos (evita responder con respaldo inventado).
    const MIN_RELEVANT_SCORE = 140
    if (sources.length === 0 || sources[0].score < MIN_RELEVANT_SCORE) {
      obs.totalMs = performance.now() - t0
      return privateJson({ respuesta: NO_EVIDENCE_RESPONSE, fuentes: [], chips: [] })
    }

    // ── 5. CONTEXTO COMPACTO + PROMPT DINÁMICO ──
    const compactEvidence = buildCompactEvidence(sources)
    const systemPrompt = buildPrompt(intent, compactEvidence)
    const trimmedHistory = history.slice(-6)
    obs.historyChars = trimmedHistory.reduce((a, m) => a + m.content.length, 0)

    const messages = buildMessages(systemPrompt, trimmedHistory)

    const ac = classifyAcompañamiento(question, intent)
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
    let respuesta = comp.text
    if (!respuesta) respuesta = "Lo siento, no pude generar una respuesta."

    // ── 7. VALIDACIÓN DE CITAS + FAIL-CLOSED. Sin judge LLM. Si la primera
    //        pasada no cita, UNA sola regeneración (punto 18); si tras ella
    //        sigue sin cita válida → no se entrega texto normativo sin fuente
    //        validada (punto 18+.5). Máximo 2 llamadas LLM. ──
    const first = validateCitations(respuesta, sources)
    let retries = 0
    let regenText: string | null = null
    if (first.citedIds.length === 0 && sources.length > 0) {
      retries = 1
      const regenMessages = [{ role: "system", content: messages[0].content + "\n\nIMPORTANTE: cita al menos una vez con [S#] cada afirmación factual. Si no puedes citar, responde de forma breve." }, ...messages.slice(1)] as OpenAI.Chat.Completions.ChatCompletionMessageParam[]
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
      return privateJson({
        respuesta: CITATION_FAILED_RESPONSE,
        fuentes: fuentesPayload(sources, []),
        chips: [],
      })
    }
    const respuestaFinal = outcome.respuesta
    const citedIds = outcome.citedIds
    obs.retryCount = retries
    obs.citationFailClosed = false
    obs.citationValidationPassed = citedIds.length > 0 || sources.length === 0

    obs.totalMs = performance.now() - t0
    logObservability(requestId, userId, obs)

    const chips = ac.chips.slice(0, 4)
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
  return `Esto es lo que encontré en la normativa:\n\n[S1] ${s.documento}${loc ? ` · ${loc}` : ""}\n${s.fragmento}`
}

async function runCompletion(openai: OpenAI, messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], maxTokens: number): Promise<{ text: string; ttft: number; total: number }> {
  const t = performance.now()
  const stream = await withAbortTimeout(ASSISTANT_POLICY.completionTimeoutMs, (signal) =>
    openai.chat.completions.create({ model: ASSISTANT_POLICY.chatModel, temperature: 0, messages, stream: true, max_tokens: maxTokens }, { signal }),
  )
  let text = ""
  let ttft = 0
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta && ttft === 0) ttft = performance.now() - t
    if (delta) text += delta
  }
  return { text, ttft, total: performance.now() - t }
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

  return await respondDirect(history, question, requestId, user.id)
}
