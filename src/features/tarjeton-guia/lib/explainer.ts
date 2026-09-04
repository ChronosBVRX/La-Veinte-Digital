/**
 * "Mi quincena explicada": construcción de la historia paso a paso a partir
 * de un tarjetón real. Solo usa datos presentes en el tarjetón.
 */
import type { GuidePayslip, GuidePayslipLine } from "@/features/tarjeton-guia/lib/types"
import { conceptDetails } from "@/features/tarjeton-guia/data/concept-details"
import { normalizeCode } from "@/features/tarjeton-guia/lib/normalize"

export type ExplainerStepKind =
  | "sueldo"
  | "estimulo"
  | "percepcion"
  | "deduccion"
  | "resumen"
  | "cambio"

export interface ExplainerStep {
  kind: ExplainerStepKind
  emoji: string
  title: string
  subtitle?: string
  line?: GuidePayslipLine
  explanation: string
  /** CTA opcional. */
  cta?: { label: string; href: string }
  /** Observaciones asociadas al concepto (solo si existen en el tarjetón). */
  observationText?: string
}

const EMOJI_BY_CODE: Record<string, string> = {
  "002": "💵",
  "011": "🏠",
  "020": "🏠",
  "022": "🏠",
  "029": "🏖️",
  "030": "🌞",
  "032": "🎯",
  "033": "🎯",
  "037": "⏱️",
  "049": "🎄",
  "050": "🛒",
  "055": "💰",
  "151": "🧾",
  "152": "🏦",
  "107": "🏦",
  "108": "🏦",
  "154": "🏡",
  "170": "🏡",
}

function emojiFor(code: string, fallback: string): string {
  return EMOJI_BY_CODE[normalizeCode(code) ?? ""] ?? fallback
}

/** Separa un importe formateado si el tarjetón trae unidades o saldo en observaciones. */
function observationDetail(payslip: GuidePayslip, code: string): string | undefined {
  const obs = payslip.observations.filter((o) => o.conceptCode === code)
  if (obs.length === 0) return undefined
  const parts: string[] = []
  for (const o of obs) {
    if (o.duePeriod) parts.push(`Vencimiento: ${o.duePeriod}`)
    if (o.initialCharge != null) parts.push(`Cargo inicial: $${o.initialCharge.toLocaleString("es-MX")}`)
    if (o.units != null) parts.push(`Unidades: ${o.units}`)
    if (o.notes) parts.push(o.notes)
  }
  return parts.join(" · ")
}

/**
 * Construye los pasos de "Mi quincena explicada" para un tarjetón.
 * No inventa conceptos: cada paso proviene de una línea real del tarjetón.
 */
