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
  | "EXACT_LOOKUP"
  | "EXACT_EXPLAIN"
  | "SPECIFIC_TOPIC"
  | "BROAD_TOPIC"
  | "LABOR_CASE"
  | "FOLLOW_UP"

/** Histórico: alias para compatibilidad con código anterior. */
export type LegacyRetrievalIntent =
  | "EXACT_REFERENCE"
  | "SPECIFIC_TOPIC"
  | "BROAD_TOPIC"
  | "FOLLOW_UP"

const BROAD_SIGNALS =
  /\bderechos?\b|\bprestaciones\b|\bbeneficios?\b|me corresponde|qué me toca|condiciones (de trabajo|laborales)|marco laboral|en general/i

const SPECIFIC_SIGNALS =
  /vacaciones|guardia|tiempo extraordinario|horas extra|fondo de ahorro|aguinaldo|sanci[óo]n|antig[üu]edad|escalaf[óo]n|bolsa de trabajo|jubilaci[óo]n|pensi[óo]n|infonavit|afore|sar\b|fonacot|rpbi|rayos ?x|teletrabajo|discapacidad|acoso|hostigamiento|licencia|permiso|turno|horario|residencia|beca|capacitaci[óo]n|profesiograma|plantilla|categor[íi]a|nom-\d{3}|cl[áa]usula \d+|art[íi]culo \d+|jornada|40 horas|reforma|horas de trabajo/i

/** Señales de caso laboral (conflicto) — solapan con acompanamiento pero NO lo modifican. */
const LABOR_CASE_SIGNALS =
  /hostig|acoso|agres|amenaz|represali|sanci[oó]n|acta\b|disciplin|fuera de (mi )?categ|actividades (que no|fuera)|cambio injustificado|negaron|negan|neg[oó]|no (quieren|quiere) (respetar|darme|autoriz)|conflicto con (mi )?jef|jefatura|riesgo de trabajo|accidente|discriminaci[oó]n|maltrat|despido|intimid|presi[oó]n|le[oó]n|agredid/i

/** Verbo de LOOKUP: pedir mostrar/recuperar un documento o dato concreto. */
const LOOKUP_VERBS = /mu[eé]strame|ens[eé][nñ]ame|dame|d[aa]me el|ver|abre|recupera|cu[aá]l es el texto|b[uú]scame la/i
/** Verbo de EXPLAIN: pedir explicar/definir. */
const EXPLAIN_VERBS = /expl[íi]came|qu[eé] es|qu[eé] significa|d[ií]me qu[eé]|c[oó]mo funciona|ent[eé]ndeme|def[ií]neme|a qu[eé] se refiere|por qu[eé]/i

/**
 * Clasifica la intención SOLO para decidir estrategia de retrieval y budget:
 * no altera la relevancia ni inventa evidencias. Determinista, sin LLM.
 */
export function classifyRetrievalIntent(question: string): RetrievalIntent {
  const refs = extractExactRefs(question)
  if (refs.clause || refs.article || refs.key) {
    return LOOKUP_VERBS.test(question) && !EXPLAIN_VERBS.test(question)
      ? "EXACT_LOOKUP"
      : "EXACT_EXPLAIN"
  }

  const hasSpecific = SPECIFIC_SIGNALS.test(question)
  const hasBroad = BROAD_SIGNALS.test(question)
  const hasLaborCase = LABOR_CASE_SIGNALS.test(question) || hasSpecific && /(conflicto|problema|violaci[oó]n|no me|me neg|mi jefe|me pusieron|me quieren|me obligan|me cambiaron)/i.test(question)

  // Seguimiento: arranca con conectivo y no aporta tema propio.
  const words = question.trim().split(/\s+/).length
  const startsConnective = /^¿?\s*(y|pero|entonces|ahora bien|qué pasa si|y si)\b/i.test(question.trim())
  if (!hasSpecific && !hasBroad && !hasLaborCase && (words <= 5 || startsConnective)) {
    return "FOLLOW_UP"
  }
  if (hasLaborCase) return "LABOR_CASE"
  if (hasBroad && !hasSpecific) return "BROAD_TOPIC"
  return "SPECIFIC_TOPIC"
}

export type WorkerQueryIntent =
  | "LABORAL"
  | "CONTRACTUAL"
  | "SINDICAL"
  | "CAMBIO_ADSCRIPCION"
  | "INSTITUCIONAL"
  | "SEGURIDAD_SALUD"
  | "PACIENTE_BENEFICIARIO"

