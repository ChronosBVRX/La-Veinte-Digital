/**
 * Funciones puras del retrieval híbrido: extracción de referencias exactas,
 * fusión/puntuación, construcción de contexto y validación de citas.
 * Sin I/O (testeable en vitest sin entorno servidor).
 */

export interface RetrievedSource {
  id: string
  chunkId: string
  documentId: string
  documento: string
  version: string
  tipo: string | null
  numero: string | null
  paginaInicio: number | null
  paginaFin: number | null
  fragmento: string
  sourceUrl: string | null
  validity: string
  pendingReview: boolean
  score: number
}

export interface RpcChunkRow {
  chunk_id: string
  document_id: string
  document_title: string
  version_id: string
  validity: string
  section_type: string | null
  section_title: string | null
  article: string | null
  clause: string | null
  numeral: string | null
  page_start: number | null
  page_end: number | null
  text: string
  source_url: string | null
}

export interface ExactRefs {
  clause?: string
  article?: string
  key?: string
}

export function extractExactRefs(question: string): ExactRefs {
  const refs: ExactRefs = {}
  const clause = question.match(/cl[áa]usula\s+(\d+\s*(?:bis|ter|quater)?)/i)
  if (clause) refs.clause = clause[1].replace(/\s+/g, " ").trim()
  const article = question.match(/art[íi]culo\s+("?\d+(?:\s*(?:bis|ter))?"?)/i)
  if (article) refs.article = article[1].replace(/"/g, "").trim()
  const homoclave = question.match(/\b\d[AB]\d{2}-\d{3}-\d{3}\b/i)
  if (homoclave) refs.key = homoclave[0]
  // Claves de NOM (NOM-035, NOM-229-SSA1-2002…): el FTS las tokeniza mal,
  // pero el chunk_id comienza con el documentId → coincidencia directa.
  if (!refs.key) {
    const nom = question.match(/\bNOM[-\s]?\d{3}(?:[-\s]?[A-Z0-9]+)*\b/i)
    if (nom) {
      const normalized = nom[0].toUpperCase().replace(/\s+/g, "-")
      refs.key = normalized.replace(/^(NOM)-(\d{3})$/, "$1-$2")
    }
  }
  return refs
}

export const VALIDITY_WEIGHT: Record<string, number> = {
  CURRENT: 0,
  PENDING_REVIEW: -2,
  UNKNOWN: -4,
  SUPERSEDED: -12,
  REPEALED: -12,
  HISTORICAL: -20,
}

export function rowToSource(row: RpcChunkRow, id: string, score: number): RetrievedSource {
  return {
    id,
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documento: row.document_title,
    version: row.version_id,
    tipo: row.clause ? "clausula" : row.article ? "articulo" : (row.section_type ?? "fragmento"),
    numero: row.clause ?? row.article ?? row.numeral ?? null,
    paginaInicio: row.page_start,
    paginaFin: row.page_end,
    fragmento: row.text.slice(0, 1200),
    sourceUrl: row.source_url,
    validity: row.validity,
    pendingReview: row.validity === "PENDING_REVIEW",
    score,
  }
}

/** Contexto textual para el LLM con etiquetas [S#]. */
export function buildContextWithSources(sources: RetrievedSource[]): string {
  return sources
    .map((s) => {
      const badge = s.pendingReview ? " [VIGENCIA POR REVISAR]" : ""
      return `[${s.id}] ${s.documento} (${s.version})${badge}\n${s.fragmento}`
    })
    .join("\n\n---\n\n")
}

/**
 * Validación server-side de citas: conserva únicamente [S#] que existen
 * en las fuentes recuperadas. El LLM no puede inventar referencias.
 */
export function validateCitations(
  respuesta: string,
  sources: RetrievedSource[],
): { respuesta: string; citedIds: string[]; invalidIdsRemoved: string[] } {
  const valid = new Set(sources.map((s) => s.id))
  const found = [...respuesta.matchAll(/\[S(\d+)\]/g)].map((m) => `S${m[1]}`)
  const invalid = [...new Set(found.filter((id) => !valid.has(id)))]
  let cleaned = respuesta
  for (const bad of invalid) {
    cleaned = cleaned.replaceAll(`[${bad}]`, "")
  }
  cleaned = cleaned.replace(/ {2,}/g, " ").replace(/ \n/g, "\n")
  return {
    respuesta: cleaned,
    citedIds: [...new Set(found.filter((id) => valid.has(id)))],
    invalidIdsRemoved: invalid,
  }
}

/** JSON de fuentes para la respuesta API — derivado del retrieval, no del texto. */
export function fuentesPayload(sources: RetrievedSource[], citedIds: string[]) {
  const cited = new Set(citedIds)
  return sources.map((s) => ({
    id: s.id,
    documento: s.documento,
    version: s.version,
    tipo: s.tipo,
    numero: s.numero,
    paginaInicio: s.paginaInicio,
    paginaFin: s.paginaFin,
    fragmento: s.fragmento.slice(0, 600),
    sourceUrl: s.sourceUrl,
    validity: s.validity,
    advertenciaVigencia:
      s.validity === "PENDING_REVIEW"
        ? "La vigencia actual de este documento requiere verificación editorial."
        : undefined,
    citada: cited.size > 0 ? cited.has(s.id) : undefined,
  }))
}
