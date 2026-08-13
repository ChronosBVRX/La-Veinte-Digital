/**
 * Catálogo educativo de la Guía de mi Tarjetón.
 *
 * Une la base de conocimiento (Knowledge Pack del Manual IMSS 2023) con el
 * contenido curado del módulo. Los valores reales de un trabajador provienen
 * del parser/tarjetón de La Veinte, nunca de estos archivos.
 */
import { guideConcepts, type GuideConcept } from "@/data/guia-tarjeton/concepts"
import { guideFields } from "@/data/guia-tarjeton/fields"
import { guideRelations } from "@/data/guia-tarjeton/relations"
import { guideSections } from "@/data/guia-tarjeton/sections"
import { guideSources } from "@/data/guia-tarjeton/sources"
import { conceptDetails } from "@/features/tarjeton-guia/data/concept-details"
import { fieldDetails } from "@/features/tarjeton-guia/data/field-details"
import { normalizeCode } from "@/features/tarjeton-guia/lib/normalize"
import type { GuideConceptCategory, GuideConceptRef } from "@/features/tarjeton-guia/lib/types"

export interface GuideConceptEntry extends GuideConcept {
  details: (typeof conceptDetails)[string] | null
}

const conceptMap = new Map<string, GuideConcept>()
for (const c of guideConcepts) {
  conceptMap.set(c.code, c)
}

/** Devuelve un concepto del catálogo por código normalizado ("33" → "033"). */
export function getGuideConcept(code: string): GuideConcept | null {
  const norm = normalizeCode(code)
  if (!norm) return null
  return conceptMap.get(norm) ?? null
}

export function getGuideConceptWithDetails(code: string): GuideConceptEntry | null {
  const concept = getGuideConcept(code)
  if (!concept) return null
  const norm = normalizeCode(code)!
  return {
    ...concept,
    details: conceptDetails[norm] ?? null,
  }
}

/** Devuelve un campo por id (número o string). */
export function getGuideField(id: string | number): (typeof guideFields)[number] | null {
  return guideFields.find((f) => String(f.id) === String(id)) ?? null
}

/** Devuelve la descripción corta de un concepto para listas y resultados. */
export function shortDescriptionFor(kind: GuideConceptCategory, code: string): string {
  if (kind === "perception" || kind === "deduction") {
    const c = getGuideConcept(code)
    if (!c) return ""
    const details = conceptDetails[normalizeCode(code) ?? ""]
    if (details) return details.simple
    const manual = c.manual2023.detail[0]?.text
    if (manual) return manual.slice(0, 110).replace(/\s+/g, " ").trim() + "…"
    return ""
  }
  const field = getGuideField(code)
  if (field) {
    const details = fieldDetails[String(field.id)]
    if (details) return details.simple
    if (field.sourceText) return field.sourceText.slice(0, 110).replace(/\s+/g, " ").trim() + "…"
  }
  return ""
}

/** Devuelve las relaciones navegables de un concepto (curadas + del Knowledge Pack). */
export function getRelationsForConcept(code: string): Array<{ ref: GuideConceptRef; label: string; why?: string; source: "manual-2023-reference" | "curado" }> {
  const norm = normalizeCode(code)
  const out: Array<{ ref: GuideConceptRef; label: string; why?: string; source: "manual-2023-reference" | "curado" }> = []

  const curated = conceptDetails[norm ?? ""]?.related
  for (const r of curated ?? []) {
    out.push({ ref: r.ref, label: r.label, why: r.why, source: "curado" })
  }

  for (const rel of guideRelations) {
    if (rel.from !== `concept:${norm}`) continue
    for (const to of rel.to) {
      const label = resolveRefLabel(to)
      if (label && !out.some((o) => o.ref === to)) {
        out.push({ ref: to as GuideConceptRef, label, why: rel.basis, source: "manual-2023-reference" })
      }
    }
  }

  return out
}

/** Devuelve las relaciones navegables de un campo. */
export function getRelationsForField(id: string | number): Array<{ ref: GuideConceptRef; label: string; why?: string; source: "manual-2023-reference" | "curado" }> {
  const out: Array<{ ref: GuideConceptRef; label: string; why?: string; source: "manual-2023-reference" | "curado" }> = []

  const curated = fieldDetails[String(id)]?.related
  for (const r of curated ?? []) {
    out.push({ ref: r.ref as GuideConceptRef, label: r.label, why: undefined, source: "curado" })
  }

  for (const rel of guideRelations) {
    if (rel.from !== `field:${id}`) continue
    for (const to of rel.to) {
      const label = resolveRefLabel(to)
      if (label && !out.some((o) => o.ref === to)) {
        out.push({ ref: to as GuideConceptRef, label, why: rel.basis, source: "manual-2023-reference" })
      }
    }
  }

  return out
}

/** Nombre legible de una referencia (`concept:033` → "Estímulo por puntualidad"). */
export function resolveRefLabel(ref: string): string | null {
  if (ref.startsWith("concept:")) {
    const c = getGuideConcept(ref.slice(8))
    return c ? c.name : null
  }
  if (ref.startsWith("field:")) {
    const f = getGuideField(ref.slice(6))
    return f ? f.name : null
  }
  if (ref.startsWith("section:")) {
    const id = ref.slice(8)
    const section = guideSections.find((s) => s.id === id)
    return section ? section.name : null
  }
  return null
}

/** Href navegable de una referencia. */
export function resolveRefHref(ref: string): string | null {
  if (ref.startsWith("concept:")) return `/guia/conceptos/${ref.slice(8)}`
  if (ref.startsWith("field:")) return `/guia/campos/${ref.slice(6)}`
  if (ref.startsWith("section:")) return `/guia/tarjeton#${ref.slice(8)}`
  return null
}

/** Fuente del catálogo por id (para integraciones de data, no se muestra como cita). */
export function getSourceById(id: string) {
  return guideSources.find((s) => s.id === id) ?? null
}

/** ¿El concepto requiere validación vigente? (para metadata interna, no alertas). */
export function requiresCurrentValidation(code: string): boolean {
  const c = getGuideConcept(code)
  return c?.requiresCurrentValidation ?? false
}

export function catalogCounts(): { perceptions: number; deductions: number } {
  let perceptions = 0
  let deductions = 0
  for (const c of guideConcepts) {
    if (c.kind === "perception") perceptions++
    else deductions++
  }
  return { perceptions, deductions }
}
