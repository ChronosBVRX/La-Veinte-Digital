import { createClient } from "@/lib/supabase/server"
import {
  buildContextWithSources,
  classifyRetrievalIntent,
  expandForRetrieval,
  dedupeByText,
  diversifyByDocument,
  extractExactRefs,
  rowToSource,
  VALIDITY_WEIGHT,
  type RetrievedSource,
  type RetrievalIntent,
  type RpcChunkRow,
} from "./retrieval-sources"

export * from "./retrieval-sources"

interface FtsRow extends RpcChunkRow {
  rank: number
}

interface VectorRow extends RpcChunkRow {
  similarity: number
}

/**
 * Métricas por etapa del retrieval híbrido.
 * Cada etapa se mide de forma independiente (las vías corren en paralelo).
 */
export interface RetrievalMetrics {
  exactMs: number | null
  ftsMs: number
  vectorMs: number | null
  fusionMs: number
  totalMs: number
  /** Filas devueltas por cada vía (evidencia de qué backend respondió). */
  rows: { exact: number; fts: number; vector: number }
  /** Intención clasificada (solo define estrategia de retrieval). */
  intent: RetrievalIntent
}

export interface RetrievalResult {
  sources: RetrievedSource[]
  metrics: RetrievalMetrics
}

function timed<T>(
  p: Promise<T>,
  set: (ms: number) => void,
): Promise<{ ok: boolean; value?: T }> {
  const t0 = performance.now()
  return p.then(
    (value) => {
      set(performance.now() - t0)
      return { ok: true, value }
    },
    () => {
      set(performance.now() - t0)
      return { ok: false }
    },
  )
}

/**
 * Retrieval híbrido productivo sobre Supabase pgvector con telemetría.
 *
 * pregunta → coincidencia exacta (RPC) → FTS PostgreSQL (RPC)
 *   → pgvector (RPC; la búsqueda vectorial corre EN POSTGRES)
 *   → fusión + filtro de vigencia → top 5-8 evidencias [S1]…[S8]
 */
