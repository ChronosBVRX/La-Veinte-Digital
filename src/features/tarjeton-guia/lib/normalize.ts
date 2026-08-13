/**
 * Normalización de texto y códigos para la Guía de mi Tarjetón.
 *
 * Permite buscar conceptos por código (33 → 033), nombre o términos
 * parciales, ignorando mayúsculas, acentos y espacios.
 */

/** Normaliza texto para búsqueda: minúsculas, sin acentos, espacios colapsados. */
export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Convierte un código libre a su forma canónica de 3 dígitos ("33" → "033"). */
export function normalizeCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 0 || digits.length > 3) return null
  return digits.padStart(3, "0")
}

/** Normaliza una referencia tipo "concept:033" o "field:13". */
export function normalizeRef(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\b(concepto|campo|seccion)\s*:?\s*(\d{1,3})/g, (m, p, n) => (p === "concepto" ? `concept:${n.padStart(3, "0")}` : m))
}

/** Resuelve si un texto es un código de concepto ("033", "33"). */
export function looksLikeCode(raw: string): boolean {
  const t = raw.trim()
  return /^\d{1,3}$/.test(t) || /^\d{3}/.test(t)
}

/** Limpia un nombre de concepto para comparar sin signos de puntuación raros del PDF ni prefijo de código. */
export function cleanConceptName(raw: string): string {
  return raw
    .replace(/^\s*\d{1,3}\s+/, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}
