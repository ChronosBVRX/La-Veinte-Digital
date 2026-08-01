/**
 * Parser de observaciones del tarjetón IMSS.
 *
 * Conserva todas las filas y los duplicados. Una observación puede
 * contener: código, importe, vencimiento, unidades, número de control,
 * cargo inicial y texto libre.
 */
import type { TarjetonObservation } from "@/shared/contracts/tarjeton-import"
import type { ReconstructedLine } from "./line-reconstruction"
import { findLineSpan } from "./line-reconstruction"
import { parseImssMoney } from "./money-parser"

const OBS_PATTERN = /^(\d{3})\s+(.*)$/

export function parseImssObservations(lines: ReconstructedLine[]): TarjetonObservation[] {
  const result: TarjetonObservation[] = []

  const span = findLineSpan(lines, "OBSERVACIONES", "CERTIFICACION")
  if (!span) return result

  for (let i = span.start + 1; i < span.end; i++) {
    const line = lines[i]
    if (line.norm.includes("OBSERVACIONES")) continue
    const text = line.text.trim()
    if (!text) continue

    const match = text.match(OBS_PATTERN)
    if (match) {
      const rest = match[2].trim()
      const obs: TarjetonObservation = {
        lineIndex: i,
        conceptCode: match[1],
        notes: rest || undefined,
      }

      // Importe al final de la línea: "055 400.00" o "055 RETROACTIVO 400.00"
      const amountMatch = rest.match(/(-?[\d\s,]+\.\d{2})\s*$/)
      if (amountMatch) {
        const amount = parseImssMoney(amountMatch[1])
        if (amount !== undefined) {
          obs.amount = amount
          obs.notes = rest.slice(0, rest.length - amountMatch[1].length).trim() || undefined
        }
      }

      // Vencimiento en formato "2026014" (se conserva el texto original).
      const dueMatch = rest.match(/\b(20\d{5,7})\b/)
      if (dueMatch) {
        obs.duePeriod = dueMatch[1]
      }

      // Unidades: "3 UNIDADES" o "3 UDS"
      const unitsMatch = rest.match(/\b(\d+)\s*(?:UNIDADES?|UDS?|DIAS)\b/i)
      if (unitsMatch) {
        obs.units = Number(unitsMatch[1])
      }

      // Número de control.
      const controlMatch = rest.match(/\bCONTROL[:\s]+(\d+)\b/i)
      if (controlMatch) {
        obs.controlNumber = controlMatch[1]
      }

      // Cargo inicial.
      const chargeMatch = rest.match(/\b(?:CARGO INICIAL|CARGO)\s*[:=]?\s*(-?[\d\s,]+\.\d{2})\b/i)
      if (chargeMatch) {
        const charge = parseImssMoney(chargeMatch[1])
        if (charge !== undefined) obs.initialCharge = charge
      }

      result.push(obs)
    } else {
      // Texto libre: solo si parece observación (no encabezado/total).
      if (/^(?:PERCEPCIONES|DEDUCCIONES|TOTAL|LIQUIDO|FECHA)/i.test(text)) continue
      result.push({
        lineIndex: i,
        conceptCode: "",
        notes: text,
      })
    }
  }

  return result
}
