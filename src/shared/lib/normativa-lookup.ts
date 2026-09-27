import cctClausesRaw from "@/shared/data/normativa/cct-clausulas.json"
import estatutosArticlesRaw from "@/shared/data/normativa/estatutos-articulos.json"

export interface NormativaItem {
  id: string
  documentId: string
  documento: string
  numero: string
  titulo: string
  capitulo: string
  paginaPdf: number
  texto: string
}

export type NormativaClause = NormativaItem
export type NormativaArticle = NormativaItem

const cctClauses: NormativaClause[] = cctClausesRaw as NormativaClause[]
const estatutosArticles: NormativaArticle[] = estatutosArticlesRaw as NormativaArticle[]

// Map for O(1) clause lookup by normalized number
const cctByNum = new Map<string, NormativaClause>()
for (const c of cctClauses) {
  const norm = normalizeNumber(c.numero)
  cctByNum.set(norm, c)
}

// Map for O(1) article lookup by normalized number
const estByNum = new Map<string, NormativaArticle>()
for (const a of estatutosArticles) {
  const norm = normalizeNumber(a.numero)
  estByNum.set(norm, a)
}

function normalizeNumber(val: string | number): string {
  return String(val)
    .toLowerCase()
    .replace(/^cl[áa]usula\s+/i, "")
    .replace(/^art[íi]culo\s+/i, "")
    .replace(/[^0-9a-z]/g, "")
    .trim()
}

/**
 * Obtiene la cláusula del CCT por su número (ej. 47, "47", "110", "63 Bis").
 */
export function getClausula(query: number | string): NormativaClause | undefined {
  if (query == null) return undefined
  const norm = normalizeNumber(query)
  return cctByNum.get(norm)
}

/**
 * Obtiene el artículo de los Estatutos SNTSS por su número (ej. 1, "25", "104").
 */
export function getArticuloEstatutos(query: number | string): NormativaArticle | undefined {
  if (query == null) return undefined
  const norm = normalizeNumber(query)
  return estByNum.get(norm)
}

/**
 * Mapeo directo entre conceptos clave del tarjetón / nómina IMSS y su cláusula CCT fundante.
 */
export const CONCEPT_TO_CLAUSE_MAP: Record<string, string> = {
  // Percepciones
  "001": "100",     // Sueldo base / Tabulador de Sueldos
  "002": "100",     // Sobresueldo
  "003": "91",      // Infectocontagiosidad / Alto Riesgo
  "007": "42",      // Jornada extraordinaria / Tiempo extraordinario
  "011": "47",      // Prima vacacional / Vacaciones
  "012": "47",      // Vacaciones no disfrutadas
  "013": "42",      // Días de descanso laborados
  "015": "107",     // Ajuste de aguinaldo
  "022": "139",     // Ayuda de libros / Dotación para fomento educativo
  "023": "107",     // Aguinaldo (tres meses de sueldo tabular)
  "024": "93",      // Estímulo de asistencia
  "025": "93",      // Estímulo de puntualidad (y Cláusula 38 tolerancia)
  "030": "91",      // Riesgos profesionales
  "032": "47",      // Prima dominical
  "045": "110",     // Fondo de retiro / RJP
  "050": "144",     // Fondo de Ahorro
  "054": "91",      // Ayuda para actividades de alto riesgo / infectocontagiosidad
  "058": "80",      // Compensación por antigüedad (quinquenios)
  "063": "63 Bis",  // Ayuda para renta
  "070": "144",     // Ajuste de fondo de ahorro

  // Deducciones sindicato y créditos
  "104": "116",     // Préstamo hipotecario / FOVI
  "107": "96",      // Cuota sindical ordinaria
  "108": "96",      // Cuota sindical extraordinaria
  "152": "110",     // Aportación Régimen de Jubilaciones y Pensiones (RJP)
}

/**
 * Devuelve la cláusula aplicable para un código de concepto del tarjetón IMSS.
 */
export function findNormativaByConceptCode(conceptCode: string): NormativaClause | undefined {
  const clean = conceptCode.padStart(3, "0")
  const clauseNum = CONCEPT_TO_CLAUSE_MAP[clean]
  if (!clauseNum) return undefined
  return getClausula(clauseNum)
}

/**
 * Búsqueda de texto completo offline dentro del catálogo de cláusulas y estatutos.
 */
export function searchNormativaOffline(
  termino: string,
  scope: "all" | "cct" | "estatutos" = "all"
): Array<NormativaItem & { tipo: "cct" | "estatuto" }> {
  if (!termino || termino.trim().length < 2) return []
  const clean = termino.toLowerCase().trim()
  const results: Array<NormativaItem & { tipo: "cct" | "estatuto" }> = []

  // Check if term directly searches a clause number (e.g. "47", "clausula 144")
  const clauseMatch = clean.match(/cl[áa]usula\s+(\d+\s*(?:bis|ter)?)/i)
  if (clauseMatch && (scope === "all" || scope === "cct")) {
    const c = getClausula(clauseMatch[1])
    if (c) results.push({ ...c, tipo: "cct" })
  }

  const artMatch = clean.match(/art[íi]culo\s+(\d+\s*(?:bis|ter)?)/i)
  if (artMatch && (scope === "all" || scope === "estatutos")) {
    const a = getArticuloEstatutos(artMatch[1])
    if (a) results.push({ ...a, tipo: "estatuto" })
  }

  if (scope === "all" || scope === "cct") {
    for (const c of cctClauses) {
      if (results.some((r) => r.id === c.id)) continue
      if (
        c.numero.toLowerCase() === clean ||
        c.titulo.toLowerCase().includes(clean) ||
        c.capitulo.toLowerCase().includes(clean) ||
        c.texto.toLowerCase().includes(clean)
      ) {
        results.push({ ...c, tipo: "cct" })
      }
    }
  }

  if (scope === "all" || scope === "estatutos") {
    for (const a of estatutosArticles) {
      if (results.some((r) => r.id === a.id)) continue
      if (
        a.numero.toLowerCase() === clean ||
        a.titulo.toLowerCase().includes(clean) ||
        a.capitulo.toLowerCase().includes(clean) ||
        a.texto.toLowerCase().includes(clean)
      ) {
        results.push({ ...a, tipo: "estatuto" })
      }
    }
  }

  return results
}

export function getAllClausulas(): NormativaClause[] {
  return cctClauses
}

export function getAllArticulosEstatutos(): NormativaArticle[] {
  return estatutosArticles
}
