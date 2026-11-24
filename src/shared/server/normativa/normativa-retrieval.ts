/**
 * Servicio compartido de recuperación de fuentes normativas en servidor.
 * Conecta con el RAG híbrido de producción en Supabase (pgvector + FTS + coincidencia exacta
 * vía `hybrid_normativa_rrf` / `hybrid_normativa_search`) y usa el catálogo SQLite local
 * (`catalog.sqlite`) como respaldo cuando no hay conexión o se pasa `customDbPath` en pruebas.
 * Sin importar módulos de features/ de acuerdo con la Regla 2 de AGENTS.md.
 * La Veinte Digital
 */

import path from "node:path"
import fs from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { createClient } from "@/lib/supabase/server"

export interface RetrievedNormativaSource {
  id: string
  chunkId: string
  documentId: string
  documento: string
  version: string
  tipo: string | null
  numero: string | null
  clause: string | null
  article: string | null
  paginaInicio: number | null
  paginaFin: number | null
  fragmento: string
  sourceUrl: string | null
  validity: string
  score: number
}

export interface ExactNormativaRefs {
  clause?: string
  article?: string
  key?: string
}

export function normalizeLegalRef(ref: string): string {
  return ref
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function extractExactNormativaRefs(text: string): ExactNormativaRefs {
  const refs: ExactNormativaRefs = {}
  const clause = text.match(/cl[áa]usula\s+(\d+\s*(?:bis|ter|quater)?)/i)
  if (clause) refs.clause = normalizeLegalRef(clause[1])

  const article = text.match(/art[íi]culo\s+("?\d+(?:\s*(?:bis|ter))?"?)/i)
  if (article) refs.article = normalizeLegalRef(article[1].replace(/"/g, ""))

  const homoclave = text.match(/\b\d[AB]\d{2}-\d{3}-\d{3}\b/i)
  if (homoclave) refs.key = homoclave[0]

  if (!refs.key) {
    const nom = text.match(/\bNOM[-\s]?\d{3}(?:[-\s]?[A-Z0-9]+)*\b/i)
    if (nom) {
      refs.key = nom[0].toUpperCase().replace(/\s+/g, "-")
    }
  }

  return refs
}

interface SupabaseHybridRow {
  chunk_id?: string | null
  document_id?: string | null
  document_title?: string | null
  version_id?: string | null
  validity?: string | null
  section_type?: string | null
  section_title?: string | null
  article?: string | null
  clause?: string | null
  numeral?: string | null
  page_start?: number | null
  page_end?: number | null
  text?: string | null
  source_url?: string | null
  score?: number | null
}

async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || !query.trim()) return null

  try {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: query.slice(0, 4000),
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!resp.ok) return null
    const json = (await resp.json()) as { data?: Array<{ embedding?: number[] }> }
    const vec = json.data?.[0]?.embedding
    return Array.isArray(vec) && vec.length === 1536 ? vec : null
  } catch {
    return null
  }
}

export function isGenderSpecificFemaleSource(documentId: string, documento: string): boolean {
  const combined = `${documentId} ${documento}`
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  return (
    combined.includes("LGAMVLV") ||
    combined.includes("ACCESO DE LAS MUJERES") ||
    combined.includes("VIDA LIBRE DE VIOLENCIA")
  )
}

export function isExplicitlyFemaleContext(query: string): boolean {
  const q = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  // Si indica explícitamente ser hombre/varón, no aplicar leyes exclusivas de mujeres
  if (/\b(soy hombre|como hombre|trabajador hombre|varon|masculino)\b/i.test(q)) {
    return false
  }

  return /\b(mujer|mujeres|trabajadora|companera|embaraz\w*|maternidad|lactancia|violencia de genero|violencia contra la mujer|femenin\w*)\b/i.test(
    q
  )
}

