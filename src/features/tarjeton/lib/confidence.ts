/**
 * Confianza por campo extraído del tarjetón.
 *
 * Reglas:
 * - Texto nativo, misma fila y columna: alta (0.98)
 * - Texto multilínea reconstruido: media-alta (0.90)
 * - OCR con confianza alta (>=0.9): media (0.85)
 * - Valor inferido por proximidad: baja (0.70)
 * - Importe OCR ambiguo: requiere revisión (0.60)
 *
 * Criterios de revisión:
 * - confianza >= 0.95 → confirmado visualmente
 * - 0.85–0.94       → revisar si es crítico
 * - < 0.85          → revisión obligatoria
 */
import type { TarjetonExtractionMethod } from "@/shared/contracts/tarjeton-import"

export const CRITICAL_FIELDS = new Set<string>([
  "matricula",
  "categoria",
  "antiguedad",
  "periodo",
  "importes",
  "totales",
])

export type FieldConfidenceLevel =
  | "high"        // >= 0.95
  | "medium"      // 0.85–0.94
  | "low"         // < 0.85

export function confidenceLevel(confidence: number): FieldConfidenceLevel {
  if (confidence >= 0.95) return "high"
  if (confidence >= 0.85) return "medium"
  return "low"
}

export function requiresReviewForConfidence(confidence: number, critical: boolean): boolean {
  if (critical) return confidence < 0.95
  return confidence < 0.85
}

/** Confianza base según método y calidad del reconocimiento (0..1). */
export function baseFieldConfidence(method: TarjetonExtractionMethod, ocrConfidence?: number): number {
  if (method === "native_text") return 0.98
  if (method === "ocr") {
    const c = ocrConfidence ?? 0.8
    if (c >= 0.9) return 0.85
    if (c >= 0.75) return 0.75
    return 0.6
  }
  // hybrid: texto nativo donde existe, OCR donde falta.
  return 0.9
}

export function multilineAdjustment(confidence: number, multiline: boolean): number {
  return multiline ? confidence - 0.08 : confidence
}

export function inferredAdjustment(confidence: number): number {
  return Math.max(0, confidence - 0.28)
}

export function clampConfidence(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * Confianza global del documento: promedio ponderado de líneas
 * (los importes pesan más porque son los datos críticos).
 */
export function globalTarjetonConfidence(
  lines: Array<{ confidence: number; kind?: "earning" | "deduction" }>,
): number {
  if (lines.length === 0) return 0
  let weightSum = 0
  let total = 0
  for (const line of lines) {
    const weight = line.kind === "earning" || line.kind === "deduction" ? 2 : 1
    weightSum += weight
    total += line.confidence * weight
  }
  return clampConfidence(total / weightSum)
}
