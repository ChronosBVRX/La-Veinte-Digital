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

/** Tipo de pregunta: define estrategia de retrieval y guía del LLM. */
export type RetrievalIntent =
  | "EXACT_REFERENCE"
  | "SPECIFIC_TOPIC"
  | "BROAD_TOPIC"
  | "FOLLOW_UP"

const BROAD_SIGNALS =
  /\bderechos?\b|\bprestaciones\b|\bbeneficios?\b|me corresponde|qué me toca|condiciones (de trabajo|laborales)|marco laboral|en general/i

const SPECIFIC_SIGNALS =
  /vacaciones|guardia|tiempo extraordinario|horas extra|fondo de ahorro|aguinaldo|sanci[óo]n|antig[üu]edad|escalaf[óo]n|bolsa de trabajo|jubilaci[óo]n|pensi[óo]n|infonavit|afore|sar\b|fonacot|rpbi|rayos ?x|teletrabajo|discapacidad|acoso|hostigamiento|licencia|permiso|turno|horario|residencia|beca|capacitaci[óo]n|profesiograma|plantilla|categor[íi]a|nom-\d{3}|cl[áa]usula \d+|art[íi]culo \d+/i

/**
 * Clasifica la intención SOLO para decidir estrategia de retrieval:
 * no altera la relevancia ni inventa evidencias.
 */
export function classifyRetrievalIntent(question: string): RetrievalIntent {
  const refs = extractExactRefs(question)
  if (refs.clause || refs.article || refs.key) return "EXACT_REFERENCE"

  const hasSpecific = SPECIFIC_SIGNALS.test(question)
  const hasBroad = BROAD_SIGNALS.test(question)

  // Seguimiento: arranca con conectivo y no aporta tema propio.
  const words = question.trim().split(/\s+/).length
  const startsConnective = /^¿?\s*(y|pero|entonces|ahora bien|qué pasa si|y si)\b/i.test(question.trim())
  if (!hasSpecific && !hasBroad && (words <= 5 || startsConnective)) {
    return "FOLLOW_UP"
  }
  if (hasBroad && !hasSpecific) return "BROAD_TOPIC"
  return "SPECIFIC_TOPIC"
}

/**
 * Elimina chunks con texto idéntico (mismo documento repite el mismo
 * encabezado en varias páginas): conserva la primera aparición.
 */
export function dedupeByText<T extends { documentId: string; fragmento: string }>(sources: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const s of sources) {
    const key = `${s.documentId}::${s.fragmento.slice(0, 120).toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

/**
 * Diversificación para preguntas amplias (round-robin por documento):
 * ronda 1 = mejor chunk de cada documento; ronda 2 = segundo de cada uno…
 * Así ningún documento monopoliza el contexto y los duplicados solo
 * aparecen después de que todos los documentos tuvieron su turno.
 * El orden dentro de cada bucket respeta el score global ya calculado.
 */
export function diversifyByDocument<T extends { documentId: string }>(ranked: T[], k: number): T[] {
  const buckets = new Map<string, T[]>()
  const order: string[] = []
  for (const s of ranked) {
    let b = buckets.get(s.documentId)
    if (!b) {
      b = []
      buckets.set(s.documentId, b)
      order.push(s.documentId)
    }
    b.push(s)
  }

  const out: T[] = []
  let round = 0
  while (out.length < k) {
    let addedThisRound = false
    for (const id of order) {
      const b = buckets.get(id)!
      if (round < b.length) {
        out.push(b[round])
        addedThisRound = true
        if (out.length >= k) break
      }
    }
    if (!addedThisRound) break
    round++
  }
  return out
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
