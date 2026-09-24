import type {
  VacationPlanInput,
  VacationPlanResult,
  VacationAlternativeEvaluation,
  VacationAlternativeStatus,
  VacationRole,
} from "./types"
import { applyInclusionMark } from "./continuity"
import { buildVacationPlan } from "./annual-plan"
import { getIncompatibleReason, getNextStepFromContinuity } from "./option-guidance"

interface ModalityDefinition {
  id: string
  title: string
  summary: string
  canonicalMarks: number[]
  consequenceNextPeriod?: string
}

/**
 * Evalúa todas las modalidades normativas contra la continuidad actual y el perfil del trabajador.
 * Produce una lista estructurada con estado normativo riguroso:
 * - "AVAILABLE": Totalmente compatible con la continuidad y reglas.
 * - "REQUIRES_REVIEW": Compatible para simulación, pero sujeta a confirmación oficial.
 * - "INCOMPATIBLE": NO disponible para la situación actual del trabajador. NUNCA seleccionable.
 */
export function evaluateVacationAlternatives(
  planInput: VacationPlanInput
): VacationAlternativeEvaluation[] {
  const { regime, initialContinuity, calendar } = planInput

  const definitions = getModalityDefinitions(regime, initialContinuity)
  const evaluations: VacationAlternativeEvaluation[] = []

  for (const def of definitions) {
    const candidateMarks = def.canonicalMarks

    // 1. Prueba paso por paso de continuidad matemática
    let current = initialContinuity
    let continuityValid = true
    let stepFailReason: string | undefined
    let nextRequiredMark: number | undefined

    for (let i = 0; i < candidateMarks.length; i++) {
      const mark = candidateMarks[i]
      const trans = applyInclusionMark(regime, current, mark)
      if ("error" in trans) {
        continuityValid = false
        stepFailReason = getIncompatibleReason(mark, current, regime)
        break
      }
      current = trans.nextContinuity
    }

    if (!continuityValid) {
      // Incompatible por continuidad
      evaluations.push({
        id: def.id,
        status: "INCOMPATIBLE",
        selectable: false,
        title: def.title,
        summary: def.summary,
        marks: candidateMarks,
        reason: stepFailReason || getIncompatibleReason(candidateMarks[0], initialContinuity, regime),
        nextRequiredMark,
        isInformationalExample: true,
        badgeLabel: "🔒 Incompatible con tu situación actual",
      })
      continue
    }

    // 2. Construcción de plan con los roles disponibles del calendario
    const candidateSelections: Record<number, { mark: number; role?: VacationRole }> = {}
    for (let i = 0; i < candidateMarks.length; i++) {
      const periodIdx = i + 1
      candidateSelections[periodIdx] = {
        mark: candidateMarks[i],
        role: calendar?.roles && calendar.roles.length > i ? calendar.roles[i] : calendar?.roles[0],
      }
    }

    const plan: VacationPlanResult = buildVacationPlan(planInput, candidateSelections)

    // 3. Verificación de periodos permitidos por el motor normativo para esta alternativa
    const evaluatedPeriods = plan.periods.slice(0, candidateMarks.length)
    const hasDisallowedPeriod = evaluatedPeriods.some((p) => !p.allowed)
    if (hasDisallowedPeriod) {
      const failedPeriod = evaluatedPeriods.find((p) => !p.allowed)
      evaluations.push({
        id: def.id,
        status: "INCOMPATIBLE",
        selectable: false,
        title: def.title,
        summary: def.summary,
        marks: candidateMarks,
        reason: failedPeriod?.reasons[0] || "Incompatible con el calendario o reglas normativas.",
        plan,
        isInformationalExample: true,
        badgeLabel: "🔒 Incompatible con tu situación actual",
      })
      continue
    }

    // 4. Determinar si requiere revisión por calendario o fechas provisionales en los periodos evaluados
    const hasReview = evaluatedPeriods.some(
      (p) =>
        p.eligibility?.status === "REQUIRES_REVIEW" ||
        p.dueDateConfidence !== "CONFIRMED" ||
        calendar?.status === "DRAFT"
    )

    const status: VacationAlternativeStatus = hasReview ? "REQUIRES_REVIEW" : "AVAILABLE"
    const badgeLabel = hasReview ? "🟡 Pendiente de confirmación" : "🟢 Compatible con tus datos"

    // Calcular días totales de descanso y consecuencias de la alternativa
    const restDaysTotal = evaluatedPeriods.reduce((acc, p) => acc + (p.units || 0), 0)
    const lastPeriod = evaluatedPeriods[evaluatedPeriods.length - 1]
    const consequenceNextPeriod = def.consequenceNextPeriod || (
      lastPeriod?.continuityAfter !== undefined
        ? getNextStepFromContinuity(regime, lastPeriod.continuityAfter, true)
        : "Concluye tu ciclo vacacional anual ordinario."
    )

    const p1Gross = evaluatedPeriods[0]?.payment?.grossVacationExtra ?? null
    const p2Gross = evaluatedPeriods[1]?.payment?.grossVacationExtra ?? null
    const p3Gross = evaluatedPeriods[2]?.payment?.grossVacationExtra ?? null
    const totalGross = evaluatedPeriods.reduce((acc, p) => acc + (p.payment?.grossVacationExtra || 0), 0)
    const totalPremium029 = evaluatedPeriods.reduce((acc, p) => acc + (p.payment?.premium029 || 0), 0)
    const totalCulturalHelp048 = evaluatedPeriods.reduce((acc, p) => acc + (p.payment?.culturalHelp048 || 0), 0)

    evaluations.push({
      id: def.id,
      status,
      selectable: true,
      title: def.title,
      summary: def.summary,
      marks: candidateMarks,
      plan,
      p1Gross,
      p2Gross,
      p3Gross,
      totalGross,
      totalPremium029,
      totalCulturalHelp048,
      restDaysTotal,
      consequenceNextPeriod,
      badgeLabel,
      isInformationalExample: false,
    })
  }

  return evaluations
}