export function buildExplainer(payslip: GuidePayslip): ExplainerStep[] {
  const steps: ExplainerStep[] = []

  const earnings = [...payslip.earnings].sort((a, b) => b.amount - a.amount)
  const deductions = [...payslip.deductions].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  // 1. Sueldo (002) o percepción mayor.
  const sueldo = payslip.earnings.find((l) => l.code === "002") ?? earnings[0]
  if (sueldo) {
    steps.push({
      kind: "sueldo",
      emoji: "💵",
      title: sueldo.code === "002" ? "Tu sueldo" : "Tu pago principal",
      subtitle: `${sueldo.code} · ${sueldo.description}`,
      line: sueldo,
      explanation:
        sueldo.code === "002"
          ? `Recibiste $${sueldo.amount.toLocaleString("es-MX")} como sueldo base de esta quincena. Es la base de la mayoría de tus prestaciones.`
          : `Recibiste $${sueldo.amount.toLocaleString("es-MX")} por este concepto. Es la percepción más alta de tu tarjetón.`,
      cta: {
        label: "Ver cómo se relaciona con otros pagos",
        href: `/guia/conceptos/${sueldo.code}`,
      },
    })
  }

  // 2–N. Percepciones relevantes (ordenadas por monto, sin repetir el sueldo).
  const skipCodes = new Set<string>()
  if (sueldo) skipCodes.add(sueldo.code)

  const estimateCodes = ["032", "033", "029", "022", "049", "037"]
  const ordered = [
    ...estimateCodes.map((c) => payslip.earnings.find((l) => l.code === c)).filter((l): l is GuidePayslipLine => !!l),
    ...payslip.earnings.filter((l) => !skipCodes.has(l.code) && !estimateCodes.includes(l.code)).slice(0, 6),
  ]
  const unique: GuidePayslipLine[] = []
  const seen = new Set<string>()
  for (const l of ordered) {
    if (seen.has(l.code)) continue
    seen.add(l.code)
    unique.push(l)
  }

  for (const line of unique.slice(0, 5)) {
    const detail = conceptDetails[line.code]
    const kind: ExplainerStepKind = ["032", "033"].includes(line.code) ? "estimulo" : "percepcion"
    const titles: Record<string, string> = {
      "032": "Recibiste un estímulo",
      "033": "Recibiste un estímulo",
      "029": "Tus vacaciones pagadas",
      "022": "Tu antigüedad cuenta",
      "049": "Tu aguinaldo",
      "037": "Tu tiempo extra",
    }
    const obs = observationDetail(payslip, line.code)
    steps.push({
      kind,
      emoji: emojiFor(line.code, "✨"),
      title: titles[line.code] ?? `Tu pago de ${line.description || `concepto ${line.code}`}`,
      subtitle: `${line.code} · ${line.description}`,
      line,
      explanation: detail?.simple
        ? `${detail.simple} En esta quincena recibiste $${line.amount.toLocaleString("es-MX")}.`
        : `En esta quincena recibiste $${line.amount.toLocaleString("es-MX")} por el concepto ${line.code || ""}.`,
      cta: { label: "¿Por qué lo recibí?", href: `/guia/conceptos/${line.code}` },
      observationText: obs,
    })
  }

  // Deducciones principales.
  const seenDed = new Set<string>()
  for (const line of deductions) {
    if (seenDed.has(line.code)) continue
    seenDed.add(line.code)
    const obs = observationDetail(payslip, line.code)
    const amountAbs = Math.abs(line.amount)
    steps.push({
      kind: "deduccion",
      emoji: emojiFor(line.code, "🔻"),
      title: line.code === "151" ? "Lo que se retuvo de impuestos" : "Este descuento continúa",
      subtitle: `${line.code} · ${line.description}`,
      line,
      explanation:
        line.code === "151"
          ? `Se te retuvieron $${amountAbs.toLocaleString("es-MX")} de Impuesto Sobre la Renta conforme a tus percepciones gravadas de la quincena.`
          : `Se te descontaron $${amountAbs.toLocaleString("es-MX")} por ${line.description || `el concepto ${line.code}`}.`,
      cta: { label: "Ver qué es este descuento", href: `/guia/conceptos/${line.code}` },
      observationText: obs,
    })
    if (steps.filter((s) => s.kind === "deduccion").length >= 3) break
  }

  // Resumen final.
  const hasZeroConceptsWithTotals =
    payslip.earnings.length === 0 &&
    payslip.deductions.length === 0 &&
    (payslip.netPay != null || payslip.totalEarnings != null || payslip.totalDeductions != null)

  const lineas = hasZeroConceptsWithTotals
    ? "Detectamos los totales de tu tarjetón, pero no pudimos leer el detalle de los conceptos."
    : `Detectamos ${payslip.earnings.length} percepciones y ${payslip.deductions.length} deducciones en tu tarjetón.`

  steps.push({
    kind: "resumen",
    emoji: hasZeroConceptsWithTotals ? "⚠️" : "📊",
    title: hasZeroConceptsWithTotals ? "Detalle pendiente de lectura" : "Tu pago en pocas palabras",
    subtitle: "Resumen de esta quincena",
    explanation: lineas,
    cta: hasZeroConceptsWithTotals
      ? { label: "Revisar o volver a subir tarjetón", href: "/profile/mi-informacion-laboral" }
      : { label: "Revisar mi quincena", href: "/guia/mi-quincena?vista=revisar" },
  })

  return steps
}

/** Conteo para el encabezado "Mi quincena". */
export function buildQuincenaSummary(payslip: GuidePayslip) {
  return {
    perceptions: payslip.earnings.length,
    deductions: payslip.deductions.length,
    netPay: payslip.netPay,
    totalEarnings: payslip.totalEarnings,
    totalDeductions: payslip.totalDeductions,
    periodRaw: payslip.periodRaw,
  }
}

/** "Lo que recibiste / Lo que te descontaron / Lo que cambió". */
export function buildPaycheckBrief(payslip: GuidePayslip, previous?: GuidePayslip | null) {
  const topEarnings = [...payslip.earnings].sort((a, b) => b.amount - a.amount).slice(0, 5)
  const topDeductions = [...payslip.deductions].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 5)

  let changes: Array<{ type: "nuevo" | "desaparecio" | "subio" | "bajo"; code: string; label: string; previousAmount?: number; amount?: number }> = []
  if (previous) {
    const prevCodes = new Set(previous.earnings.concat(previous.deductions).map((l) => normalizeCode(l.code) ?? l.code))
    const currCodes = new Set(payslip.earnings.concat(payslip.deductions).map((l) => normalizeCode(l.code) ?? l.code))

    for (const line of payslip.earnings.concat(payslip.deductions)) {
      const code = normalizeCode(line.code) ?? line.code
      if (!prevCodes.has(code)) {
        changes.push({ type: "nuevo", code, label: line.description || `concepto ${code}`, amount: line.amount })
      } else {
        const prevLine = previous.earnings.concat(previous.deductions).find((l) => {
          const lc = normalizeCode(l.code)
          const cc = normalizeCode(line.code)
          return (lc != null && cc != null && lc === cc) || (lc == null && cc == null && l.code === line.code)
        })
        if (prevLine && Math.abs(prevLine.amount - line.amount) > 0.01) {
          changes.push({
            type: Math.abs(line.amount) > Math.abs(prevLine.amount) ? "subio" : "bajo",
            code,
            label: line.description || `concepto ${code}`,
            previousAmount: prevLine.amount,
            amount: line.amount,
          })
        }
      }
    }
    for (const line of previous.earnings.concat(previous.deductions)) {
      const code = normalizeCode(line.code) ?? line.code
      if (!currCodes.has(code)) {
        changes.push({ type: "desaparecio", code, label: line.description || `concepto ${code}`, previousAmount: line.amount })
      }
    }
    changes = changes.slice(0, 6)
  }

  return { topEarnings, topDeductions, changes }
}