const SINDICAL_SIGNALS =
  /\b(sindicato|sntss|estatuto|asamblea|delegad[oa]s?|secci[oó]n|cuota sindical|elecci[oó]n|comisi[oó]n mixta|representante sindical|sanci[oó]n sindical|licencia sindical|permiso sindical|pliego petitorio|huelga|derechos sindicales|impugnaci[oó]n)\b/i

const CONTRACTUAL_SIGNALS =
  /\b(cct\b|contrato colectivo|cl[aá]usula\s*\d+|tabulador|profesiograma|categor[ií]a|sueldo tabular|salario base|nivel salarial|rama médica|rama administrativa|convenio bilateral|pliego|prestaci[oó]n|prestaciones laborales|aguinaldo|fondo de ahorro|prima vacacional)\b/i

const SEGURIDAD_SALUD_SIGNALS =
  /\b(riesgo de trabajo|accidente de trabajo|enfermedad profesional|incapacidad|nom-\d+|equipo de protecci[oó]n|epp\b|radiaci[oó]n|biol[oó]gico infeccioso|rpbi|seguridad e higiene|ergonom|ley silla|bipedestaci[oó]n|estrés laboral|salud en el trabajo|medicina del trabajo)\b/i

const PACIENTE_BENEFICIARIO_SIGNALS =
  /\b(derechohabiente|paciente|cita m[eé]dica|queja m[eé]dica|atenci[oó]n m[eé]dica|consulta externa|urgencias m[eé]dicas|receta|medicamento|afiliaci[oó]n familiar|beneficiari[oa])\b/i

const INSTITUCIONAL_SIGNALS =
  /\b(circular|oficio|formato|procedimiento imss|jefatura de servicios|delegaci[oó]n|subdelegaci[oó]n|portal institucional|matr[ií]cula|tr[aá]mite administrativo)\b/i

export function classifyWorkerQueryIntent(question: string): WorkerQueryIntent {
  const q = question.toLowerCase().trim()

  // 1. Preguntas exclusivas de paciente/derechohabiente (servicios y atención médica, NO personal)
  if (
    (PACIENTE_BENEFICIARIO_SIGNALS.test(q) || /derechos como paciente/i.test(q)) &&
    !/trabajador|trabajadora|base|sntss|categor[ií]a|salario|sueldo|vacaciones|antig[üu]edad/i.test(q)
  ) {
    return "PACIENTE_BENEFICIARIO"
  }

  // 2. Investigación laboral y actas administrativas (relación laboral patrón-trabajador)
  if (/investigaci[oó]n laboral|acta administrativa|rescisi[oó]n laboral|sanci[oó]n disciplinaria/i.test(q)) {
    return "LABORAL"
  }

  // 3. Impugnación o procesos internos del sindicato
  if (
    /impugnaci[oó]n|elecci[oó]n sindical|cuota sindical|sanci[oó]n sindical|comisi[oó]n de honor y justicia|estatuto/i.test(q)
  ) {
    return "SINDICAL"
  }

  // 4. Cambio de adscripción / traslados / permutas
  if (/cambio de adscripci[oó]n|adscripci[oó]n|traslado|permuta/i.test(q)) {
    return "CAMBIO_ADSCRIPCION"
  }

  // 5. Prestaciones laborales y aspectos contractuales
  if (CONTRACTUAL_SIGNALS.test(q)) {
    return "CONTRACTUAL"
  }

  // 6. Seguridad y salud en el trabajo
  if (SEGURIDAD_SALUD_SIGNALS.test(q)) {
    return "SEGURIDAD_SALUD"
  }

  // 7. Otros asuntos sindicales
  if (SINDICAL_SIGNALS.test(q)) {
    return "SINDICAL"
  }

  // 8. Institucional
  if (INSTITUCIONAL_SIGNALS.test(q)) {
    return "INSTITUCIONAL"
  }

  // 9. Por defecto: derechos laborales de trabajadores del IMSS
  return "LABORAL"
}

export type NormativePriority = 1 | 2 | 3

