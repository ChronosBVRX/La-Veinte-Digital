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
import {
  isWorkerContextQuery,
  isPersonalPayslipReadQuery,
  isBenefitPersonalizableQuery,
  buildTarjetonSource,
  findTarjetonGuideSource,
} from "@/features/asistente/lib/tarjeton-knowledge"
import { normalizeForRetrieval } from "@/features/asistente/lib/canonical-dictionary"
import { recommendPlatformTools } from "@/features/asistente/lib/platform-tools"
import { APP_COMMIT_SHA, RAG_BACKEND, LLM_PROVIDER } from "@/features/asistente/lib/app-version"
import { ASSISTANT_POLICY, withAbortTimeout } from "@/features/asistente/lib/assistant-policy"
import { checkAssistantRateLimit } from "@/features/asistente/lib/rate-limit"
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

interface ResolvedConsultaLLM {
  client: OpenAI
  model: string
  provider: string
}

function resolveConsultaLLM(): ResolvedConsultaLLM {
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const customBaseUrl = process.env.OPENAI_BASE_URL?.trim()
  const explicitProvider = (process.env.LLM_PROVIDER ?? ASSISTANT_POLICY.llmProvider ?? "").toLowerCase().trim()

  // DeepSeek es la fuente de verdad principal salvo que se fuerce explícitamente openai sin deepseek o en pruebas aisladas.
  if (explicitProvider === "openai" && openaiKey) {
    return {
      client: new OpenAI({
        apiKey: openaiKey,
        ...(customBaseUrl ? { baseURL: customBaseUrl } : {}),
      }),
      model: process.env.OPENAI_CHAT_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || ASSISTANT_POLICY.chatModel,
      provider: customBaseUrl ? "custom" : "openai",
    }
  }

  if (deepseekKey) {
    return {
      client: new OpenAI({
        apiKey: deepseekKey,
        baseURL: process.env.DEEPSEEK_BASE_URL?.trim() || ASSISTANT_POLICY.deepseekBaseUrl,
      }),
      model: process.env.DEEPSEEK_MODEL?.trim() || ASSISTANT_POLICY.deepseekModel,
      provider: "deepseek",
    }
  }

  if (openaiKey) {
    return {
      client: new OpenAI({
        apiKey: openaiKey,
        ...(customBaseUrl ? { baseURL: customBaseUrl } : {}),
      }),
      model: process.env.OPENAI_CHAT_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || ASSISTANT_POLICY.chatModel,
      provider: customBaseUrl ? "custom" : "openai",
    }
  }

  throw new Error("DEEPSEEK_API_KEY (o OPENAI_API_KEY de respaldo) no están configuradas")
}

function newRequestId(): string {
  return `con-${crypto.randomUUID()}`
}

