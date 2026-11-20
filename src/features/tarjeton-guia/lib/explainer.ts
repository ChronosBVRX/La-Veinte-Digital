/**
 * "Mi quincena explicada": construcción de la historia paso a paso a partir
 * de un tarjetón real. Solo usa datos presentes en el tarjetón y sus observaciones oficiales.
 */
import type { GuidePayslip, GuidePayslipLine } from "@/features/tarjeton-guia/lib/types"
import { conceptDetails } from "@/features/tarjeton-guia/data/concept-details"
import { normalizeCode } from "@/features/tarjeton-guia/lib/normalize"
import {
  decodeGuardiaDetails,
  decodeFaltaDetails,
  decodeVacacionesDetails,
  decodeRetroactivoDetails,
  decodeSiapFortnight,
  decodeQiFortnight,
  parsePayslipPeriod,
} from "./siap-incidence-decoder"

export type ExplainerStepKind =
  | "sueldo"
  | "estimulo"
  | "guardia"
  | "vacaciones"
  | "falta"
  | "retroactivo"
  | "percepcion"
  | "deduccion"
  | "resumen"
  | "cambio"

export interface IncidenceDateInfo {
  /** Texto legible de cuándo ocurrió la incidencia (cuándo se generó / devengó) */
  incidenceText: string
  /** Texto legible de cuándo se cobró o aplicó en el tarjetón */
  paymentText: string
  /** Detalles adicionales (ej. horas, turno, días, matrícula sustituto, regreso de vacaciones) */
  details?: string
  /** Tipo específico de incidencia */
  type?: "guardia" | "estimulo" | "vacaciones" | "falta" | "retardo" | "retroactivo" | "prestamo" | "ordinario"
  /** Distintivo visual del origen de la información de fecha (ej. "📍 Viene en Observaciones de tu tarjetón") */
  sourceBadge?: string
  /** Estatus temporal de la incidencia respecto al periodo de pago */
  timingStatus?: "past" | "future" | "current" | "warning"
  /** Consejo o recomendación práctica para el trabajador (ej. si no requiere reclamación, si debe acudir a trabajar, etc.) */
  actionAdvice?: string
}

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
  /** Información estructurada de fecha de incidencia y fecha de cobro. */
  dateInfo?: IncidenceDateInfo
}

const EMOJI_BY_CODE: Record<string, string> = {
  "001": "💵",
  "002": "💵",
  "003": "💵",
  "007": "🎓",
  "008": "💵",
  "009": "🩺",
  "011": "🏠",
  "020": "🏠",
  "022": "🏠",
  "029": "🏖️",
  "030": "🌞",
  "032": "🎯",
  "033": "🎯",
  "035": "⏱️",
  "037": "⏱️",
  "048": "🏖️",
  "049": "🎄",
  "050": "🛒",
  "055": "💰",
  "076": "🔄",
  "172": "⚠️",
  "174": "⏱️",
  "176": "🔄",
  "151": "🧾",
  "152": "🏦",
  "107": "🏦",
  "108": "🏦",
  "154": "🏡",
  "170": "🏡",
}

function emojiFor(code: string | null | undefined, fallback: string): string {
  if (!code) return fallback
  return EMOJI_BY_CODE[normalizeCode(code) ?? ""] ?? fallback
}

/** Separa un importe formateado si el tarjetón trae unidades o saldo en observaciones. */
function observationDetail(payslip: GuidePayslip, code: string | null | undefined): string | undefined {
  if (!code) return undefined
  const norm = normalizeCode(code)
  const obs = payslip.observations.filter(
    (o) => normalizeCode(o.conceptCode) === norm || o.conceptCode === code
  )
  if (obs.length === 0) return undefined
  const parts: string[] = []
  for (const o of obs) {
    if (o.duePeriod) parts.push(`Vencimiento: ${o.duePeriod}`)
    if (o.initialCharge != null) parts.push(`Cargo inicial: $${o.initialCharge.toLocaleString("es-MX")}`)
    if (o.units != null) parts.push(`Unidades: ${o.units}${norm === "037" ? " horas extra" : ""}`)
    if (o.controlNumber) parts.push(`Control: ${o.controlNumber}`)
    if (o.notes) parts.push(o.notes)
  }
  return parts.join(" · ")
}

/**
 * Construye los pasos de "Mi quincena explicada" para un tarjetón.
 * No inventa conceptos: cada paso proviene de una línea real del tarjetón o de sus observaciones oficiales.
 */
