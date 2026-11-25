import { createClient } from "@/lib/supabase/server"
import {
  extractExactRefs,
  rowToSource,
  dedupeByText,
  diversifyByDocument,
  buildCompactEvidence,
  rerankByNormativePriority,
  VALIDITY_WEIGHT,
  type RetrievedSource,
  type RetrievalIntent,
  type RpcChunkRow,
} from "./retrieval-sources"
import { ASSISTANT_POLICY } from "./assistant-policy"
import { embeddingCache } from "./embedding-cache"
import {
  STATIC_SYSTEM_PROMPT,
  intentGuidance,
  trimHistory,
  NO_EVIDENCE_RESPONSE,
  evidenceRangeForIntent,
  outputTokensForIntent,
} from "./engine"

export interface HybridRow extends RpcChunkRow {
  score: number
  origin: string
}

export interface MotorObservability {
  intent: RetrievalIntent
  fastPath: boolean
  embeddingSkipped: boolean
  embeddingCacheHit: boolean
  evidenceCount: number
  evidenceChars: number
  historyChars: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  embeddingMs: number
  retrievalMs: number
  llmTtftMs: number
  llmTotalMs: number
  totalMs: number
  provider: string
  model: string
  thinkingMode: string | null
  retryCount: number
  citationValidationPassed: boolean
  citationFailClosed: boolean
  outputBudgetTokens: number
  maxTokens: number
}

export interface MotorContext {
  question: string
  history: { role: string; content: string }[]
  queryEmbedding: number[] | null
}

export type MotorOutcome =
  | { kind: "fastpath"; respuesta: string; fuentes: RetrievedSource[]; sources: RetrievedSource[]; chips: string[]; obs: MotorObservability }
  | { kind: "no_evidence"; respuesta: string; fuentes: RetrievedSource[]; sources: RetrievedSource[]; chips: string[]; obs: MotorObservability }
  | { kind: "rag"; systemPrompt: string; messages: Array<{ role: string; content: string }>; sources: RetrievedSource[]; chips: string[]; obs: MotorObservability }

/** Genera/reutiliza el embedding con LRU oportuno (punto 6). Devuelve null si no se requirió. */
export async function embedQueryLru(question: string, intent: RetrievalIntent): Promise<{ embedding: number[] | null; skipped: boolean; cacheHit: boolean; ms: number }> {
  // Fast path: EXACT_LOOKUP no necesita embedding (punto 1/4).
  if (intent === "EXACT_LOOKUP") return { embedding: null, skipped: true, cacheHit: true, ms: 0 }

  const explicitProvider = (process.env.LLM_PROVIDER ?? "").toLowerCase().trim()
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()

  // Si DeepSeek es la fuente de verdad activa (o no hay OPENAI_API_KEY), no depender de créditos OpenAI.
  if (
    !openaiKey ||
    explicitProvider === "deepseek" ||
    (Boolean(deepseekKey) && explicitProvider !== "openai")
  ) {
    return { embedding: null, skipped: true, cacheHit: false, ms: 0 }
  }

  const normalizedInput = question.slice(0, 4000)
  const cacheKey = `emb:${intent}:${normalizedInput.trim().toLowerCase()}`
  const cached = embeddingCache.get(cacheKey)
  if (cached) return { embedding: cached, skipped: false, cacheHit: true, ms: 0 }

  const t0 = performance.now()
  try {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: ASSISTANT_POLICY.embeddingModel, input: normalizedInput }),
      signal: AbortSignal.timeout(ASSISTANT_POLICY.embeddingTimeoutMs),
    })
    if (!resp.ok) {
      console.warn(`[consulta:embedding] HTTP ${resp.status}, degradando limpio a FTS + exacto`)
      return { embedding: null, skipped: true, cacheHit: false, ms: performance.now() - t0 }
    }
    const j = (await resp.json()) as { data: Array<{ embedding: number[] }> }
    const vec = j.data[0].embedding
    embeddingCache.set(cacheKey, vec)
    return { embedding: vec, skipped: false, cacheHit: false, ms: performance.now() - t0 }
  } catch (err) {
    console.warn("[consulta:embedding] Error de red/cuota, degradando limpio a FTS + exacto:", err instanceof Error ? err.message : err)
    return { embedding: null, skipped: true, cacheHit: false, ms: performance.now() - t0 }
  }
}

