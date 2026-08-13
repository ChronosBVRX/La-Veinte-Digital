/**
 * Índice de búsqueda de la Guía de mi Tarjetón.
 *
 * Combina el catálogo de conceptos del Knowledge Pack (src/data/guia-tarjeton)
 * con los campos y secciones del tarjetón. La búsqueda normaliza códigos,
 * nombres, términos y descripciones.
 */
import { guideConcepts } from "@/data/guia-tarjeton/concepts"
import { guideFields } from "@/data/guia-tarjeton/fields"
import { guideSections } from "@/data/guia-tarjeton/sections"
import { normalizeText, normalizeCode } from "@/features/tarjeton-guia/lib/normalize"
import type { GuideConceptCategory, GuideSearchResult } from "@/features/tarjeton-guia/lib/types"
import { shortDescriptionFor } from "@/features/tarjeton-guia/lib/catalog"

export interface SearchableEntry {
  key: string
  code: string
  name: string
  kind: GuideConceptCategory
  terms: string[]
  text: string
  href: string
}

const FIELD_PREFIX = "campo"

function buildEntries(): SearchableEntry[] {
  const entries: SearchableEntry[] = []

  for (const c of guideConcepts) {
    const norm = normalizeText(c.name)
    entries.push({
      key: `concept:${c.code}`,
      code: c.code,
      name: c.name,
      kind: c.kind === "perception" ? "perception" : "deduction",
      terms: [c.code, ...(c.searchTerms ?? []).map(normalizeText), norm],
      text: norm,
      href: `/guia/conceptos/${c.code}`,
    })
  }

  for (const f of guideFields) {
    const norm = normalizeText(f.name)
    entries.push({
      key: `field:${f.id}`,
      code: String(f.id),
      name: f.name,
      kind: "field",
      terms: [String(f.id), `${FIELD_PREFIX} ${f.id}`, norm],
      text: norm,
      href: `/guia/campos/${f.id}`,
    })
  }

  for (const s of guideSections) {
    const norm = normalizeText(s.name)
    entries.push({
      key: `section:${s.id}`,
      code: s.id,
      name: s.name,
      kind: "section",
      terms: [s.id, norm, normalizeText(s.simple)],
      text: `${norm} ${normalizeText(s.simple)}`,
      href: `/guia/tarjeton#${s.id}`,
    })
  }

  return entries
}

const index: SearchableEntry[] = buildEntries()

/** Busca en el índice combinado y devuelve resultados ordenados por relevancia. */
export function searchGuide(rawQuery: string, limit = 8): GuideSearchResult[] {
  const q = normalizeText(rawQuery)
  if (q.length === 0) return []

  const code = normalizeCode(q)

  const scored: Array<{ entry: SearchableEntry; score: number }> = []

  for (const entry of index) {
    let score = 0

    if (code !== null) {
      if (entry.code === code) score += 1000
      else if (entry.kind === "perception" || entry.kind === "deduction") {
        // El nombre puede empezar por el código ("002 Sueldo base").
        if (entry.text.startsWith(code)) score += 500
      }
    }

    if (entry.text === q) score += 400
    else if (entry.text.startsWith(q)) score += 200

    for (const term of entry.terms) {
      if (term === q) score += 300
      else if (term.startsWith(q)) score += 100
      else if (term.includes(q) && q.length >= 2) score += 40
    }

    // Términos parciales dentro del nombre (mínimo 3 caracteres).
    if (q.length >= 3 && entry.text.includes(q)) score += 30

    if (score > 0) scored.push({ entry, score })
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(({ entry, score }) => ({
    key: entry.key,
    code: entry.code,
    name: entry.name,
    shortDescription: shortDescriptionFor(entry.kind, entry.code),
    category: entry.kind,
    href: entry.href,
    score,
  }))
}

export function getSearchEntryByCode(code: string): SearchableEntry | null {
  const norm = normalizeCode(code)
  if (!norm) return null
  return index.find((e) => e.code === norm) ?? null
}

export function guideIndexSize(): { concepts: number; fields: number; sections: number } {
  return {
    concepts: guideConcepts.length,
    fields: guideFields.length,
    sections: guideSections.length,
  }
}
