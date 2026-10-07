/**
 * Reglas de revisión de "Revisa tu quincena".
 *
 * Solo se incluyen reglas con fundamento suficiente y lenguaje descriptivo:
 * nunca acusatorio. Cada regla puede derivar en un estado normal, informativo
 * o de revisión. No evaluable se reserva a datos ausentes.
 */
import type { GuidePayslip, GuideOccurrence } from "@/features/tarjeton-guia/lib/types"

export type GuideReviewState = "normal" | "info" | "review" | "no-evaluable"

export interface GuideReviewRule {
  id: string
  code: string
  label: string
  /** Qué determina la aparición del concepto en la quincena. */
  when?: (payslip: GuidePayslip) => GuideOccurrence
  /** Estado cuando el concepto SÍ aparece. */
  presentState: GuideReviewState
  /** Estado cuando el concepto NO aparece. */
  absentState: GuideReviewState
  presentMessage: string
  absentMessage: string
  /** Texto aclaratorio que acompaña al estado informativo. */
  caveat?: string
  /** Destino del CTA "¿Por qué podría no aparecer?". */
  helpHref?: string
  helpLabel?: string
  /**
   * Evaluación contextual opcional: si se define y retorna un resultado,
   * tiene precedencia sobre la evaluación binaria de when().
   * Si retorna null, la regla puede ser omitida (no aplicable a esta quincena).
   */
  evaluate?: (payslip: GuidePayslip) => { state: GuideReviewState; message: string; caveat?: string } | null
}

const hasCode = (lines: GuidePayslip["earnings"] | GuidePayslip["deductions"], code: string) =>
  lines.some((l) => l.code === code)

/** Parsea el índice de quincena ordinal para comparaciones cronológicas (año * 24 + quincena). */
export function parseFortnightIndex(period?: string): { year: number; fortnight: number; index: number } | null {
  if (!period) return null
  const clean = period.trim().toUpperCase()

  // Formatos numéricos/ISO: "2026-14", "2026/14", "202614"
  const mNumeric = clean.match(/^(\d{4})[-/]?(\d{1,2})$/)
  if (mNumeric) {
    const year = parseInt(mNumeric[1], 10)
    const fortnight = parseInt(mNumeric[2], 10)
    return { year, fortnight, index: year * 24 + fortnight }
  }

  // Formato inverso: "14/2026"
  const mInverted = clean.match(/^(\d{1,2})\/(\d{4})$/)
  if (mInverted) {
    const fortnight = parseInt(mInverted[1], 10)
    const year = parseInt(mInverted[2], 10)
    return { year, fortnight, index: year * 24 + fortnight }
  }

  // Formatos textuales IMSS: "1ª QNA · ENERO 2026" o "2A QNA DE JULIO DE 2026"
  const MONTHS: Record<string, number> = {
    ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
    JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
  }

  const mText = clean.match(/([12])[ªA]?\s*QNA.*?(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE).*?(\d{4})/)
  if (mText) {
    const half = parseInt(mText[1], 10)
    const monthName = mText[2]
    const year = parseInt(mText[3], 10)
    const month = MONTHS[monthName]
    if (month) {
      const fortnight = (month - 1) * 2 + half
      return { year, fortnight, index: year * 24 + fortnight }
    }
  }

  return null
}