/**
 * Genera el catálogo normativo de modalidades a evaluar según el régimen
 * y el punto exacto en el ciclo de continuidad del trabajador.
 * Si el ciclo ya está abierto, representa ÚNICAMENTE los pasos que faltan
 * para concluir esa secuencia sin iniciar automáticamente ciclos futuros.
 */
function getModalityDefinitions(
  regime: string,
  initialContinuity: number
): ModalityDefinition[] {
  if (regime === "SEMESTRAL") {
    // Si el trabajador ya inició una secuencia, representamos únicamente
    // lo que falta para terminar ese ciclo abierto.
    if (initialContinuity === 1) {
      return [
        {
          id: "SPLIT_PAY",
          title: "Repartir el pago (concluir ciclo con Marca 1)",
          summary: "Tu periodo anterior fue registrado con Marca 1. Al anotar Marca 1 en este periodo concluyes tu ciclo fraccionado y cobras la segunda mitad de la ayuda cultural 048.",
          canonicalMarks: [1],
          consequenceNextPeriod: "Concluyes tu ciclo fraccionado con Marca 1 y tu continuidad queda cerrada en 2.",
        },
        {
          id: "MORE_NOW",
          title: "Recibir la ayuda completa ahora (Marca 4 → Marca 9)",
          summary: "Concentra el 100% de la ayuda cultural 048 en un ciclo nuevo.",
          canonicalMarks: [4, 9],
          consequenceNextPeriod: "Solo disponible al iniciar un nuevo ciclo.",
        },
        {
          id: "MORE_REST",
          title: "Conservar otro periodo de descanso (Marca 2 → Marca 3)",
          summary: "Conservas un segundo periodo completo de descanso sin ayuda cultural.",
          canonicalMarks: [2, 3],
          consequenceNextPeriod: "Solo disponible al iniciar un nuevo ciclo.",
        },
      ]
    }

    if (initialContinuity === 3) {
      return [
        {
          id: "MORE_REST",
          title: "Concluir segundo periodo de descanso (Marca 3)",
          summary: "Tu periodo anterior fue registrado con Marca 2. Para completar tu segundo periodo de descanso debes utilizar obligatoriamente la Marca 3.",
          canonicalMarks: [3],
          consequenceNextPeriod: "Concluye tu ciclo de descanso completo 2→3 y tu continuidad queda cerrada en 6.",
        },
        {
          id: "MORE_NOW",
          title: "Recibir la ayuda completa ahora (Marca 4 → Marca 9)",
          summary: "Concentra el 100% de la ayuda cultural en un ciclo nuevo.",
          canonicalMarks: [4, 9],
        },
        {
          id: "SPLIT_PAY",
          title: "Repartir el pago entre dos periodos (Marca 1 → Marca 1)",
          summary: "Cobras la mitad de la ayuda cultural en cada periodo.",
          canonicalMarks: [1, 1],
        },
      ]
    }

    if (initialContinuity === 4) {
      return [
        {
          id: "MORE_NOW_CLOSE",
          title: "Concluir ciclo con ayuda ya cobrada (Marca 9)",
          summary: "Ya elegiste esta modalidad anteriormente: cobraste la ayuda cultural completa con Marca 4. Ahora corresponde cerrar con Marca 9 para disfrutar los días restantes con prima vacacional.",
          canonicalMarks: [9],
          consequenceNextPeriod: "Concluye tu ciclo anual ordinario 4→9 y tu continuidad queda cerrada en 13.",
        },
        {
          id: "MORE_NOW",
          title: "Iniciar nueva secuencia Marca 4 → Marca 9",
          summary: "Concentra el 100% de la ayuda cultural en un ciclo nuevo.",
          canonicalMarks: [4, 9],
        },
        {
          id: "SPLIT_PAY",
          title: "Repartir el pago entre dos periodos (Marca 1 → Marca 1)",
          summary: "Cobras la mitad de la ayuda cultural en cada periodo.",
          canonicalMarks: [1, 1],
        },
        {
          id: "MORE_REST",
          title: "Conservar otro periodo de descanso (Marca 2 → Marca 3)",
          summary: "Conservas dos descansos sin ayuda cultural.",
          canonicalMarks: [2, 3],
        },
      ]
    }

    if (initialContinuity === 9) {
      return [
        {
          id: "DEFERRED_HELP_CLOSE",
          title: "Cobrar ayuda cultural pendiente (Marca 4)",
          summary: "En el periodo anterior dejaste la ayuda cultural pendiente (Marca 9). Ahora corresponde cobrarla completa con Marca 4 y concluir tu ciclo anual.",
          canonicalMarks: [4],
          consequenceNextPeriod: "Concluye tu ciclo anual cobrando el 100% de la ayuda cultural y tu continuidad queda cerrada en 13.",
        },
        {
          id: "SPLIT_PAY",
          title: "Repartir el pago entre dos periodos (Marca 1 → Marca 1)",
          summary: "Cobras la mitad de la ayuda cultural en cada periodo.",
          canonicalMarks: [1, 1],
        },
        {
          id: "MORE_REST",
          title: "Conservar otro periodo de descanso (Marca 2 → Marca 3)",
          summary: "Conservas dos descansos sin ayuda cultural.",
          canonicalMarks: [2, 3],
        },
      ]
    }

    // Ciclo nuevo o cerrado (0, 2, 6, 13)
    return [
      {
        id: "MORE_NOW",
        title: "Recibir la ayuda completa ahora",
        summary: "Concentra el 100% de la ayuda cultural 048 en el primer periodo (Marca 4) y cierra el ciclo con Marca 9.",
        canonicalMarks: [4, 9],
        consequenceNextPeriod: "En tu segundo periodo deberás anotar Marca 9 (solo prima, pues la ayuda ya se cobró).",
      },
      {
        id: "SPLIT_PAY",
        title: "Repartir el pago entre dos periodos",
        summary: "Cobras la mitad de la ayuda cultural (50%) en cada periodo fraccionado con Marca 1.",
        canonicalMarks: [1, 1],
        consequenceNextPeriod: "En tu segundo periodo deberás anotar nuevamente Marca 1 para cobrar la otra mitad.",
      },
      {
        id: "MORE_REST",
        title: "Conservar otro periodo de descanso",
        summary: "Conservas un segundo periodo completo de descanso (Marca 2 → 3), cobrando la prima vacacional 029 pero sin ayuda cultural 048.",
        canonicalMarks: [2, 3],
        consequenceNextPeriod: "En tu segundo periodo deberás anotar obligatoriamente Marca 3.",
      },
    ]
  }

  if (regime === "CUATRIMESTRAL") {
    // Si ya inició secuencia regular (Marca 0)
    if (initialContinuity === 1 || initialContinuity === 2) {
      return [
        {
          id: "REGULAR_A",
          title: "Continuar periodo regular con ayuda (Marca 0)",
          summary: "Continúas tu ciclo cuatrimestral con Marca 0, disfrutando tus días y cobrando prima vacacional 029 y ayuda cultural 048.",
          canonicalMarks: initialContinuity === 1 ? [0, 0] : [0],
          consequenceNextPeriod: initialContinuity === 1
            ? "Para el tercer periodo deberás concluir con Marca 0."
            : "Concluye tu ciclo cuatrimestral regular.",
        },
        {
          id: "FRACCIONADO_B",
          title: "Periodos fraccionados con mayor descanso (Marca 2 → 5 → 5)",
          summary: "Secuencia fraccionada con mayor descanso sin ayuda cultural.",
          canonicalMarks: [2, 5, 5],
        },
      ]
    }

    // Si ya inició secuencia fraccionada (Marca 2)
    if (initialContinuity === 4 || initialContinuity === 9) {
      return [
        {
          id: "FRACCIONADO_B",
          title: "Continuar periodos fraccionados (Marca 5)",
          summary: "Continúas la secuencia fraccionada iniciada con Marca 2. Cobras prima vacacional de cada cuatrimestre.",
          canonicalMarks: initialContinuity === 4 ? [5, 5] : [5],
          consequenceNextPeriod: initialContinuity === 4
            ? "Para el tercer periodo deberás concluir con Marca 5."
            : "Concluye tu ciclo cuatrimestral fraccionado.",
        },
        {
          id: "REGULAR_A",
          title: "Periodo regular con ayuda (Marca 0 → 0 → 0)",
          summary: "Modalidad regular de tres periodos con ayuda cultural completa.",
          canonicalMarks: [0, 0, 0],
        },
      ]
    }

    // Ciclo nuevo o cerrado (0, 3, 14)
    return [
      {
        id: "REGULAR_A",
        title: "Periodo regular con ayuda (Marca 0)",
        summary: "Programas los tres periodos con Marca 0. En cada periodo disfrutas tus días y recibes prima vacacional 029 y ayuda cultural 048 completa.",
        canonicalMarks: [0, 0, 0],
        consequenceNextPeriod: "Deberás continuar cada periodo cuatrimestral con Marca 0.",
      },
      {
        id: "FRACCIONADO_B",
        title: "Periodos fraccionados con mayor descanso (Marca 2 → 5 → 5)",
        summary: "La Marca 2 inicia la secuencia y las marcas 5 continúan los siguientes periodos. Mayor descanso sin ayuda cultural 048.",
        canonicalMarks: [2, 5, 5],
        consequenceNextPeriod: "Después del primer periodo con Marca 2, deberás continuar con Marca 5.",
      },
    ]
  }

  // ESTATUTO
  return [
    {
      id: "ESTATUTO_BLOCK",
      title: "Bloque único anual (Marca 0)",
      summary: "Programas todo el año en un solo bloque con Marca 0.",
      canonicalMarks: [0],
    },
    {
      id: "ESTATUTO_SPLIT",
      title: "Dos periodos de descanso (Marca 2 → Marca 3)",
      summary: "Divides el año en dos periodos de descanso bajo el régimen Estatuto.",
      canonicalMarks: [2, 3],
    },
  ]
}
