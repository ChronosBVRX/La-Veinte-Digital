/**
 * Detector de la plantilla de tarjetón IMSS.
 *
 * Busca anclas fuertes en el texto reconstruido. La plantilla se considera
 * detectada si aparecen al menos 5 anclas, incluyendo obligatoriamente:
 * - RECIBO DE PAGO DE NOMINA
 * - PERCEPCIONES
 * - DEDUCCIONES
 *
 * Si no coincide, el importador no intenta completar campos por conjetura.
 */
import type { ReconstructedLine } from "./line-reconstruction"

interface Anchor {
  label: string
  required?: boolean
}

export const IMSS_TARJETON_ANCHORS: Anchor[] = [
  { label: "INSTITUTO MEXICANO DEL SEGURO SOCIAL" },
  { label: "RECIBO DE PAGO DE NOMINA", required: true },
  { label: "PERCEPCIONES" },
  { label: "DEDUCCIONES" },
  { label: "TOTAL PERCEPCIONES" },
  { label: "TOTAL DEDUCCIONES" },
  { label: "ANTIGUEDAD EFECTIVA" },
  { label: "NOMBRE CATEGORIA/PUESTO" },
  { label: "MATRICULA" },
  { label: "OBSERVACIONES" },
  { label: "LIQUIDO" },
  { label: "FECHA DE INGRESO" },
  { label: "PERIODO DE PAGO" },
  { label: "CERTIFICACION" },
]

export interface TemplateDetectionResult {
  detected: boolean
  score: number
  matchedAnchors: string[]
  missingRequired: string[]
}

export function detectImssTemplate(lines: ReconstructedLine[]): TemplateDetectionResult {
  const text = lines.map((l) => l.norm).join(" | ")

  const matchedAnchors: string[] = []
  const missingRequired: string[] = []

  for (const anchor of IMSS_TARJETON_ANCHORS) {
    if (text.includes(anchor.label)) {
      matchedAnchors.push(anchor.label)
    } else if (anchor.required) {
      missingRequired.push(anchor.label)
    }
  }

  const requiredOk = missingRequired.length === 0
  const score = matchedAnchors.length / IMSS_TARJETON_ANCHORS.length

  return {
    detected: requiredOk && matchedAnchors.length >= 5,
    score,
    matchedAnchors,
    missingRequired,
  }
}

export const TEMPLATE_NOT_DETECTED_MESSAGE =
  "Este archivo no parece ser un tarjetón de pago del IMSS."