async function consumeQuotaOnce(
  userId: string,
  limit: number = ASSISTANT_POLICY.dailyQuotaPerUser,
): Promise<QuotaResult> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("increment_api_usage", {
      p_user: userId,
      p_route: "consulta",
      p_limit: limit,
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

function getQueryForRetrieval(
  history: ConsultaMessage[],
  rawQuestion: string,
  expandedOrLexical: string,
  intent: ReturnType<typeof classifyRetrievalIntent>,
): string {
  const words = rawQuestion.trim().split(/\s+/).length
  const startsConnective = history.length >= 3 && /^¿?\s*(y|pero|entonces|ahora\s+bien)\b/i.test(rawQuestion.trim())
  const hasAnaphora =
    startsConnective ||
    /\b(eso|es[ae]|mismo|tambi[eé]n|en ese caso|y para|y en|y de|me aplica|cu[aá]nto ser[ií]a|y si|y eso)\b/i.test(
      rawQuestion,
    ) ||
    (history.length >= 3 && words <= 6)

  if (intent !== "FOLLOW_UP" && !hasAnaphora) return expandedOrLexical
  // FOLLOW_UP o seguimiento anafórico hereda la última pregunta sustantiva del historial
  // para mantener el tema del caso en FTS y búsqueda vectorial.
  for (let i = history.length - 2; i >= 0; i--) {
    const m = history[i]
    if (m.role !== "user") continue
    const c = m.content.trim()
    if (c.length < 10) continue
    const prevIntent = classifyRetrievalIntent(c)
    if (prevIntent !== "FOLLOW_UP") return `${c}\n${expandedOrLexical}`
  }
  const prev = [...history].reverse().find((m) => m.role === "user" && m.content.trim() !== rawQuestion.trim())
  return prev ? `${prev.content.trim()}\n${expandedOrLexical}` : expandedOrLexical
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
  const retrievalQuery = getQueryForRetrieval(history, question, expandedQuery, intent)
  const ftsQuery = getQueryForRetrieval(history, question, lexicalQuery, intent)
  const obs = baseObservability(intent)
  try {
    const llm = resolveConsultaLLM()
    obs.provider = llm.provider
    obs.model = llm.model
    const refs = extractExactRefs(retrievalQuery)

    // ── 1. FAST PATH: EXACT_LOOKUP → 0 embedding, 0 LLM ──
    if (intent === "EXACT_LOOKUP") {
      const { sources, rpcMs } = await retrieveHybrid(ftsQuery, null, intent, refs, 3, question)
      obs.fastPath = true
      obs.embeddingSkipped = true
      obs.evidenceCount = sources.length
      obs.evidenceChars = sources.reduce((a, s) => a + s.fragmento.length, 0)
      obs.retrievalMs = rpcMs
      obs.totalMs = performance.now() - t0
      const toolChips = recommendPlatformTools(question).map((t) => t.chipLabel).slice(0, 3)
      const { respuesta, citedIds } = fastLookupAnswer(sources)
      obs.citationValidationPassed = citedIds.length > 0
      logObservability(requestId, userId, obs)
      return privateJson({ respuesta, fuentes: fuentesPayload(sources, citedIds), chips: toolChips })
    }

    // ── 2. EMBEDDING (LRU) ──
    const emb = await embedQueryLru(retrievalQuery, intent)
    obs.embeddingSkipped = emb.skipped
    obs.embeddingCacheHit = emb.cacheHit
    obs.embeddingMs = emb.ms

    // ── 3. RETRIEVAL HÍBRIDO (1 RPC con RRF / fallback) ──
    const { sources: rawSources, rpcMs } = await retrieveHybrid(ftsQuery, emb.embedding, intent, refs, 8, question)
    obs.retrievalMs = rpcMs

    // ── 3.1 ENRIQUECIMIENTO CON EXPEDIENTE/TARJETÓN Y GUÍA DE CONCEPTOS ──
    const isPersonalTarjetonQuery = isWorkerContextQuery(question)
    const guideSrc = findTarjetonGuideSource(question, workerProfile)

    // Si el usuario pide leer cifras personales de SU tarjetón/cobro pero aún no ha subido uno
    if (
      isPersonalPayslipReadQuery(question) &&
      !workerProfile?.hasTarjeton &&
      !guideSrc
    ) {
      obs.totalMs = performance.now() - t0
      const nombrePila = workerProfile?.nombre ? ` ${workerProfile.nombre.trim().split(" ")[0]}` : ""
      const puestoDesc = workerProfile?.categoria ? ` como **${workerProfile.categoria}**` : ""
      const respuesta = `¡Hola, compañero${nombrePila}! 😊 Veo que estás registrado en la plataforma${puestoDesc}, pero aún no cuentas con un tarjetón IMSS digital subido a tu expediente.\n\nPara que pueda decirte con total certeza cuánto cobraste, cuáles fueron tus percepciones y deducciones exactas o qué significan tus marcas, sube tu recibo en PDF aquí:\n\n📄 **[Subir mi Tarjetón IMSS](/profile/mi-informacion-laboral)**\n\nEn cuanto lo subas, podré responderte cualquier duda de tu pago al centavo.`
      return privateJson({
        respuesta,
        fuentes: [],
        chips: ["📄 Subir mi Tarjetón", "📊 Guía de conceptos", "🧮 Calculadoras"],
      })
    }

    const contextualSources: RetrievedSource[] = []
    let tarjetonInContext = false
    if (workerProfile?.tarjeton && (isPersonalTarjetonQuery || isBenefitPersonalizableQuery(question))) {
      const tarjetonSrc = buildTarjetonSource(workerProfile)
      if (tarjetonSrc) {
        contextualSources.push(tarjetonSrc)
        tarjetonInContext = true
      }
    }
    if (guideSrc) contextualSources.push(guideSrc)

    // ── 4. FAIL CLOSED: 0 evidence o evidencia irrelevante → 0 LLM ──
    // Evaluar relevancia real sobre rawSources (sin dejar que worker_tarjeton tape preguntas fuera de tema).
    const rawIsRrf =
      rawSources.length > 0 &&
      Boolean(rawSources[0].origin && (rawSources[0].origin.includes("rrf") || rawSources[0].origin.includes("+")))
    const rawMinScore = rawIsRrf ? 10 : 140
    const rawScoreOk = rawSources.length > 0 && rawSources[0].score >= rawMinScore
    const curatedOk = Boolean(guideSrc) || (isPersonalTarjetonQuery && Boolean(workerProfile?.tarjeton))

    const ac = classifyAcompañamiento(question, intent)
    const toolRecs = recommendPlatformTools(question)
    const toolChips = toolRecs.map((t) => t.chipLabel)
    const chips = [...new Set([...toolChips, ...ac.chips])].slice(0, 4)

    if (!rawScoreOk && !curatedOk) {
      obs.totalMs = performance.now() - t0
      return privateJson({ respuesta: NO_EVIDENCE_RESPONSE, fuentes: [], chips })
    }

    // Si la respuesta se apoya en evidencia curada, evitar mezclar chunks normativos débiles por debajo del umbral
    const filteredRaw = rawScoreOk
      ? rawSources
      : rawSources.filter((s) => s.score >= (rawIsRrf ? 8 : 90))
    const sources = [...contextualSources, ...filteredRaw].slice(0, 8)
    sources.forEach((s, i) => (s.id = `S${i + 1}`))

    obs.evidenceCount = sources.length
    obs.evidenceChars = sources.reduce((a, s) => a + s.fragmento.length, 0)

    // ── 5. CONTEXTO COMPACTO + PROMPT DINÁMICO CON PERFIL DEL TRABAJADOR ──
    const maxEvidenceChars = intent === "BROAD_TOPIC" || intent === "LABOR_CASE" ? 15_000 : 12_000
    const compactEvidence = buildCompactEvidence(sources, maxEvidenceChars)
    const workerProfilePrompt = workerProfile
      ? formatWorkerProfilePrompt(workerProfile, { tarjetonAlreadyInContext: tarjetonInContext })
      : undefined
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
    const comp = await runCompletion(llm, messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[], maxTokens)
    obs.llmTtftMs = comp.ttft
    obs.llmTotalMs = comp.total
    obs.inputTokens = comp.inputTokens
    obs.cachedInputTokens = comp.cachedInputTokens
    obs.outputTokens = comp.outputTokens
    obs.reasoningTokens = comp.reasoningTokens
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
            "\n\nOBLIGATORIO: incluye al menos una cita [S1] (o [S2]...) al final de los datos tomados del contexto.",
        },
        ...messages.slice(1),
      ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[]
      const regen = await runCompletion(llm, regenMessages, maxTokens)
      if (regen.text) {
        obs.llmTotalMs += regen.total
        obs.inputTokens += regen.inputTokens
        obs.cachedInputTokens += regen.cachedInputTokens
        obs.outputTokens += regen.outputTokens
        obs.reasoningTokens += regen.reasoningTokens
      }
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

function fastLookupAnswer(sources: RetrievedSource[]): { respuesta: string; citedIds: string[] } {
  if (sources.length === 0) return { respuesta: NO_EVIDENCE_RESPONSE, citedIds: [] }
  const first = sources[0]
  const sameSection = sources
    .slice(0, 2)
    .filter((s) => s.documentId === first.documentId && s.numero === first.numero)
  const citedIds = sameSection.map((s) => s.id)
  const loc = [first.numero, first.paginaInicio != null ? `pág. ${first.paginaInicio}` : null].filter(Boolean).join(" · ")
  const combinedText = sameSection.map((s) => s.fragmento.trim()).join("\n\n")
  const vigenciaNote = first.pendingReview ? " · [VIGENCIA POR REVISAR]" : ""
  return {
    respuesta: `¡Con gusto, compañero! 😊 Esto es lo que establece nuestro documento oficial:\n\n**[S1] ${first.documento}${loc ? ` · ${loc}` : ""}${vigenciaNote}**\n${combinedText}`,
    citedIds,
  }
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

interface CompletionUsageChunk {
  prompt_tokens?: number
  completion_tokens?: number
  prompt_cache_hit_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
  completion_tokens_details?: { reasoning_tokens?: number }
}

async function runCompletion(
  llm: ResolvedConsultaLLM,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  maxTokens: number,
): Promise<{
  text: string
  ttft: number
  total: number
  provider?: string
  model?: string
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
}> {
  const t = performance.now()
  try {
    const stream = await withAbortTimeout(ASSISTANT_POLICY.completionTimeoutMs, (signal) =>
      llm.client.chat.completions.create(
        {
          model: llm.model,
          temperature: 0,
          messages,
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: maxTokens,
        },
        { signal },
      ),
    )
    let text = ""
    let ttft = 0
    let inputTokens = 0
    let cachedInputTokens = 0
    let outputTokens = 0
    let reasoningTokens = 0
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta && ttft === 0) ttft = performance.now() - t
      if (delta) text += delta
      const usage = (chunk as unknown as { usage?: CompletionUsageChunk }).usage
      if (usage) {
        inputTokens = usage.prompt_tokens ?? inputTokens
        cachedInputTokens =
          usage.prompt_cache_hit_tokens ??
          usage.prompt_tokens_details?.cached_tokens ??
          cachedInputTokens
        outputTokens = usage.completion_tokens ?? outputTokens
        reasoningTokens = usage.completion_tokens_details?.reasoning_tokens ?? reasoningTokens
      }
    }
    return {
      text,
      ttft,
      total: performance.now() - t,
      provider: llm.provider,
      model: llm.model,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      reasoningTokens,
    }
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
): Promise<{
  text: string
  ttft: number
  total: number
  provider: string
  model: string
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
}> {
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
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
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

  // ── Rate-limiting por ráfagas para evitar saturación y escaneos automatizados ──
  const rateCheck = checkAssistantRateLimit(user.id)
  if (!rateCheck.allowed) {
    return privateJsonError(
      429,
      `Has enviado demasiadas consultas seguidas. Espera ${rateCheck.retryAfter ?? 60} segundos antes de continuar.`,
      requestId,
      "rate_limited",
    )
  }

  // ── Perfil no sensible del trabajador para personalización y cuota ──
  let workerProfile: SanitizedWorkerProfile | undefined
  try {
    const supabase = await createClient()
    workerProfile = await fetchSanitizedWorkerProfile(user, supabase, requestId)
  } catch (err) {
    console.warn("[consulta] no se pudo cargar perfil de trabajador:", err instanceof Error ? err.message : err)
  }

  const hasLaborProfile = Boolean(workerProfile?.hasProfile)
  const dailyLimit = hasLaborProfile
    ? ASSISTANT_POLICY.dailyQuotaPerUser
    : ASSISTANT_POLICY.guestDailyQuotaPerUser

  // Cuota: UNA sola unidad por mensaje, aunque exista retry interno (punto 19).
  const quota = await consumeQuotaOnce(user.id, dailyLimit)
  if (quota === "exceeded") {
    const errorMsg = hasLaborProfile
      ? "Cuota diaria alcanzada. Intenta mañana."
      : "Has alcanzado la cuota de cortesía (5 consultas) para cuentas sin perfil laboral registrado. Para continuar consultando, completa tu información laboral en tu perfil."
    return privateJsonError(429, errorMsg, requestId, "quota_exceeded")
  }
  if (quota === "error") {
    const classified = classifyAssistantError(new Error("No se pudo verificar la cuota"), "quota")
    logAssistantError({ requestId, userId: user.id, code: classified.code, retryable: classified.retryable, message: classified.internalMessage })
    return privateJsonError(classified.httpStatus, classified.publicMessage, requestId, classified.code)
  }

  return await respondDirect(history, question, requestId, user.id, workerProfile)
}