const EXPLICIT_DOCUMENT_HINTS: Array<{ pattern: RegExp; docMatchers: RegExp[] }> = [
  { pattern: /\binfonavit\b/i, docMatchers: [/INFONAVIT/i, /1A72-003-005/i] },
  { pattern: /\bfonacot\b/i, docMatchers: [/FONACOT/i, /1A14-003-011/i] },
  { pattern: /\b(afore|sar\b|sistemas de ahorro para el retiro)\b/i, docMatchers: [/LSAR/i, /AHORRO PARA EL RETIRO/i] },
  { pattern: /\b(ley\s+silla|bipedestaci[oó]n|sentarme)\b/i, docMatchers: [/BIPEDESTACION/i, /LFT/i] },
  { pattern: /\b(lft\b|ley\s+federal\s+del\s+trabajo)\b/i, docMatchers: [/^LFT$/i, /LEY FEDERAL DEL TRABAJO/i] },
  { pattern: /\b(lss\b|ley\s+del\s+seguro\s+social)\b/i, docMatchers: [/^LSS$/i, /LEY DEL SEGURO SOCIAL/i] },
  { pattern: /\b(cpeum\b|constituci[oó]n)\b/i, docMatchers: [/CPEUM/i, /CONSTITUCION/i] },
  { pattern: /\b(confianza\s*a?|estatuto.*confianza)\b/i, docMatchers: [/CONFIANZA/i] },
  { pattern: /\b(rjp\b|r[eé]gimen de jubilaciones)\b/i, docMatchers: [/1A32-003-005/i, /JUBILACIONES/i, /CONVENIO ADICIONAL/i] },
  { pattern: /\b(tabulador)\b/i, docMatchers: [/TABULADOR/i] },
  { pattern: /\b(profesiograma)\b/i, docMatchers: [/PROFESIOGRAMA/i] },
  { pattern: /\b(estatutos?)\b/i, docMatchers: [/ESTATUTO/i] },
  { pattern: /\b(rit\b|reglamento interior de trabajo)\b/i, docMatchers: [/RIT/i, /REGLAMENTO INTERIOR DE TRABAJO/i] },
  { pattern: /\b(riimss\b|reglamento interior del instituto)\b/i, docMatchers: [/RIIMSS/i] },
]

function adjustValidityScore(score: number, validity: string, usedRrf: boolean): number {
  const v = (validity || "CURRENT").toUpperCase()
  if (usedRrf) {
    if (v === "HISTORICAL") return score * 0.1
    if (v === "SUPERSEDED" || v === "REPEALED") return score * 0.25
    if (v === "PENDING_REVIEW") return score * 0.92
    if (v === "UNKNOWN") return score * 0.85
    return score
  }
  return score + (VALIDITY_WEIGHT[v] ?? -6)
}

function matchesExplicitDocHint(src: RetrievedSource, rawQuery: string): boolean {
  const haystack = `${src.documentId} ${src.documento}`
  const nomMatch = rawQuery.match(/\bNOM[-\s]?(\d{3})\b/i)
  if (nomMatch && new RegExp(`NOM[-\\s]?${nomMatch[1]}`, "i").test(haystack)) {
    return true
  }
  const homoMatch = rawQuery.match(/\b\d[AB]\d{2}-\d{3}-\d{3}\b/i)
  if (homoMatch && haystack.toUpperCase().includes(homoMatch[0].toUpperCase())) {
    return true
  }
  for (const h of EXPLICIT_DOCUMENT_HINTS) {
    if (h.pattern.test(rawQuery) && h.docMatchers.some((re) => re.test(haystack))) {
      return true
    }
  }
  return false
}

