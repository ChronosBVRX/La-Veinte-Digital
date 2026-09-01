/**
 * Servicio compartido de recuperación de fuentes normativas en servidor.
 * Consulta directamente el catálogo SQLite local (catalog.sqlite) sin importar módulos de features/
 * de acuerdo con la Regla 2 de AGENTS.md.
 * Filtra fuentes vigentes y verificadas mediante INNER JOIN con versions (v.status = 'VERIFIED'),
 * cerrando DatabaseSync en bloque finally.
 * La Veinte Digital
 */

import path from "node:path"
import fs from "node:fs"
import { DatabaseSync } from "node:sqlite"

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

/**
 * Recupera fuentes normativas vigentes desde catalog.sqlite.
 * Exige INNER JOIN con versions donde status = 'VERIFIED' y documentos con vigencia 'CURRENT' o 'VIGENTE'.
 */
export async function retrieveNormativaSources(
  query: string,
  limit = 5,
  customDbPath?: string
): Promise<RetrievedNormativaSource[]> {
  let db: DatabaseSync | null = null
  try {
    const catalogPath = customDbPath || path.resolve(process.cwd(), "data", "normativa", "catalog.sqlite")
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

    const rows = db.prepare(sql).all(quoted, Math.min(limit, 10)) as Array<Record<string, unknown>>

    return rows.map((r) => {
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