export const guideReviewRules: GuideReviewRule[] = [
  {
    id: "sueldo-base",
    code: "002",
    label: "Sueldo base",
    when: (p) => (hasCode(p.earnings, "002") ? "present" : "absent"),
    presentState: "normal",
    absentState: "review",
    presentMessage: "Sueldo base encontrado",
    absentMessage: "El concepto 002 no aparece en esta quincena",
    caveat: "Esto no significa necesariamente que exista un error. Algunas incidencias o el periodo en que se genera el concepto pueden modificar cuándo aparece reflejado.",
    helpHref: "/guia/conceptos/002",
    helpLabel: "¿Por qué podría no aparecer?",
  },
  {
    id: "ayuda-renta",
    code: "011",
    label: "Ayuda de renta",
    when: (p) => (hasCode(p.earnings, "011") || hasCode(p.earnings, "020") ? "present" : "absent"),
    presentState: "normal",
    absentState: "info",
    presentMessage: "Ayuda de renta encontrada",
    absentMessage: "La ayuda de renta no aparece en esta quincena",
    caveat: "Su pago depende de tu categoría y de las disposiciones vigentes: la ausencia puede deberse a cambios en tu situación laboral.",
    helpHref: "/guia/conceptos/011",
    helpLabel: "Ver ayuda de renta",
  },
  {
    id: "estimulo-asistencia",
    code: "032",
    label: "Estímulo por asistencia",
    when: (p) => (hasCode(p.earnings, "032") ? "present" : "absent"),
    evaluate: (p) => {
      const has032 = hasCode(p.earnings, "032")
      const has172 = hasCode(p.deductions, "172")
      const has173 = hasCode(p.deductions, "173")
      if (has032) {
        if (has172) {
          return {
            state: "review",
            message: "Estímulo de asistencia (032) reflejado con descuento por falta (172)",
            caveat: "El SIAP procesa incidencias con desfase de corte (quincena N vs quincena N-2). Las inasistencias injustificadas conllevan la anulación del estímulo en su periodo correspondiente.",
          }
        }
        if (has173) {
          return {
            state: "info",
            message: "Estímulo de asistencia pagado con descuento de pases particulares (173)",
            caveat: "Conforme al Art. 92 del RIT, los pases particulares solo anulan el estímulo 032 si la suma acumulada en la quincena iguala o excede una jornada completa.",
          }
        }
        return {
          state: "normal",
          message: "Estímulo por asistencia encontrado",
        }
      } else {
        if (has172) {
          return {
            state: "info",
            message: "Te llegó una falta (172): el estímulo de asistencia (032) no aparece en esta quincena",
            caveat: "Se registró una falta injustificada que descuenta la jornada y suspende la acreditación del estímulo de asistencia. Revisa tus checadas con tu Delegado Sindical si asististe o fue falla de biométrico.",
          }
        }
        return {
          state: "info",
          message: "El concepto 032 no aparece en esta quincena (revisa si se registró alguna falta o incidencia en checador)",
          caveat: "Si no recibiste el estímulo de asistencia, es probable que se haya registrado una falta, licencia o pase en tu quincena de incidencia. Revisa tu reporte de asistencia en Tu Perfil IMSS.",
        }
      }
    },
    presentState: "normal",
    absentState: "info",
    presentMessage: "Estímulo por asistencia encontrado",
    absentMessage: "El concepto 032 no aparece en esta quincena (revisa si se registró una falta)",
    caveat: "Los estímulos se evalúan con la quincena de incidencia: una falta o incidencia en checador cancela el estímulo de asistencia.",
    helpHref: "/guia/conceptos/032",
    helpLabel: "¿Por qué podría no aparecer?",
  },
  {
    id: "estimulo-puntualidad",
    code: "033",
    label: "Estímulo por puntualidad",
    when: (p) => (hasCode(p.earnings, "033") ? "present" : "absent"),
    evaluate: (p) => {
      const has033 = hasCode(p.earnings, "033")
      const has172 = hasCode(p.deductions, "172")
      const has174 = hasCode(p.deductions, "174")
      if (has033) {
        if (has172) {
          return {
            state: "review",
            message: "Estímulo de puntualidad (033) presente con descuento por falta (172)",
            caveat: "Conforme al RIT (Arts. 86-93), las faltas o retardos mayores a 30 minutos inhabilitan el estímulo de puntualidad.",
          }
        }
        if (has174) {
          return {
            state: "review",
            message: "Estímulo de puntualidad (033) presente con descuento por retardos (174)",
            caveat: "Los retardos de 6 a 30 minutos (Concepto 174) descuentan tiempo e inhabilitan el estímulo 033 de esa quincena.",
          }
        }
        return {
          state: "normal",
          message: "Estímulo por puntualidad encontrado",
        }
      } else {
        if (has174) {
          return {
            state: "info",
            message: "El concepto 033 no aparece (descuento de retardos 174 registrado en checador)",
            caveat: "La acumulación de retardos fuera de los 5 minutos de tolerancia exime el pago del estímulo 033 en la quincena procesada.",
          }
        }
        return {
          state: "info",
          message: "El concepto 033 no aparece en esta quincena (revisa retardos o checadas fuera de tolerancia)",
          caveat: "Checar después de los 5 minutos de tolerancia o fallas en el registro biométrico interrumpen la decena de puntualidad requerida para el estímulo 033.",
        }
      }
    },
    presentState: "normal",
    absentState: "info",
    presentMessage: "Estímulo por puntualidad encontrado",
    absentMessage: "El concepto 033 no aparece en esta quincena (revisa retardos en checador)",
    caveat: "Los retardos o checadas después del minuto 5 de tolerancia interrumpen la secuencia continua de 10 días requerida para el estímulo 033.",
    helpHref: "/guia/conceptos/033",
    helpLabel: "¿Por qué podría no aparecer?",
  },
  {
    id: "isr",
    code: "151",
    label: "Impuesto sobre la renta (ISR)",
    when: (p) => (hasCode(p.deductions, "151") ? "present" : "absent"),
    presentState: "info",
    absentState: "info",
    presentMessage: "ISR retenido conforme a tus percepciones",
    absentMessage: "No se registró retención de ISR en esta quincena",
    caveat: "La retención depende del monto de tus percepciones gravadas del periodo.",
    helpHref: "/guia/conceptos/151",
    helpLabel: "Ver ISR",
  },
  {
    id: "rjp-coherencia",
    code: "152",
    label: "Coherencia de deducción RJP",
    when: (p) => (hasCode(p.deductions, "152") || hasCode(p.deductions, "108") || hasCode(p.deductions, "111") ? "present" : "absent"),
    evaluate: (p) => {
      const has152 = hasCode(p.deductions, "152")
      const has107 = hasCode(p.deductions, "107")
      const has108 = hasCode(p.deductions, "108")
      const has111 = hasCode(p.deductions, "111")
      if (has152) {
        if (has107) {
          return {
            state: "normal",
            message: "Deducción de RJP completa (3% fondo 152 y 7% cuota 107 acreditados)",
            caveat: "Conforme al Convenio RJP 2005, el personal contratado antes de octubre 2005 aporta 3% al fondo y 7% adicional sobre la base pensionable.",
          }
        }
        return {
          state: "review",
          message: "Se identificó deducción 152 (3%) sin registrarse el concepto 107 (7%) de RJP",
          caveat: "En el régimen RJP anterior a octubre 2005, la aportación de jubilaciones requiere concurrencia del concepto 107 para completar la cuota normada del 10%.",
        }
      }
      if (has108) {
        return {
          state: "normal",
          message: "Aportación RJP régimen de transición (Concepto 108 al 10% global)",
          caveat: "Aplica para trabajadores contratados entre el 16 de octubre de 2005 y julio de 2008 con deducción unificada.",
        }
      }
      if (has111) {
        return {
          state: "normal",
          message: "Aportación complementaria AFORE (Concepto 111 - Cláusula 157 CCT)",
          caveat: "Aplica para cuentas individuales de trabajadores ingresados a partir de agosto 2008.",
        }
      }
      return null
    },
    presentState: "normal",
    absentState: "info",
    presentMessage: "Deducción de jubilaciones y pensiones verificada",
    absentMessage: "Sin deducción de RJP registrada en la quincena",
    helpHref: "/guia/conceptos/152",
    helpLabel: "Ver RJP y jubilaciones",
  },
  {
    id: "prestamo-vencimiento",
    code: "150",
    label: "Vigencia de amortizaciones y préstamos",
    evaluate: (p) => {
      if (!p.observations || p.observations.length === 0) return null
      const LOAN_CODES = ["150", "154", "106", "130", "170", "176"]
      const loanObs = p.observations.filter(
        (o) => LOAN_CODES.includes(o.conceptCode) || (o.duePeriod && hasCode(p.deductions, o.conceptCode))
      )
      if (loanObs.length === 0) return null

      const curIdx = parseFortnightIndex(p.periodRaw || p.periodLabel)

      for (const obs of loanObs) {
        const hasDeduction = hasCode(p.deductions, obs.conceptCode)
        if (!hasDeduction) continue

        if (obs.units !== undefined && obs.units === 0) {
          return {
            state: "review",
            message: `Descuento con contador de amortizaciones en cero (Concepto ${obs.conceptCode})`,
            caveat: "El número de amortizaciones pendientes registra cero en observaciones. Si el descuento persiste, conviene verificar el finiquito del crédito.",
          }
        }

        if (obs.duePeriod && curIdx) {
          const dueIdx = parseFortnightIndex(obs.duePeriod)
          if (dueIdx && curIdx.index > dueIdx.index) {
            return {
              state: "review",
              message: `Descuento con fecha de vencimiento cumplida en observaciones (Concepto ${obs.conceptCode})`,
              caveat: `La quincena de vencimiento pactada (${obs.duePeriod}) es anterior a la quincena actual. Conviene solicitar una constancia de no adeudo ante la oficina de personal.`,
            }
          }
        }
      }

      const first = loanObs[0]
      return {
        state: "normal",
        message: `Amortización de préstamos en curso regular (${first.conceptCode}${first.duePeriod ? ` - vence ${first.duePeriod}` : ""})`,
        caveat: "Se aplican las retenciones quincenales conforme al calendario de amortización reportado.",
      }
    },
    presentState: "normal",
    absentState: "info",
    presentMessage: "Amortizaciones y créditos vigentes",
    absentMessage: "Sin préstamos con saldo pendiente en observaciones",
    helpHref: "/guia/conceptos/150",
    helpLabel: "Ver préstamos y descuentos",
  },
]

/** Regla generada por datos: líneas con confianza baja o sin confirmar. */
export function buildUnconfirmedRule(payslip: GuidePayslip): GuideReviewRule | null {
  const lines = [...payslip.earnings, ...payslip.deductions].filter(
    (l) => (l.confidence ?? 1) < 0.95 || l.confirmedByUser === false
  )
  if (lines.length === 0) return null
  return {
    id: "confianza",
    code: lines[0].code ?? "",
    label: "Conceptos por revisar",
    when: () => "present",
    presentState: "review",
    absentState: "info",
    presentMessage: `${lines.length} concepto(s) se detectaron con menor confianza`,
    absentMessage: "",
    caveat: "Conviene comparar el importe contra tu tarjetón original para confirmar que sea correcto.",
    helpHref: "/guia/conceptos",
    helpLabel: "Buscar un concepto",
  }
}