/** Recupera evidencias vía RPC híbrida única (RRF con fallback a búsqueda ponderada). */
export async function retrieveHybrid(
  question: string,
  embedding: number[] | null,
  intent: RetrievalIntent,
  refs: ReturnType<typeof extractExactRefs>,
  limit: number,
  rawQuestion?: string,
): Promise<{ sources: RetrievedSource[]; rpcMs: number; rpcCalls: number }> {
  const t0 = performance.now()
  const supabase = await createClient()
  const call = supabase.rpc as unknown as (this: unknown, f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  const candidatePool = intent === "BROAD_TOPIC" || intent === "LABOR_CASE" ? 32 : 24

  // Intento prioritario 1: hybrid_normativa_rrf (Fusión de Rangos Recíprocos)
  let usedRrf = true
  let rpcRes = await call.call(supabase, "hybrid_normativa_rrf", {
    p_query: question,
    p_query_embedding: embedding && embedding.length === 1536 ? embedding : null,
    p_clause: refs.clause ?? null,
    p_article: refs.article ?? null,
    p_key: refs.key ?? null,
    p_match_count: Math.max(limit, candidatePool),
  })

  // Fallback seguro a hybrid_normativa_search si la RPC RRF aún no está desplegada en el entorno
  if (rpcRes.error) {
    usedRrf = false
    rpcRes = await call.call(supabase, "hybrid_normativa_search", {
      p_query: question,
      p_query_embedding: embedding && embedding.length === 1536 ? embedding : null,
      p_clause: refs.clause ?? null,
      p_article: refs.article ?? null,
      p_key: refs.key ?? null,
      p_match_count: Math.max(limit, 20),
    })
  }

  if (rpcRes.error) throw new Error(`hybrid: ${rpcRes.error.message}`)
  let rows = (rpcRes.data ?? []) as HybridRow[]
  let rpcCalls = 1

  // En modo FTS-puro (sin embedding OpenAI), si la consulta estricta devolvió <2 filas y no trae OR,
  // ejecutar un respaldo relajado por palabras clave unidas con OR para asegurar cobertura.
  if ((!embedding || embedding.length !== 1536) && rows.length < 2 && !/\bOR\b/.test(question)) {
    const tokens = question
      .replace(/[¿?¡!.,;:()"'\n]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 4)
    if (tokens.length >= 2) {
      const orQuery = [...new Set(tokens)].slice(0, 6).join(" OR ")
      const retryFn = usedRrf ? "hybrid_normativa_rrf" : "hybrid_normativa_search"
      const retryRes = await call.call(supabase, retryFn, {
        p_query: orQuery,
        p_query_embedding: null,
        p_clause: refs.clause ?? null,
        p_article: refs.article ?? null,
        p_key: refs.key ?? null,
        p_match_count: Math.max(limit, candidatePool),
      })
      rpcCalls = 2
      if (!retryRes.error && Array.isArray(retryRes.data) && retryRes.data.length > rows.length) {
        rows = [...rows, ...(retryRes.data as HybridRow[])]
      }
    }
  }

  // Si FTS + OR-retry devolvieron 0 filas en modo sin embeddings, usar índice pg_trgm (ILIKE) como último recurso.
  const maybeFrom = (supabase as unknown as {
    from?: (table: string) => {
      select: (cols: string) => {
        neq: (col: string, val: string) => {
          ilike: (col: string, pat: string) => {
            limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
          }
        }
      }
    }
  }).from
  if ((!embedding || embedding.length !== 1536) && rows.length === 0 && typeof maybeFrom === "function") {
    const rawKeywords = (rawQuestion ?? question)
      .replace(/[¿?¡!.,;:()"'\n]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 5)
      .sort((a, b) => b.length - a.length)
    const anchor = rawKeywords[0]
    if (anchor) {
      try {
        const trgmRes = await maybeFrom
          .call(supabase, "normativa_chunks")
          .select(
            "chunk_id, document_id, document_title, version_id, validity, section_type, section_title, article, clause, numeral, page_start, page_end, text, source_url",
          )
          .neq("validity", "HISTORICAL")
          .ilike("text", `%${anchor}%`)
          .limit(6)
        if (!trgmRes.error && Array.isArray(trgmRes.data) && trgmRes.data.length > 0) {
          rows = trgmRes.data.map((r) => ({
            ...(r as unknown as RpcChunkRow),
            score: usedRrf ? 14 : 150,
            origin: usedRrf ? "rrf:trgm" : "trgm",
          }))
        }
      } catch {
        // Silencioso: fallback opcional si la tabla está disponible
      }
    }
  }

  const rpcMs = performance.now() - t0

  const byChunk = new Map<string, RetrievedSource>()
  for (const row of rows) {
    if (byChunk.has(row.chunk_id)) continue
    const adjustedScore = adjustValidityScore(Number(row.score ?? 0), row.validity, usedRrf)
    const src = rowToSource(row, "", adjustedScore)
    if (usedRrf && src.origin && !src.origin.startsWith("rrf")) {
      src.origin = `rrf:${src.origin}`
    } else if (usedRrf && !src.origin) {
      src.origin = "rrf"
    }
    byChunk.set(row.chunk_id, src)
  }

  const allCandidates = [...byChunk.values()]
  const activeCandidates = allCandidates.filter(
    (s) => s.validity !== "HISTORICAL" && s.validity !== "SUPERSEDED" && s.validity !== "REPEALED",
  )
  // Si existen al menos 2 fragmentos vigentes relevantes, no mezclar normativa derogada/histórica
  let fused = (activeCandidates.length >= 2 ? activeCandidates : allCandidates).sort((a, b) => b.score - a.score)

  const queryForPriority = rawQuestion ?? question
  // Filtrar ruido extremo de baja relevancia si ya hay resultados fuertes
  const noiseFloor = usedRrf ? 8 : 90
  const strongFused = fused.filter((s) => s.score >= noiseFloor)
  if (strongFused.length > 0) fused = strongFused

  fused = rerankByNormativePriority(fused, queryForPriority)

  // Si el usuario nombró explícitamente un estatuto/NOM/ley (p. ej. INFONAVIT, NOM-035, Ley Silla),
  // garantizar que sus fragmentos de alto puntaje queden al frente y no desplazados por menciones tangenciales.
  const explicitHits = fused.filter((s) => matchesExplicitDocHint(s, queryForPriority))
  if (explicitHits.length > 0) {
    const nonExplicit = fused.filter((s) => !matchesExplicitDocHint(s, queryForPriority))
    fused = [...explicitHits.sort((a, b) => b.score - a.score), ...nonExplicit]
  }

  fused = dedupeByText(fused)
  const rd = evidenceRangeForIntent(intent)
  // Preferir el tope del rango para dar contexto suficiente sin pasarse de 8.
  const target = Math.min(rd.max, limit, 8)
  const distinctDocs = new Set(fused.map((s) => s.documentId)).size
  const shouldDiversify =
    intent === "BROAD_TOPIC" ||
    intent === "LABOR_CASE" ||
    (intent === "SPECIFIC_TOPIC" && distinctDocs >= 2 && target >= 4)

  let ranked = shouldDiversify
    ? diversifyByDocument(fused, target)
    : fused.slice(0, target)

  // En consultas EXACT_LOOKUP / EXACT_EXPLAIN, ordenar por página ascendente los fragmentos hermanos
  // de la misma cláusula/artículo para que el modelo lea de principio a fin sin saltos.
  if ((intent === "EXACT_LOOKUP" || intent === "EXACT_EXPLAIN") && ranked.length > 1) {
    const head = ranked[0]
    const siblings = ranked.filter(
      (s) => s.documentId === head.documentId && s.numero && s.numero === head.numero,
    )
    if (siblings.length > 1) {
      const others = ranked.filter(
        (s) => !(s.documentId === head.documentId && s.numero && s.numero === head.numero),
      )
      siblings.sort((a, b) => (a.paginaInicio ?? 99999) - (b.paginaInicio ?? 99999))
      ranked = [...siblings, ...others]
    }
  }

  ranked.forEach((s, i) => (s.id = `S${i + 1}`))
  return { sources: ranked, rpcMs, rpcCalls }
}

/**
 * Recorta y compacta historial (punto 11) optimizando tokens de entrada en DeepSeek:
 * conserva los 2 turnos más recientes completos y resume respuestas previas del asistente.
 */
export function buildMessages(systemPrompt: string, history: { role: string; content: string }[]): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const trimmed = trimHistory(history, 6, 4800)
  return [
    { role: "system", content: systemPrompt },
    ...trimmed.map((m, idx) => {
      const isOlderAssistant = m.role === "assistant" && idx < trimmed.length - 2 && m.content.length > 360
      return {
        role: m.role as "user" | "assistant",
        content: isOlderAssistant ? `${m.content.slice(0, 360).replace(/\s+\S*$/, "").trim()}…` : m.content,
      }
    }),
  ]
}

/** Punto 10+ayuda: prompt estático + guía por intent + perfil del trabajador (sin duplicar). */
export function buildPrompt(intent: RetrievalIntent, compactEvidence: string, workerProfilePrompt?: string): string {
  const profileBlock = workerProfilePrompt ? `\n\n${workerProfilePrompt}` : ""
  return `${STATIC_SYSTEM_PROMPT}

${intentGuidance(intent)}${profileBlock}

Contexto:
${compactEvidence}`
}

export { NO_EVIDENCE_RESPONSE, outputTokensForIntent, buildCompactEvidence }
