import { createClient } from "@/lib/supabase/server"
import {
  buildContextWithSources,
  extractExactRefs,
  rowToSource,
  VALIDITY_WEIGHT,
  type RetrievedSource,
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
 * Retrieval híbrido productivo sobre Supabase pgvector.
 *
 * pregunta → coincidencia exacta (RPC) → FTS PostgreSQL (RPC)
 *   → pgvector (RPC; la búsqueda vectorial corre EN POSTGRES)
 *   → fusión + filtro de vigencia → top 5-8 evidencias [S1]…[S8]
 */
export async function retrieveEvidence(
  question: string,
  queryEmbedding: number[] | null,
  opts: { limit?: number } = {},
): Promise<RetrievedSource[]> {
  const limit = opts.limit ?? 8
  const supabase = await createClient()

  const refs = extractExactRefs(question)

  type Cand = { row: RpcChunkRow; score: number }
  const jobs: Array<Promise<Cand[]>> = []

  if (refs.clause || refs.article || refs.key) {
    jobs.push(
      rpcSafe<RpcChunkRow>(supabase, "find_exact_normativa", {
        p_clause: refs.clause ?? null,
        p_article: refs.article ?? null,
        p_key: refs.key ?? null,
        p_match_count: 6,
      }).then((rows) => rows.map((row) => ({ row, score: 1000 }))),
    )
  }

  jobs.push(
    rpcSafe<FtsRow>(supabase, "search_normativa_fts", {
      p_query: question,
      p_match_count: 10,
    }).then((rows) =>
      rows.map((row) => ({ row: row as unknown as RpcChunkRow, score: 200 + (row.rank ?? 0) })),
    ),
  )

  if (queryEmbedding && queryEmbedding.length === 1536) {
    jobs.push(
      rpcSafe<VectorRow>(supabase, "match_normativa_chunks", {
        p_query_embedding: queryEmbedding,
        p_match_count: 10,
        p_min_similarity: 0.25,
      }).then((rows) =>
        rows.map((row) => ({
          row: row as unknown as RpcChunkRow,
          score: 300 * (row.similarity ?? 0),
        })),
      ),
    )
  }

  const settled = await Promise.allSettled(jobs)
  const byChunk = new Map<string, RetrievedSource>()

  for (const job of settled) {
    if (job.status !== "fulfilled") continue
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

  const ranked = [...byChunk.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(5, Math.min(limit, 8)))

  ranked.forEach((s, i) => {
    s.id = `S${i + 1}`
  })
  return ranked
}

async function rpcSafe<T>(
  // Las RPCs de normativa se agregan por migración y aún no existen en el
  // Database generado; se invoca con firma libre y se valida el error.
  supabaseClient: Awaited<ReturnType<typeof createClient>>,
  fn: string,
  args: Record<string, unknown>,
): Promise<T[]> {
  const call = supabaseClient.rpc as unknown as (
    f: string,
    a: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await call(fn, args)
  if (error) throw new Error(`RPC ${fn}: ${error.message}`)
  return (data ?? []) as T[]
}