export function buildExplainer(payslip: GuidePayslip): ExplainerStep[] {
  const steps: ExplainerStep[] = []

  const periodInfo = parsePayslipPeriod(payslip.periodRaw || payslip.periodLabel)
  const currentShortLabel = periodInfo ? periodInfo.shortLabel : (payslip.periodLabel || payslip.periodRaw || "Esta quincena")

  const earnings = [...payslip.earnings].sort((a, b) => b.amount - a.amount)
  const handledConceptCodes = new Set<string>()

  // 1. Sueldo: 002 (Base titular), 008 (Sustitutos / Suplencias Bolsa de Trabajo),
  // 001 (Confianza), 003 (Temporal), 009 (Residente), o en su defecto percepción principal
  const sueldo =
    payslip.earnings.find((l) => normalizeCode(l.code) === "002") ??
    payslip.earnings.find((l) => normalizeCode(l.code) === "008") ??
    payslip.earnings.find((l) => normalizeCode(l.code) === "001") ??
    payslip.earnings.find((l) => normalizeCode(l.code) === "003") ??
    payslip.earnings.find((l) => normalizeCode(l.code) === "009") ??
    earnings[0]

  if (sueldo) {
    if (sueldo.code) handledConceptCodes.add(sueldo.code)
    const normCode = normalizeCode(sueldo.code) || ""
    const sueldoCode = sueldo.code || ""

    let title = "Tu percepción principal"
    let subtitle = sueldo.code ? `${sueldo.code} · ${sueldo.description}` : sueldo.description
    let explanation = `Recibiste $${sueldo.amount.toLocaleString("es-MX")} por ${sueldo.description || "este concepto"}. Es la percepción principal de tu tarjetón.`

    if (normCode === "002") {
      title = "Tu sueldo base"
      explanation = `Recibiste $${sueldo.amount.toLocaleString("es-MX")} como sueldo base tabular por los 15 días laborados del periodo actual (Campo 40). Es la cuota tabular contractual sobre la cual se calculan tu ayuda de renta, aguinaldo y fondo de jubilación.`
    } else if (normCode === "008") {
      title = "Tu sueldo de suplencia (Concepto 008)"
      subtitle = `${sueldo.code || "008"} · Sueldo sustitutos (Bolsa de Trabajo)`
      explanation = `Recibiste $${sueldo.amount.toLocaleString("es-MX")} por concepto de suplencias (008). Como trabajador sustituto de Bolsa de Trabajo (contratación tipo 08), este concepto sustituye al concepto 002 de base y remunera las jornadas o guardias efectivamente laboradas en la quincena, conforme a la cuota diaria del Tabulador de Sueldos de la categoría que cubriste (Cláusulas 22 a 25 del CCT y Procedimiento 1A74-003-030).`
    } else if (normCode === "001") {
      title = "Tu sueldo base de confianza (Concepto 001)"
      subtitle = `${sueldo.code || "001"} · Sueldo personal de confianza`
      explanation = `Recibiste $${sueldo.amount.toLocaleString("es-MX")} como sueldo base por el desempeño en plaza de confianza (Estatuto del Personal de Confianza).`
    } else if (normCode === "003") {
      title = "Tu sueldo temporal (Concepto 003)"
      subtitle = `${sueldo.code || "003"} · Sueldo personal temporal`
      explanation = `Recibiste $${sueldo.amount.toLocaleString("es-MX")} por concepto de sueldo temporal en contratación eventual o por obra determinada.`
    } else if (normCode === "009") {
      title = "Tu sueldo de médico residente (Concepto 009)"
      subtitle = `${sueldo.code || "009"} · Sueldo médicos residentes`
      explanation = `Recibiste $${sueldo.amount.toLocaleString("es-MX")} como remuneración tabular de residencia médica en adiestramiento de especialidad (Reglamento de Médicos Residentes del CCT).`
    }

    steps.push({
      kind: "sueldo",
      emoji: emojiFor(sueldo.code, "💵"),
      title,
      subtitle,
      line: sueldo,
      explanation,
      cta: sueldoCode
        ? {
            label: normCode === "008" ? "Ver detalles de Suplencias (008)" : "Ver cómo se relaciona con otros pagos",
            href: `/guia/conceptos/${normCode || sueldoCode}`,
          }
        : undefined,
    })
  }

  // 2. Estímulos de Asistencia (032) y Puntualidad (033)
  const line032 = payslip.earnings.find((l) => l.code === "032")
  const line033 = payslip.earnings.find((l) => l.code === "033")

  if (line032 || line033) {
    if (line032) handledConceptCodes.add("032")
    if (line033) handledConceptCodes.add("033")

    const obs032 = payslip.observations.find((o) => o.conceptCode === "032")
    const obs033 = payslip.observations.find((o) => o.conceptCode === "033")
    const qiFromNotes = decodeQiFortnight(obs032?.notes || obs033?.notes, periodInfo?.year ?? 2026)
    const evaluatedFortnight = qiFromNotes || periodInfo?.laggingFortnight

    const estimulosIncidenceText = evaluatedFortnight
      ? `Constancia evaluada: ${evaluatedFortnight.label}`
      : "Constancia evaluada con 1 mes de atraso institucional"

    const estimulosPaymentText = periodInfo
      ? `Pagado en este tarjetón: ${currentShortLabel}`
      : "Pagado en este tarjetón"

    const estimulosDateInfo: IncidenceDateInfo = {
      incidenceText: estimulosIncidenceText,
      paymentText: estimulosPaymentText,
      details: qiFromNotes
        ? `Registrado en Observaciones: ${obs032?.notes || obs033?.notes}`
        : "En el IMSS, la asistencia y puntualidad se evalúan con un mes de diferencia por las fechas de corte institucional.",
      type: "estimulo",
      sourceBadge: qiFromNotes
        ? `📍 Detallado en Observaciones: ${obs032?.notes || obs033?.notes}`
        : "⏱️ Evaluado con 1 mes de atraso",
      timingStatus: "past",
      actionAdvice: `Este estímulo corresponde a tu constancia de ${evaluatedFortnight ? evaluatedFortnight.shortLabel : "un mes atrás"}. Al venir pagado en tu tarjetón, confirma que no tuviste faltas ni retardos en ese periodo.`,
    }

    if (line032 && line033) {
      const totalEstimulos = line032.amount + line033.amount
      steps.push({
        kind: "estimulo",
        emoji: "🏆",
        title: "Tus estímulos de asistencia y puntualidad",
        subtitle: "032 y 033 · Reconocimiento a tu constancia",
        line: line032,
        explanation: `¡Asistencia y puntualidad íntegras! Recibiste $${line032.amount.toLocaleString("es-MX")} por Asistencia (032, 3 días de aguinaldo) y $${line033.amount.toLocaleString("es-MX")} por Puntualidad (033, 2 días de aguinaldo), sumando $${totalEstimulos.toLocaleString("es-MX")}. En el IMSS estos estímulos se pagan con un mes de diferencia por las fechas de corte (evalúan tu constancia de ${evaluatedFortnight ? evaluatedFortnight.shortLabel : "un mes atrás"}).`,
        cta: { label: "¿Por qué los recibí?", href: "/guia/conceptos/032" },
        observationText: [observationDetail(payslip, "032"), observationDetail(payslip, "033")].filter(Boolean).join(" · ") || undefined,
        dateInfo: estimulosDateInfo,
      })
    } else if (line032) {
      steps.push({
        kind: "estimulo",
        emoji: "🎯",
        title: "Estímulo por Asistencia (032)",
        subtitle: "032 · Estímulo por asistencia",
        line: line032,
        explanation: `Recibiste $${line032.amount.toLocaleString("es-MX")} por asistencia íntegra en la quincena evaluada (${evaluatedFortnight ? evaluatedFortnight.shortLabel : "un mes atrás"}). No registraste faltas ni licencias sin sueldo.`,
        cta: { label: "Ver requisitos del estímulo", href: "/guia/conceptos/032" },
        observationText: observationDetail(payslip, "032"),
        dateInfo: estimulosDateInfo,
      })
    } else if (line033) {
      steps.push({
        kind: "estimulo",
        emoji: "🎯",
        title: "Estímulo por Puntualidad (033)",
        subtitle: "033 · Estímulo por puntualidad",
        line: line033,
        explanation: `Recibiste $${line033.amount.toLocaleString("es-MX")} por puntualidad íntegra (${evaluatedFortnight ? evaluatedFortnight.shortLabel : "un mes atrás"}) al checar dentro del margen de 5 minutos de tolerancia oficial en el reloj checador.`,
        cta: { label: "Ver requisitos de puntualidad", href: "/guia/conceptos/033" },
        observationText: observationDetail(payslip, "033"),
        dateInfo: estimulosDateInfo,
      })
    }
  }

  // 3. Guardias y Tiempo Extraordinario (035, 037, 076)
  const guardiaLines = payslip.earnings.filter((l) => {
    const c = normalizeCode(l.code)
    return (
      c === "035" ||
      c === "037" ||
      c === "076" ||
      l.description.toLowerCase().includes("guardia") ||
      l.description.toLowerCase().includes("tiempo extra") ||
      l.description.toLowerCase().includes("extraordinari")
    )
  })
  for (const gLine of guardiaLines) {
    if (gLine.code) handledConceptCodes.add(gLine.code)
    const normCode = normalizeCode(gLine.code) ?? ""
    const isHorasExtra =
      normCode === "037" ||
      gLine.description.toLowerCase().includes("tiempo extra") ||
      gLine.description.toLowerCase().includes("extraordinari")

    const gInfo = decodeGuardiaDetails(payslip.observations, gLine, periodInfo)
    const exactDateText = gInfo?.dateRange?.formatted || gInfo?.date?.formatted

    const gIncidenceText = gInfo?.incidenceText || (
      isHorasExtra
        ? gInfo?.dateRange
          ? `Horas extra laboradas: ${gInfo.dateRange.formatted}${gInfo?.units ? ` (${gInfo.units} horas extra)` : ""}`
          : gInfo?.date
          ? `Horas extra laboradas el: ${gInfo.date.formatted}${gInfo?.units ? ` (${gInfo.units} horas extra)` : ""}`
          : gInfo?.fortnight
          ? `Horas extra devengadas en la ${gInfo.fortnight.label}${gInfo?.units ? ` (${gInfo.units} horas extra)` : ""}`
          : gInfo?.units
          ? `Tiempo extraordinario amparado en este comprobante: ${gInfo.units} horas extra`
          : "Tiempo extraordinario amparado en este comprobante"
        : gInfo?.dateRange
        ? `Guardia laborada: ${gInfo.dateRange.formatted}${gInfo?.units ? ` (${gInfo.units} ${gInfo.unitType})` : ""}`
        : gInfo?.date
        ? `Guardia laborada el: ${gInfo.date.formatted}${gInfo?.units ? ` (${gInfo.units} ${gInfo.unitType})` : ""}`
        : gInfo?.fortnight
        ? `Guardia devengada en la ${gInfo.fortnight.label}${gInfo?.units ? ` (${gInfo.units} ${gInfo.unitType})` : ""}`
        : gInfo?.units
        ? `Guardia amparada en este talón (${gInfo.units} ${gInfo.unitType})`
        : "Guardia amparada en este talón"
    )

    const gPaymentText = isHorasExtra
      ? periodInfo
        ? `Pagadas en este tarjetón: ${currentShortLabel}`
        : "Pagadas en este tarjetón"
      : periodInfo
      ? `Pagada en este tarjetón: ${currentShortLabel}`
      : "Pagada en este tarjetón"

    const gDetailsList: string[] = []
    if (isHorasExtra) {
      if (gInfo?.units) gDetailsList.push(`${gInfo.units} horas extra pagadas`)
      if (gInfo?.dateRange && !gInfo.dateRange.isSingleDay) gDetailsList.push(`Fechas laboradas: ${gInfo.dateRange.formatted}`)
      else if (gInfo?.date) gDetailsList.push(`Fecha laborada: ${gInfo.date.formatted}`)
      else if (gInfo?.fortnight) gDetailsList.push(`Devengadas: ${gInfo.fortnight.shortLabel}`)
    } else {
      if (gInfo?.shiftType) gDetailsList.push(`Turno: ${gInfo.shiftType}`)
      if (gInfo?.units) gDetailsList.push(`${gInfo.units} ${gInfo.unitType}`)
      if (gInfo?.partnerMatricula) gDetailsList.push(`Matrícula sustituida: ${gInfo.partnerMatricula}`)
    }

    const hasExactDate = Boolean(gInfo?.dateRange || gInfo?.date)
    const obsLineText = isHorasExtra
      ? exactDateText && gInfo?.units
        ? `Fecha de horas extra: ${exactDateText} · ${gInfo.units} horas extra`
        : exactDateText
        ? `Fecha de horas extra: ${exactDateText}`
        : gInfo?.units
        ? `${gInfo.units} horas extra registradas en Observaciones`
        : observationDetail(payslip, gLine.code)
      : hasExactDate
      ? `Fecha de guardia: ${exactDateText}${gInfo?.units ? ` · ${gInfo.units} ${gInfo.unitType}` : ""}`
      : gInfo?.units
      ? `Guardia registrada: ${gInfo.units} ${gInfo.unitType}`
      : observationDetail(payslip, gLine.code)

    let title = "Guardia / Tiempo Extraordinario"
    let subtitle = `${gLine.code || "035"} · ${gLine.description || "Guardias"}`

    if (isHorasExtra) {
      const hoursStr = gInfo?.units ? `${gInfo.units} ${gInfo.units === 1 ? "hora extra" : "horas extra"}` : undefined
      title = "Horas Extra (Concepto 037 · Tiempo Extraordinario)"
      subtitle = `${gLine.code || "037"} · ${gLine.description || "Tiempo extraordinario"}${hoursStr ? ` · ${hoursStr}` : ""}`
    } else if (normCode === "035") {
      const unitsStr = gInfo?.units ? `${gInfo.units} ${gInfo.unitType}` : undefined
      title = "Guardias (Concepto 035)"
      subtitle = `${gLine.code || "035"} · ${gLine.description || "Guardias"}${unitsStr ? ` · ${unitsStr}` : ""}`
    } else if (normCode === "076") {
      title = "Guardia Convenio T.A.T."
      subtitle = `${gLine.code || "076"} · Sustituciones T.A.T.`
    }

    steps.push({
      kind: "guardia",
      emoji: "⏱️",
      title,
      subtitle,
      line: gLine,
      explanation:
        gInfo?.summary ||
        (isHorasExtra
          ? `Te pagaron $${gLine.amount.toLocaleString("es-MX")} por concepto de tiempo extraordinario amparado bajo las Cláusulas 32 y 33 del CCT.`
          : `Te pagaron $${gLine.amount.toLocaleString("es-MX")} por concepto de guardia amparada bajo el CCT.`),
      observationText: obsLineText || undefined,
      cta: gLine.code ? { label: isHorasExtra ? "Ver cálculo de tiempo extra" : "Ver normativa aplicable", href: isHorasExtra ? "/guia/conceptos/037" : `/guia/conceptos/${gLine.code}` } : undefined,
      dateInfo: {
        incidenceText: gIncidenceText,
        paymentText: gPaymentText,
        details: gDetailsList.length > 0 ? gDetailsList.join(" · ") : isHorasExtra ? "Horas extra amparadas por las Cláusulas 32 y 33 del CCT" : "Tiempo extraordinario / guardia amparada por el CCT",
        type: "guardia",
        sourceBadge: hasExactDate || gInfo?.fortnight || gInfo?.units
          ? "📍 Viene en Observaciones de tu tarjetón"
          : isHorasExtra
          ? "⏱️ Tiempo extra amparado en este talón"
          : "⏱️ Guardia amparada en este talón",
        timingStatus: gInfo?.timing === "past" ? "past" : gInfo?.timing === "future" ? "future" : gInfo?.timing === "current" ? "current" : undefined,
        actionAdvice: gInfo?.actionAdvice,
      },
    })
  }

  // Deducción por Guardia Cedida Convenio T.A.T. (176)
  const tatDed = payslip.deductions.find((l) => l.code === "176")
  if (tatDed) {
    handledConceptCodes.add("176")
    const tatInfo = decodeGuardiaDetails(payslip.observations, tatDed)
    steps.push({
      kind: "guardia",
      emoji: "🔄",
      title: "Permuta de Guardia T.A.T.",
      subtitle: "176 · Sustituciones T.A.T.",
      line: tatDed,
      explanation: tatInfo?.summary || `Se aplicó la retención de $${Math.abs(tatDed.amount).toLocaleString("es-MX")} correspondiente a la guardia cedida bajo Convenio Trabajador a Trabajador.`,
      observationText: observationDetail(payslip, "176"),
      dateInfo: {
        incidenceText: tatInfo?.date ? `Guardia cedida: ${tatInfo.date.formatted}` : (tatInfo?.fortnight ? `Guardia cedida: ${tatInfo.fortnight.label}` : "Guardia cedida en el ciclo reportado"),
        paymentText: periodInfo ? `Retención en este tarjetón: ${currentShortLabel}` : "Retención aplicada en este tarjetón",
        details: "Convenio Trabajador a Trabajador (T.A.T.)",
        type: "guardia",
        sourceBadge: "📍 Viene en Observaciones de tu tarjetón",
      },
    })
  }

  // 4. Vacaciones: Fechas de salida y regreso (029, 048 o en observaciones)
  const vacInfo = decodeVacacionesDetails(payslip)
  if (vacInfo.hasVacaciones) {
    if (payslip.earnings.some((l) => l.code === "029")) handledConceptCodes.add("029")
    if (payslip.earnings.some((l) => l.code === "048")) handledConceptCodes.add("048")
    const vacLine = payslip.earnings.find((l) => l.code === "029") || payslip.earnings.find((l) => l.code === "048")

    let vacTitle = "Tus vacaciones: Salida y regreso"
    if (vacInfo.departureDate && vacInfo.returnDate) {
      vacTitle = `Vacaciones: Salida ${vacInfo.departureDate.day}/${vacInfo.departureDate.month} · Regreso ${vacInfo.returnDate.day}/${vacInfo.returnDate.month}`
    }

    const vacDepartureText = vacInfo.departureDate ? `Salida: ${vacInfo.departureDate.formatted}` : "Salida programada de rol"
    const vacEndText = vacInfo.endDate ? `Último día: ${vacInfo.endDate.formatted}` : "Fin de periodo vacacional"
    const vacReturnText = vacInfo.returnDate
      ? `🏢 Regreso a laborar: ${vacInfo.returnDate.formatted}`
      : "Regreso a laborar: al término de tu rol vacacional"

    steps.push({
      kind: "vacaciones",
      emoji: "🏖️",
      title: vacTitle,
      subtitle: "Prima vacacional y rol de descanso",
      line: vacLine,
      explanation: vacInfo.summary,
      observationText: observationDetail(payslip, "029") || observationDetail(payslip, "048"),
      cta: { label: "Ver Cláusula 47 de vacaciones", href: "/guia/conceptos/029" },
      dateInfo: {
        incidenceText: `${vacDepartureText} → ${vacEndText}`,
        paymentText: periodInfo ? `Prima vacacional pagada en este tarjetón: ${currentShortLabel}` : "Prima vacacional pagada en este tarjetón",
        details: `${vacReturnText} (Cláusula 47 del Contrato Colectivo de Trabajo)`,
        type: "vacaciones",
        sourceBadge: "📍 Viene en Observaciones de tu tarjetón",
        timingStatus: "current",
        actionAdvice: vacInfo.returnDate
          ? `🏢 Regreso a laborar: Debes presentarte a tu turno en tu centro de adscripción el ${vacInfo.returnDate.formatted}.`
          : "🏢 Regreso a laborar: Presentarse en tu adscripción al término del rol vacacional concedido.",
      },
    })
  }

  // 5. Faltas, licencias sin sueldo y ausentismos (172, 171, 129, 173, 174, 161, 164, 175)
  const faltaCodes = new Set(["172", "171", "129", "173", "174", "161", "164", "175"])
  const ausentismoLines = payslip.deductions.filter((l) => {
    const code = normalizeCode(l.code)
    return (
      (code && faltaCodes.has(code)) ||
      l.description.toLowerCase().includes("falta") ||
      l.description.toLowerCase().includes("licencia sin sueldo") ||
      l.description.toLowerCase().includes("retardo")
    )
  })

  // Incluir también ausentismos que aparezcan en observaciones aunque no estén en deductions
  for (const o of payslip.observations) {
    const oCode = normalizeCode(o.conceptCode)
    if (
      oCode &&
      faltaCodes.has(oCode) &&
      !handledConceptCodes.has(oCode) &&
      !ausentismoLines.some((l) => normalizeCode(l.code) === oCode)
    ) {
      let desc = "Incidencia de ausentismo"
      if (oCode === "172") desc = "Falta injustificada"
      else if (oCode === "174") desc = "Retardos acumulados"
      else if (oCode === "171") desc = "Licencia sin sueldo de 1 a 3 días"
      else if (oCode === "129") desc = "Licencia sin sueldo mayor a 3 días"

      ausentismoLines.push({
        code: oCode,
        description: desc,
        amount: -(o.amount || 0),
        kind: "deduction",
      })
    }
  }

  for (const aLine of ausentismoLines) {
    if (aLine.code) handledConceptCodes.add(aLine.code)
    const fInfo = decodeFaltaDetails(payslip.observations, aLine, periodInfo)
    const obs = observationDetail(payslip, aLine.code)
    const amountAbs = Math.abs(aLine.amount)

    const unitsLabel = fInfo?.units
      ? aLine.code === "174"
        ? `${fInfo.units} ${fInfo.units === 1 ? "retardo" : "retardos"}`
        : `${fInfo.units} ${fInfo.units === 1 ? "día" : "días"}`
      : undefined
    const faltaTitle =
      aLine.code === "172"
        ? `Descuento por Falta Injustificada (172)${unitsLabel ? ` · ${unitsLabel}` : ""}`
        : aLine.code === "174"
        ? `Descuento por Retardos (174)${unitsLabel ? ` · ${unitsLabel}` : ""}`
        : `Descuento por ${fInfo?.conceptName || aLine.description || "Inasistencia"}${unitsLabel ? ` · ${unitsLabel}` : ""}`

    steps.push({
      kind: "falta",
      emoji: aLine.code === "174" ? "⏱️" : "⚠️",
      title: faltaTitle,
      subtitle: aLine.code ? `${aLine.code} · ${aLine.description}${unitsLabel ? ` (${unitsLabel})` : ""}` : aLine.description,
      line: aLine,
      explanation: fInfo?.summary || `Se aplicó un descuento de $${amountAbs.toLocaleString("es-MX")} por incidencia de ausentismo o falta. Conforme al Art. 86 del RIT, las inasistencias anulan los estímulos de puntualidad y asistencia.`,
      observationText: obs,
      cta: aLine.code ? { label: "Ver normativa del concepto", href: `/guia/conceptos/${aLine.code}` } : undefined,
      dateInfo: {
        incidenceText: fInfo?.incidenceText || "Incidencia registrada en la quincena de corte",
        paymentText: periodInfo ? `Descuento en este tarjetón: ${currentShortLabel}` : "Descuento en este tarjetón",
        details: fInfo?.impactOnIncentives
          ? "⚠️ Importante (Art. 86 del RIT): Esta inasistencia anula automáticamente los estímulos de puntualidad y asistencia (032 y 033) del ciclo"
          : "Descuento proporcional registrado en nómina",
        type: aLine.code === "174" ? "retardo" : "falta",
        sourceBadge: fInfo?.statusLabel || "📍 Viene en Observaciones de tu tarjetón",
        timingStatus: "warning",
        actionAdvice: fInfo?.actionAdvice,
      },
    })
  }

  // 6. Pagos Retroactivos detectados
  const retroList = decodeRetroactivoDetails(payslip)
  for (const retro of retroList) {
    handledConceptCodes.add(retro.code)
    const retroLine = payslip.earnings.find((l) => l.code === retro.code)
    steps.push({
      kind: "retroactivo",
      emoji: "📈",
      title: `Pago Retroactivo (${retro.code})`,
      subtitle: `${retro.code} · ${retro.description}`,
      line: retroLine,
      explanation: retro.summary,
      observationText: retro.notes || observationDetail(payslip, retro.code),
      dateInfo: {
        incidenceText: retro.targetPeriod ? `Quincena de origen: ${retro.targetPeriod}` : "Adeudo de quincena anterior",
        paymentText: periodInfo ? `Liquidado en este tarjetón: ${currentShortLabel}` : "Liquidado en este tarjetón",
        details: "Pago de diferencia salarial retroactiva devengada",
        type: "retroactivo",
        sourceBadge: "📍 Viene en Observaciones de tu tarjetón",
      },
    })
  }

  // 7. Percepciones restantes relevantes (ordenadas por monto)
  const remainingEarnings = payslip.earnings.filter(
    (l) => !l.code || !handledConceptCodes.has(l.code)
  )

  for (const line of remainingEarnings.slice(0, 5)) {
    const detail = line.code ? conceptDetails[line.code] : undefined
    const obs = observationDetail(payslip, line.code)
    steps.push({
      kind: "percepcion",
      emoji: emojiFor(line.code, "✨"),
      title: `Tu pago de ${line.description || (line.code ? `concepto ${line.code}` : "concepto adicional")}`,
      subtitle: line.code ? `${line.code} · ${line.description}` : line.description,
      line,
      explanation: detail?.simple
        ? `${detail.simple} En esta quincena recibiste $${line.amount.toLocaleString("es-MX")}.`
        : `Concepto detectado en tu tarjetón. En esta quincena recibiste $${line.amount.toLocaleString("es-MX")} por ${line.description || (line.code ? `el concepto ${line.code}` : "este concepto")}.`,
      cta: line.code ? { label: "¿Por qué lo recibí?", href: `/guia/conceptos/${line.code}` } : undefined,
      observationText: obs,
      dateInfo: undefined,
    })
  }

  // 8. Deducciones principales restantes
  const remainingDeductions = payslip.deductions
    .filter((l) => !l.code || !handledConceptCodes.has(l.code))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

  for (const line of remainingDeductions.slice(0, 4)) {
    const obs = observationDetail(payslip, line.code)
    const amountAbs = Math.abs(line.amount)

    const obsItem = payslip.observations.find((o) => o.conceptCode === line.code)
    const dueFortnight = obsItem?.duePeriod ? decodeSiapFortnight(obsItem.duePeriod) : null
    const dueText = dueFortnight ? dueFortnight.label : (obsItem?.duePeriod ? `Vencimiento: ${obsItem.duePeriod}` : undefined)

    const dateInfo: IncidenceDateInfo | undefined = (dueText || obsItem?.units) ? {
      incidenceText: obsItem?.units ? `Plazo programado: ${obsItem.units} quincenas` : "Descuento periódico vigente",
      paymentText: periodInfo ? `Cuota cobrada en este tarjetón: ${currentShortLabel}` : "Cuota en este tarjetón",
      details: dueText ? `📅 Vencimiento programado: ${dueText}` : undefined,
      type: "prestamo",
      sourceBadge: "📍 Viene en Observaciones de tu tarjetón",
    } : undefined

    steps.push({
      kind: "deduccion",
      emoji: emojiFor(line.code, "🔻"),
      title: line.code === "151" ? "Lo que se retuvo de impuestos (ISR)" : `Descuento de ${line.description || (line.code ? `concepto ${line.code}` : "nómina")}`,
      subtitle: line.code ? `${line.code} · ${line.description}` : line.description,
      line,
      explanation:
        line.code === "151"
          ? `Se te retuvieron $${amountAbs.toLocaleString("es-MX")} de Impuesto Sobre la Renta conforme a tus percepciones gravadas de la quincena.`
          : `Se te descontaron $${amountAbs.toLocaleString("es-MX")} por ${line.description || (line.code ? `el concepto ${line.code}` : "este concepto")}.`,
      cta: line.code ? { label: "Ver qué es este descuento", href: `/guia/conceptos/${line.code}` } : undefined,
      observationText: obs,
      dateInfo,
    })
  }

  // 9. Resumen final
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
      : undefined,
  })

  return steps
}