export function getEscritoNormativePriority(documentId: string, documento: string): number {
  const combined = `${documentId} ${documento}`
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  // Prioridad 1: Contrato Colectivo de Trabajo (base normativa principal)
  if (
    combined.includes("CCT") ||
    combined.includes("CONTRATO COLECTIVO") ||
    combined.includes("CONTRATO-COLECTIVO")
  ) {
    return 1
  }

  // Prioridad 2: Normativa interna IMSS-SNTSS (Estatutos, Tabulador, Reglamentos, Convenios)
  if (
    combined.includes("ESTATUTO") ||
    combined.includes("SNTSS") ||
    combined.includes("TABULADOR") ||
    combined.includes("RIT") ||
    combined.includes("REGLAMENTO") ||
    combined.includes("ESCALAFON") ||
    combined.includes("CAPACITACION") ||
    combined.includes("BECAS") ||
    combined.includes("PROFESIOGRAMA") ||
    combined.includes("CONVENIO") ||
    combined.includes("INSTRUCTIVO") ||
    combined.includes("PROCEDIMIENTO") ||
    combined.includes("CIRCULAR")
  ) {
    return 2
  }

  // Prioridad 3: Leyes federales y normas oficiales externas (LFT, LSS, NOMs, etc.)
  return 3
}

export function filterAndPrioritizeNormativaSources<
  T extends { documentId: string; documento: string; score: number }
>(sources: T[], query: string): T[] {
  const allowFemaleSpecific = isExplicitlyFemaleContext(query)

  const filtered = sources.filter((s) => {
    if (isGenderSpecificFemaleSource(s.documentId, s.documento) && !allowFemaleSpecific) {
      return false
    }
    return true
  })

  return [...filtered].sort((a, b) => {
    const pA = getEscritoNormativePriority(a.documentId, a.documento)
    const pB = getEscritoNormativePriority(b.documentId, b.documento)
    if (pA !== pB) return pA - pB
    return b.score - a.score
  })
}

async function retrieveFromSupabaseRag(
  query: string,
  limit: number
): Promise<RetrievedNormativaSource[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return []
  }

  try {
    const supabase = await createClient()
    const refs = extractExactNormativaRefs(query)
    const embedding = await generateQueryEmbedding(query)

    const call = supabase.rpc as unknown as (
      this: unknown,
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>

    let rpcRes = await call.call(supabase, "hybrid_normativa_rrf", {
      p_query: query,
      p_query_embedding: embedding,
      p_clause: refs.clause ?? null,
      p_article: refs.article ?? null,
      p_key: refs.key ?? null,
      p_match_count: Math.max(limit * 4, 24),
    })

    if (rpcRes.error) {
      rpcRes = await call.call(supabase, "hybrid_normativa_search", {
        p_query: query,
        p_query_embedding: embedding,
        p_clause: refs.clause ?? null,
        p_article: refs.article ?? null,
        p_key: refs.key ?? null,
        p_match_count: Math.max(limit * 4, 24),
      })
    }

    if (rpcRes.error || !Array.isArray(rpcRes.data)) {
      return []
    }

    const excludedValidity = new Set(["HISTORICAL", "REPEALED", "SUPERSEDED"])
    const seen = new Set<string>()
    const results: RetrievedNormativaSource[] = []

    for (const row of rpcRes.data as SupabaseHybridRow[]) {
      const chunkId = String(row.chunk_id || "").trim()
      const text = String(row.text || "").trim()
      if (!chunkId || !text || seen.has(chunkId)) continue

      const validity = String(row.validity || "CURRENT").toUpperCase()
      if (excludedValidity.has(validity)) continue

      seen.add(chunkId)

      let rawClause = row.clause ? String(row.clause).trim() : null
      let rawArticle = row.article ? String(row.article).trim() : null
      if (!rawClause && !rawArticle && row.section_title) {
        const titleRefs = extractExactNormativaRefs(String(row.section_title))
        if (titleRefs.clause) rawClause = titleRefs.clause
        if (titleRefs.article) rawArticle = titleRefs.article
      }

      const numero = rawClause
        ? `Cláusula ${rawClause}`
        : rawArticle
        ? `Artículo ${rawArticle}`
        : row.section_title
        ? String(row.section_title).trim()
        : null

      results.push({
        id: chunkId,
        chunkId,
        documentId: String(row.document_id || ""),
        documento: String(row.document_title || "Normativa Institucional"),
        version: String(row.version_id || "vigente"),
        tipo: row.section_type ? String(row.section_type) : null,
        numero,
        clause: rawClause,
        article: rawArticle,
        paginaInicio: typeof row.page_start === "number" ? row.page_start : null,
        paginaFin: typeof row.page_end === "number" ? row.page_end : null,
        fragmento: text,
        sourceUrl: row.source_url ? String(row.source_url) : null,
        validity,
        score: typeof row.score === "number" ? row.score : 0,
      })
    }

    return filterAndPrioritizeNormativaSources(results, query).slice(0, limit)
  } catch (err) {
    console.warn("[normativa-retrieval] Error consultando RAG en Supabase, usando respaldo local:", err)
    return []
  }
}