export function getNormativePriority(
  documentId: string,
  documentTitle: string = "",
  intent: WorkerQueryIntent = "LABORAL",
): NormativePriority {
  const docUpper = `${documentId} ${documentTitle}`.toUpperCase()

  // PACIENTE_BENEFICIARIO: Legislación sanitaria (LGS, NOMs de atención médica) es Prioridad 1
  if (intent === "PACIENTE_BENEFICIARIO") {
    if (
      docUpper.includes("SALUD") ||
      docUpper.includes("LGS") ||
      docUpper.includes("PRESTACIONES-MEDICAS") ||
      docUpper.includes("ATENCION MEDICA") ||
      docUpper.includes("PACIENTE") ||
      docUpper.includes("SSA")
    ) {
      return 1
    }
    if (docUpper.includes("LSS") || docUpper.includes("SEGURO SOCIAL")) {
      return 2
    }
    return 3
  }

  // SINDICAL (e.g. Impugnación sindical): Estatutos SNTSS es Prioridad 1, CCT/RIT es Prioridad 2
  if (intent === "SINDICAL") {
    if (docUpper.includes("ESTATUTO")) {
      return 1
    }
    if (
      docUpper.includes("CCT") ||
      docUpper.includes("CONTRATO COLECTIVO") ||
      docUpper.includes("CONTRATO-COLECTIVO") ||
      docUpper.includes("RIT") ||
      docUpper.includes("REGLAMENTO") ||
      docUpper.includes("SNTSS")
    ) {
      return 2
    }
    return 3
  }

  // CONTRACTUAL (e.g. Prestaciones laborales): CCT es Prioridad 1
  if (intent === "CONTRACTUAL") {
    if (
      docUpper.includes("CCT") ||
      docUpper.includes("CONTRATO COLECTIVO") ||
      docUpper.includes("CONTRATO-COLECTIVO") ||
      docUpper.includes("TABULADOR")
    ) {
      return 1
    }
    if (
      docUpper.includes("RIT") ||
      docUpper.includes("REGLAMENTO") ||
      docUpper.includes("ESTATUTO")
    ) {
      return 2
    }
    return 3
  }

  // CAMBIO_ADSCRIPCION: CCT y reglamentación laboral (Bolsa de Trabajo, Escalafón) son Prioridad 1
  if (intent === "CAMBIO_ADSCRIPCION") {
    if (
      docUpper.includes("CCT") ||
      docUpper.includes("CONTRATO COLECTIVO") ||
      docUpper.includes("CONTRATO-COLECTIVO") ||
      docUpper.includes("BOLSA DE TRABAJO") ||
      docUpper.includes("BOLSA-DE-TRABAJO") ||
      docUpper.includes("ESCALAFON") ||
      docUpper.includes("ESCALAFÓN")
    ) {
      return 1
    }
    if (docUpper.includes("RIT") || docUpper.includes("REGLAMENTO") || docUpper.includes("ESTATUTO")) {
      return 2
    }
    return 3
  }

  // SEGURIDAD_SALUD: NOMs de STPS/SSA y CCT son Prioridad 1
  if (intent === "SEGURIDAD_SALUD") {
    if (docUpper.includes("NOM-") || docUpper.includes("SEGURIDAD E HIGIENE") || docUpper.includes("CCT")) {
      return 1
    }
    if (docUpper.includes("RIT") || docUpper.includes("REGLAMENTO") || docUpper.includes("LSS")) {
      return 2
    }
    return 3
  }

  // LABORAL (e.g. Derechos como trabajador del IMSS): CCT y Estatutos SNTSS son Prioridad 1
  if (
    docUpper.includes("CCT") ||
    docUpper.includes("CONTRATO COLECTIVO") ||
    docUpper.includes("CONTRATO-COLECTIVO") ||
    docUpper.includes("ESTATUTO") ||
    docUpper.includes("SNTSS") ||
    docUpper.includes("TABULADOR")
  ) {
    return 1
  }

  // Prioridad 2: Reglamentos Interiores, Profesiogramas y Convenios Bilaterales
  if (
    docUpper.includes("RIT") ||
    docUpper.includes("REGLAMENTO") ||
    docUpper.includes("ESCALAFON") ||
    docUpper.includes("CAPACITACION") ||
    docUpper.includes("BECAS") ||
    docUpper.includes("PROFESIOGRAMA") ||
    docUpper.includes("CONVENIO") ||
    docUpper.includes("INSTRUCTIVO") ||
    docUpper.includes("PROCEDIMIENTO") ||
    docUpper.includes("CIRCULAR")
  ) {
    return 2
  }

  // Prioridad 3: Leyes generales (LFT, LSS, CPEUM, etc.)
  return 3
}

export function rerankByNormativePriority<T extends { documentId: string; documento: string; score: number }>(
  sources: T[],
  questionOrIntent: string | WorkerQueryIntent,
): T[] {
  const intent: WorkerQueryIntent =
    questionOrIntent === "LABORAL" ||
    questionOrIntent === "CONTRACTUAL" ||
    questionOrIntent === "SINDICAL" ||
    questionOrIntent === "CAMBIO_ADSCRIPCION" ||
    questionOrIntent === "INSTITUCIONAL" ||
    questionOrIntent === "SEGURIDAD_SALUD" ||
    questionOrIntent === "PACIENTE_BENEFICIARIO"
      ? questionOrIntent
      : classifyWorkerQueryIntent(questionOrIntent)

  return [...sources].sort((a, b) => {
    const pA = getNormativePriority(a.documentId, a.documento, intent)
    const pB = getNormativePriority(b.documentId, b.documento, intent)

    if (pA !== pB) {
      return pA - pB // 1 va antes que 2, 2 antes que 3
    }
    return b.score - a.score
  })
}