export async function retrieveEvidenceWithMetrics(
  question: string,
  queryEmbedding: number[] | null,
  opts: { limit?: number } = {},
): Promise<RetrievalResult> {
  const t0Total = performance.now()
  const limit = opts.limit ?? 8
  const supabase = await createClient()

  const refs = extractExactRefs(question)
  const intent = classifyRetrievalIntent(question)
  // Preguntas amplias: pedir más candidatos para poder diversificar
  // por documento sin perder cobertura.
  const perPathLimit = intent === "BROAD_TOPIC" ? 16 : 10

  type Cand = { row: RpcChunkRow; score: number }
  const jobs: Array<Promise<Cand[]>> = []
  const metrics: RetrievalMetrics = {
    exactMs: null,
    ftsMs: 0,
    vectorMs: null,
    fusionMs: 0,
    totalMs: 0,
    rows: { exact: 0, fts: 0, vector: 0 },
    intent,
  }

  if (refs.clause || refs.article || refs.key) {
    const job = timed(
      rpcSafe<RpcChunkRow>(supabase, "find_exact_normativa", {
        p_clause: refs.clause ?? null,
        p_article: refs.article ?? null,
        p_key: refs.key ?? null,
        p_match_count: 6,
      }),
      (ms) => {
        metrics.exactMs = ms
      },
    ).then((r) => {
      metrics.rows.exact = r.value?.length ?? 0
      return (r.value ?? []).map((row) => ({ row, score: 1000 }))
    })
    jobs.push(job)
  }

  jobs.push(
    timed(
      rpcSafe<FtsRow>(supabase, "search_normativa_fts", {
        p_query: expandForRetrieval(question, intent),
        p_match_count: perPathLimit,
      }),
      (ms) => {
        metrics.ftsMs = ms
      },
    ).then((r) => {
      metrics.rows.fts = r.value?.length ?? 0
      const rows = r.value ?? []
      // Rank normalizado: el FTS bruto escala distinto por query y un
      // puntaje plano ahogaba al vectorial en preguntas amplias.
      const maxRank = Math.max(...rows.map((x) => x.rank ?? 0), 1e-6)
      return rows.map((row) => ({
        row: row as unknown as RpcChunkRow,
        score: 30 + 150 * ((row.rank ?? 0) / maxRank),
      }))
    }),
  )

  if (queryEmbedding && queryEmbedding.length === 1536) {
    jobs.push(
      timed(
        rpcSafe<VectorRow>(supabase, "match_normativa_chunks", {
          p_query_embedding: queryEmbedding,
          p_match_count: perPathLimit,
          p_min_similarity: 0.25,
        }),
        (ms) => {
          metrics.vectorMs = ms
        },
      ).then((r) => {
        metrics.rows.vector = r.value?.length ?? 0
        return (r.value ?? []).map((row) => ({
          row: row as unknown as RpcChunkRow,
          score: 300 * ((row as VectorRow).similarity ?? 0),
        }))
      }),
    )
  }

  const settled = await Promise.allSettled(jobs)
  const tFusion = performance.now()
  const byChunk = new Map<string, RetrievedSource>()

  for (const job of settled) {
    if (job.status !== "fulfilled") {
      console.warn(`[consulta:retrieval] vía rechazada: ${String(job.reason)}`)
      continue
    }
    for (const cand of job.value) {
      const existing = byChunk.get(cand.row.chunk_id)
      if (existing) {
        existing.score += cand.score * 0.5
        continue
      }
      byChunk.set(
        cand.row.chunk_id,
        rowToSource(cand.row, "", cand.score + (VALIDITY_WEIGHT[cand.row.validity] ?? -6)),
      )
    }
  }

  const fused = [...byChunk.values()].sort((a, b) => b.score - a.score)

  // Dedupe de texto idéntico + diversificación por documento para preguntas
  // amplias (evita 8 chunks del mismo capítulo). SPECIFIC/EXACT conservan
  // ranking puro.
  const deduped = dedupeByText(fused)
  const ranked =
    intent === "BROAD_TOPIC"
      ? diversifyByDocument(deduped, Math.max(5, Math.min(limit, 8)))
      : deduped.slice(0, Math.max(5, Math.min(limit, 8)))

  ranked.forEach((s, i) => {
    s.id = `S${i + 1}`
  })

  metrics.fusionMs = performance.now() - tFusion
  metrics.totalMs = performance.now() - t0Total

  console.log(
    `[consulta:retrieval] backend=pgvector intent=${intent} ` +
      `exact=${metrics.exactMs === null ? "-" : Math.round(metrics.exactMs) + "ms"} ` +
      `fts=${Math.round(metrics.ftsMs)}ms vector=${metrics.vectorMs === null ? "-" : Math.round(metrics.vectorMs) + "ms"} ` +
      `fusion=${Math.round(metrics.fusionMs)}ms total=${Math.round(metrics.totalMs)}ms ` +
      `rows(e/f/v)=${metrics.rows.exact}/${metrics.rows.fts}/${metrics.rows.vector}`,
  )

  return { sources: ranked, metrics }
}

/** Compatibilidad: misma conducta que antes, sin exponer métricas. */
export async function retrieveEvidence(
  question: string,
  queryEmbedding: number[] | null,
  opts: { limit?: number } = {},
): Promise<RetrievedSource[]> {
  const { sources } = await retrieveEvidenceWithMetrics(question, queryEmbedding, opts)
  return sources
}

async function rpcSafe<T>(
  // Las RPCs de normativa se agregan por migración y aún no existen en el
  // Database generado; se valida el error manteniendo la firma libre.
  // IMPORTANTE: invocar supabaseClient.rpc(...) directamente (bound) —
  // extraer el método pierde `this` y rompe en runtime.
  supabaseClient: Awaited<ReturnType<typeof createClient>>,
  fn: string,
  args: Record<string, unknown>,
): Promise<T[]> {
  const caller = supabaseClient.rpc as unknown as (
    this: unknown,
    f: string,
    a: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await caller.call(supabaseClient, fn, args)
  if (error) throw new Error(`RPC ${fn}: ${error.message}`)
  return (data ?? []) as T[]
}

// Re-export para que la ruta pueda registrar contexto junto al retrieval.
export { buildContextWithSources }