/** Conteo para el encabezado "Mi quincena". */
export function buildQuincenaSummary(payslip: GuidePayslip) {
  const hasZeroConceptsWithTotals =
    payslip.earnings.length === 0 &&
    payslip.deductions.length === 0 &&
    (payslip.totalEarnings != null || payslip.totalDeductions != null || payslip.netPay != null)

  return {
    perceptions: payslip.earnings.length,
    deductions: payslip.deductions.length,
    netPay: payslip.netPay,
    totalEarnings: payslip.totalEarnings,
    totalDeductions: payslip.totalDeductions,
    periodRaw: payslip.periodRaw,
    periodLabel: payslip.periodLabel ?? payslip.periodRaw ?? "Quincena activa",
    earningsCount: payslip.earnings.length,
    deductionsCount: payslip.deductions.length,
    totalConcepts: payslip.earnings.length + payslip.deductions.length,
    incompleteExtraction: hasZeroConceptsWithTotals,
  }
}

/** "Lo que recibiste / Lo que te descontaron / Lo que cambió". */
export function buildPaycheckBrief(payslip: GuidePayslip, previous?: GuidePayslip | null) {
  const topEarnings = [...payslip.earnings].sort((a, b) => b.amount - a.amount).slice(0, 5)
  const topDeductions = [...payslip.deductions].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 5)

  let changes: Array<{ type: "nuevo" | "desaparecio" | "subio" | "bajo"; code: string; label: string; previousAmount?: number; amount?: number }> = []
  if (previous) {
    const getCodeKey = (l: GuidePayslipLine) => (l.code ? normalizeCode(l.code) ?? l.code : l.description)
    const prevCodes = new Set(previous.earnings.concat(previous.deductions).map(getCodeKey))
    const currCodes = new Set(payslip.earnings.concat(payslip.deductions).map(getCodeKey))

    for (const line of payslip.earnings.concat(payslip.deductions)) {
      const code = getCodeKey(line)
      if (!prevCodes.has(code)) {
        changes.push({ type: "nuevo", code, label: line.description || `concepto ${code}`, amount: line.amount })
      } else {
        const prevLine = previous.earnings.concat(previous.deductions).find((l) => getCodeKey(l) === code)
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
      const code = getCodeKey(line)
      if (!currCodes.has(code)) {
        changes.push({ type: "desaparecio", code, label: line.description || `concepto ${code}`, previousAmount: line.amount })
      }
    }
    changes = changes.slice(0, 6)
  }

  return { topEarnings, topDeductions, changes }
}
