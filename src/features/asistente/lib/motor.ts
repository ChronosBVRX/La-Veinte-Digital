import { createClient } from "@/lib/supabase/server"
import {
  classifyRetrievalIntent,
  extractExactRefs,
  rowToSource,
  dedupeByText,
  diversifyByDocument,
  buildCompactEvidence,
  EVIDENCE_BUDGET,
  type RetrievedSource,
  type RetrievalIntent,
  type RpcChunkRow,
} from "./retrieval-sources"
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

  const cacheKey = `emb:${intent}:${question.trim().toLowerCase()}`
  const cached = embeddingCache.get(cacheKey)
  if (cached) return { embedding: cached, skipped: false, cacheHit: true, ms: 0 }

  const t0 = performance.now()
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: question }),
    signal: AbortSignal.timeout(15000),
  })
  if (!resp.ok) throw new Error(`embedding ${resp.status}`)
  const j = (await resp.json()) as { data: Array<{ embedding: number[] }> }
  const vec = j.data[0].embedding
  embeddingCache.set(cacheKey, vec)
  return { embedding: vec, skipped: false, cacheHit: false, ms: performance.now() - t0 }
}

/** Recupera evidencias vía RPC híbrida única (punto 5). */
export async function retrieveHybrid(question: string, embedding: number[] | null, intent: RetrievalIntent, refs: ReturnType<typeof extractExactRefs>, limit: number): Promise<{ sources: RetrievedSource[]; rpcMs: number; rpcCalls: number }> {
  const t0 = performance.now()
  const supabase = await createClient()
  const call = supabase.rpc as unknown as (this: unknown, f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await call.call(supabase, "hybrid_normativa_search", {
    p_query: question,
    p_query_embedding: embedding && embedding.length === 1536 ? embedding : null,
    p_clause: refs.clause ?? null,
    p_article: refs.article ?? null,
    p_key: refs.key ?? null,
    p_match_count: Math.max(limit, 16),
  })
  if (error) throw new Error(`hybrid: ${error.message}`)
  const rows = (data ?? []) as HybridRow[]
  const rpcMs = performance.now() - t0

  const byChunk = new Map<string, RetrievedSource>()
  for (const row of rows) {
    if (byChunk.has(row.chunk_id)) continue
    // híbrido ya trae score final; VALIDITY_WEIGHT aplicado en DB implícito,
    // aquí solo mapeamos.
    byChunk.set(row.chunk_id, rowToSource(row, "", Number(row.score ?? 0)))
  }
  let fused = [...byChunk.values()].sort((a, b) => b.score - a.score)
  fused = dedupeByText(fused)
  const rd = evidenceRangeForIntent(intent)
  // Preferir el tope del rango para dar contexto suficiente sin pasarse de 8.
  const target = Math.min(rd.max, limit, 8)
  const ranked = intent === "BROAD_TOPIC" || intent === "LABOR_CASE"
    ? diversifyByDocument(fused, target)
    : fused.slice(0, target)
  ranked.forEach((s, i) => (s.id = `S${i + 1}`))
  return { sources: ranked, rpcMs, rpcCalls: 1 }
}

/** Recorta historial (punto 11): últimos relevantes con presupuesto duro. */
export function buildMessages(systemPrompt: string, history: { role: string; content: string }[]): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const trimmed = trimHistory(history, 6, 6000)
  return [
    { role: "system", content: systemPrompt },
    ...trimmed.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ]
}

/** Punto 10+ayuda: prompt estático + guía por intent (sin duplicar). */
export function buildPrompt(intent: RetrievalIntent, compactEvidence: string): string {
  return `${STATIC_SYSTEM_PROMPT}

${intentGuidance(intent)}

Contexto:
${compactEvidence}`
}

export { NO_EVIDENCE_RESPONSE, outputTokensForIntent, buildCompactEvidence }