/** Presupuesto de tokens de salida por intención (punto 14). */
export const OUTPUT_BUDGET: Record<RetrievalIntent, number> = {
  EXACT_LOOKUP: 300,
  EXACT_EXPLAIN: 300,
  SPECIFIC_TOPIC: 400,
  BROAD_TOPIC: 500,
  LABOR_CASE: 550,
  FOLLOW_UP: 450,
}

/** Presupuesto de evidencias por intención (punto 7). Hard max 8. */
export const EVIDENCE_BUDGET: Record<RetrievalIntent, { min: number; max: number }> = {
  EXACT_LOOKUP: { min: 1, max: 3 },
  EXACT_EXPLAIN: { min: 3, max: 5 },
  SPECIFIC_TOPIC: { min: 4, max: 6 },
  BROAD_TOPIC: { min: 5, max: 8 },
  LABOR_CASE: { min: 5, max: 8 },
  FOLLOW_UP: { min: 4, max: 6 },
}

export const HARD_MAX_EVIDENCE = 8

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

/** Ubicación corta de una evidencia: tipo + número + página. */
export function evidenceLocation(s: RetrievedSource): string {
  const parts: string[] = []
  if (s.numero) {
    const label =
      s.tipo === "articulo" ? "Artículo" : s.tipo === "clausula" ? "Cláusula" : s.tipo
    parts.push(`${label} ${s.numero}`)
  }
  if (s.paginaInicio != null) parts.push(`pág. ${s.paginaInicio}`)
  return parts.join(" · ")
}

/**
 * Evidencia COMPACTA para el LLM (punto 9): solo lo esencial.
 * Sin UUID/SHA/scores/URLs largas/timestamps/JSON interno.
 * El modelo ya no ve cadenas de servicio; solo etiqueta + documento + cita + texto.
 */
export function buildCompactEvidence(sources: RetrievedSource[]): string {
  return sources
    .map((s) => {
      const loc = evidenceLocation(s)
      const head = `[${s.id}] ${s.documento}`
      const ref = loc ? ` · ${loc}` : ""
      const badge = s.pendingReview ? " · [VIGENCIA POR REVISAR]" : ""
      return `${head}${ref}${badge}\n${s.fragmento}`
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

/**
 * Punto 18+.5: resolución de citaciones con FAIL-CLOSED.
 *
 * - Si la primera pasada tiene ≥1 cita válida (o no hay evidencia normativa),
 *   se entrega el texto saneado (los [S#] inválidos ya fueron removidos).
 * - Si NO hay citas válidas, se regenera UNA vez (`regenResposta`).
 * - Si tras la regeneración sigue sin cita válida → FAIL-CLOSED: nunca se
 *   entrega orientación normativa factual sin una fuente validada.
 *
 * Máximo: 1 generación inicial + 1 regeneración. Sin tercera llamada.
 */
export type CitationOutcome =
  | { kind: "deliver"; respuesta: string; citedIds: string[] }
  | { kind: "fail_closed"; respuesta: string; invalidIds: string[] }

export function finalizeCitation(
  respuesta: string,
  sources: RetrievedSource[],
  regenResposta: string | null,
): CitationOutcome {
  const first = validateCitations(respuesta, sources)
  if (first.citedIds.length > 0 || sources.length === 0) {
    return { kind: "deliver", respuesta: first.respuesta, citedIds: first.citedIds }
  }
  if (regenResposta != null) {
    const second = validateCitations(regenResposta, sources)
    if (second.citedIds.length > 0) {
      return { kind: "deliver", respuesta: second.respuesta, citedIds: second.citedIds }
    }
  }
  return { kind: "fail_closed", respuesta: first.respuesta, invalidIds: first.invalidIdsRemoved }
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

/**
 * Expansión de consulta SOLO para retrieval (nunca para redactar):
 * las preguntas amplias se enriquecen con conceptos del corpus para que
 * FTS/vector encuentren evidencia representativa.
 */
export const BROAD_EXPANSION_TERMS =
  " derechos obligaciones trabajadores prestaciones salario jornada vacaciones aguinaldo prima dominical descanso seguridad social capacitacion escalafon"

export function expandForRetrieval(question: string, intent: RetrievalIntent): string {
  return intent === "BROAD_TOPIC" ? `${question} ${BROAD_EXPANSION_TERMS}` : question
}