/**
 * Recupera fuentes normativas vigentes desde el RAG híbrido en Supabase (pgvector + FTS + exacto)
 * con respaldo al catálogo SQLite local (catalog.sqlite).
 * Cuando se pasa `customDbPath` (pruebas unitarias), consulta directamente ese SQLite.
 */
export async function retrieveNormativaSources(
  query: string,
  limit = 5,
  customDbPath?: string
): Promise<RetrievedNormativaSource[]> {
  if (!customDbPath) {
    const ragResults = await retrieveFromSupabaseRag(query, limit)
    if (ragResults.length > 0) {
      return ragResults
    }
  }

  let db: DatabaseSync | null = null
  try {
    const catalogPath = customDbPath || path.resolve(/*turbopackIgnore: true*/ process.cwd(), "data", "normativa", "catalog.sqlite")
    if (!fs.existsSync(catalogPath)) {
      return []
    }

    db = new DatabaseSync(catalogPath)

    const tokens = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t.replace(/["'()]/g, ""))
      .slice(0, 8)

    if (tokens.length === 0) return []

    // Búsqueda con FTS5 uniendo estrictamente con documents y versions verificadas
    const quoted = tokens.map((t) => `"${t}"`).join(" OR ")

    const sql = `
      SELECT c.chunk_key AS chunk_id, c.document_id, d.title AS document_title, c.version_id,
             c.pdf_page, c.printed_page, c.section_label, c.article, c.clause, c.numeral, c.text,
             d.validity, d.priority,
             bm25(chunks_fts, 10.0, 2.0) AS rank
      FROM chunks_fts f
      JOIN chunks c ON c.id = f.rowid
      JOIN documents d ON d.id = c.document_id
      JOIN versions v ON v.id = c.version_id
      WHERE chunks_fts MATCH ?
        AND d.validity IN ('CURRENT', 'VIGENTE')
        AND v.status = 'VERIFIED'
        AND d.verification_status IS NULL
      ORDER BY rank ASC
      LIMIT ?
    `

    const rows = db.prepare(sql).all(quoted, Math.min(limit * 3, 20)) as Array<Record<string, unknown>>

    const mapped: RetrievedNormativaSource[] = rows.map((r) => {
      const parsedPrinted = r.printed_page ? parseInt(String(r.printed_page), 10) : null
      const pageNum = !isNaN(Number(parsedPrinted)) && parsedPrinted !== null
        ? parsedPrinted
        : (typeof r.pdf_page === "number" ? r.pdf_page : null)

      const rankVal = typeof r.rank === "number" ? r.rank : 0
      const score = Math.max(1, Math.round(100 - rankVal * 10))

      const rawClause = r.clause ? String(r.clause).trim() : null
      const rawArticle = r.article ? String(r.article).trim() : null

      return {
        id: String(r.chunk_id || ""),
        chunkId: String(r.chunk_id || ""),
        documentId: String(r.document_id || ""),
        documento: String(r.document_title || ""),
        version: String(r.version_id || ""),
        tipo: r.section_label ? String(r.section_label) : null,
        numero: rawClause ? `Cláusula ${rawClause}` : rawArticle ? `Artículo ${rawArticle}` : null,
        clause: rawClause,
        article: rawArticle,
        paginaInicio: pageNum,
        paginaFin: pageNum,
        fragmento: String(r.text || ""),
        sourceUrl: null,
        validity: String(r.validity || "CURRENT"),
        score,
      }
    })

    return filterAndPrioritizeNormativaSources(mapped, query).slice(0, limit)
  } catch (err) {
    console.warn("[normativa-retrieval] Catálogo normativo no disponible o error de consulta:", err)
    return []
  } finally {
    if (db) {
      try {
        db.close()
      } catch {
        // noop
      }
    }
  }
}
