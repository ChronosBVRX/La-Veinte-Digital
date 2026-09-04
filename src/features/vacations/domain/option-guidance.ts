import type { VacationRegime, VacationStage } from "./types"
import { getCompatibleInclusionMarks, CUATRIMESTRAL_OPTION_A, CUATRIMESTRAL_OPTION_B } from "./continuity"

export type VacationPriority =
  | "MORE_NOW"
  | "SPLIT_PAY"
  | "MORE_REST"
  | "COMPARE_ALL"

export interface MarkGuidance {
  mark: number
  title: string
  plainSummary: string
  economicDetail: string
  nextStepDetail: string
  secondaryTechnical: string
  helpsSplitOrDeferred: boolean
  paysFullHelpNow: boolean
  paysNoHelp: boolean
}

export interface VacationContinuityGuidance {
  continuity: number
  regime: VacationRegime
  whatItMeans: string
  allowedMarksExplanation: string
  allowedMarks: number[]
}

/**
 * Devuelve la orientación de continuidad de acuerdo al régimen exacto del trabajador.
 * Evita mezclar explicaciones semestrales con cuatrimestrales.
 */
export function getVacationContinuityGuidance(
  regime: VacationRegime,
  continuity: number
): VacationContinuityGuidance {
  const allowed = getCompatibleInclusionMarks(regime, continuity)

  if (regime === "CUATRIMESTRAL") {
    if (continuity === 1) {
      return {
        continuity: 1,
        regime: "CUATRIMESTRAL",
        whatItMeans: "Ya comenzaste la opción A de tus vacaciones cuatrimestrales (programaste el primer periodo con marca 0). Para continuar sin romper la secuencia, tu siguiente periodo debe utilizar la marca que corresponde a esa opción.",
        allowedMarksExplanation: "Debes continuar con la marca 0 para programar tu segundo periodo cuatrimestral con derecho a prima y ayuda cultural.",
        allowedMarks: allowed,
      }
    }
    if (continuity === 2) {
      return {
        continuity: 2,
        regime: "CUATRIMESTRAL",
        whatItMeans: "Has completado dos periodos de la opción A cuatrimestral con marca 0. Estás listo para concluir tu ciclo anual.",
        allowedMarksExplanation: "Debes utilizar la marca 0 para tu tercer y último periodo cuatrimestral de la opción A.",
        allowedMarks: allowed,
      }
    }
    if (continuity === 4) {
      return {
        continuity: 4,
        regime: "CUATRIMESTRAL",
        whatItMeans: "Iniciaste la opción B de vacaciones cuatrimestrales con marca 2 (mayor descanso sin ayuda cultural).",
        allowedMarksExplanation: "Para tu segundo periodo debes continuar la secuencia de la opción B con la marca 5.",
        allowedMarks: allowed,
      }
    }
    if (continuity === 9) {
      return {
        continuity: 9,
        regime: "CUATRIMESTRAL",
        whatItMeans: "Has programado los dos primeros periodos de la opción B (marcas 2 y 5).",
        allowedMarksExplanation: "Para concluir tu tercer periodo cuatrimestral debes cerrar la opción B con la marca 5.",
        allowedMarks: allowed,
      }
    }
    // Estados cerrados / inicio de ciclo: 0, 3, 14
    return {
      continuity,
      regime: "CUATRIMESTRAL",
      whatItMeans: "Comienzas tu ciclo cuatrimestral de 3 periodos ordinarios. Debes elegir si realizarás la opción A (con ayuda cultural) o la opción B (mayor descanso, sin ayuda cultural).",
      allowedMarksExplanation: "Puedes elegir la marca 0 para la Opción A o la marca 2 para iniciar la Opción B.",
      allowedMarks: allowed,
    }
  }

  if (regime === "EXTRAORDINARIO_V20") {
    return {
      continuity,
      regime: "EXTRAORDINARIO_V20",
      whatItMeans: "Periodo extraordinario de 10 días por contar con 20 años o más de servicio institucional en el IMSS.",
      allowedMarksExplanation: "Este periodo se programa por separado sin alterar tu ciclo ordinario.",
      allowedMarks: allowed,
    }
  }

  if (regime === "ESTATUTO") {
    if (continuity === 3) {
      return {
        continuity: 3,
        regime: "ESTATUTO",
        whatItMeans: "Tienes iniciado tu periodo bajo Estatuto con marca 2 en el periodo previo.",
        allowedMarksExplanation: "Debes cerrar con la marca 3.",
        allowedMarks: allowed,
      }
    }
    if (continuity === 6) {
      return {
        continuity: 6,
        regime: "ESTATUTO",
        whatItMeans: "Ciclo anterior concluido bajo Estatuto.",
        allowedMarksExplanation: "Puedes iniciar nuevo ciclo con marca 0.",
        allowedMarks: allowed,
      }
    }
    return {
      continuity,
      regime: "ESTATUTO",
      whatItMeans: "Comienzas un nuevo ciclo anual bajo Estatuto.",
      allowedMarksExplanation: "Puedes programar en bloque único (marca 0) o iniciar secuencia de dos periodos (marca 2).",
      allowedMarks: allowed,
    }
  }

  // Régimen SEMESTRAL (predeterminado)
  switch (continuity) {
    case 1:
      return {
        continuity: 1,
        regime: "SEMESTRAL",
        whatItMeans: "Tienes abierta la primera fracción de tus vacaciones (marca 1). Cobraste la mitad de la ayuda cultural y disfrutaste tus primeros días de descanso.",
        allowedMarksExplanation: "Para no romper la continuidad de tu ciclo y cobrar la segunda mitad de la ayuda, debes cerrar con la marca 1.",
        allowedMarks: allowed,
      }
    case 3:
      return {
        continuity: 3,
        regime: "SEMESTRAL",
        whatItMeans: "Iniciaste la opción de dos periodos de descanso con marca 2 en el periodo previo.",
        allowedMarksExplanation: "Para completar tu segundo periodo de descanso debes utilizar obligatoriamente la marca 3.",
        allowedMarks: allowed,
      }
    case 4:
      return {
        continuity: 4,
        regime: "SEMESTRAL",
        whatItMeans: "Cobraste la ayuda cultural completa por adelantado con marca 4 en el primer periodo.",
        allowedMarksExplanation: "Para cerrar el ciclo anual debes anotar la marca 9 (disfrutarás los días con prima, sin ayuda porque ya la cobraste).",
        allowedMarks: allowed,
      }
    case 9:
      return {
        continuity: 9,
        regime: "SEMESTRAL",
        whatItMeans: "Disfrutaste tu primer periodo dejando la ayuda cultural pendiente (marca 9).",
        allowedMarksExplanation: "Para cobrar la ayuda cultural completa y concluir tu ciclo anual debes anotar la marca 4.",
        allowedMarks: allowed,
      }
    default:
      // Estados cerrados (0, 2, 6, 13)
      return {
        continuity,
        regime: "SEMESTRAL",
        whatItMeans: "Comienzas un nuevo ciclo anual ordinario sin fracciones previas pendientes.",
        allowedMarksExplanation: "Puedes programar todo el año en un solo bloque (marca 0), dividir el cobro o descanso (marcas 1, 4 o 9), o conservar un segundo periodo de descanso (marca 2).",
        allowedMarks: allowed,
      }
  }
}

/**
 * Devuelve la orientación en lenguaje claro de trabajador para una marca.
 * Sin códigos técnicos crudos en la descripción principal.
 */
export function getMarkGuidance(
  mark: number,
  regime: VacationRegime = "SEMESTRAL",
  stage?: VacationStage
): MarkGuidance {
  if (regime === "CUATRIMESTRAL") {
    if (mark === 0) {
      return {
        mark: 0,
        title: "Marca 0 — Sí te paga ayuda",
        plainSummary: "Esta marca programa tu periodo cuatrimestral regular e incluye la prima y la ayuda cultural.",
        economicDetail: "Recibirías tu prima vacacional (029) y una ayuda equivalente a los días de tu Sueldo Mensual Integrado correspondientes a tu antigüedad por radiación (048).",
        nextStepDetail: "En el siguiente periodo continuarás con la misma opción (marca 0).",
        secondaryTechnical: "Prima vacacional (concepto 029) + Ayuda cultural y recreativa (concepto 048).",
        helpsSplitOrDeferred: false,
        paysFullHelpNow: true,
        paysNoHelp: false,
      }
    }
    if (mark === 2) {
      return {
        mark: 2,
        title: "Opción B: Inicio con mayor descanso (sin ayuda 048)",
        plainSummary: "Inicias la secuencia de tres periodos con descanso programado sin ayuda cultural.",
        economicDetail: "Solamente cobrarías la prima vacacional (029) de los días que descanses; no incluye ayuda 048.",
        nextStepDetail: "En tu segundo periodo deberás utilizar obligatoriamente la marca 5.",
        secondaryTechnical: "Prima vacacional (concepto 029). Ayuda cultural 048 no aplica en esta modalidad.",
        helpsSplitOrDeferred: false,
        paysFullHelpNow: false,
        paysNoHelp: true,
      }
    }
    if (mark === 5) {
      return {
        mark: 5,
        title: "Opción B: Continuación cuatrimestral",
        plainSummary: "Continúas o concluyes el ciclo cuatrimestral de mayor descanso iniciado con marca 2.",
        economicDetail: "Cobras la prima vacacional (029) de las jornadas programadas en este cuatrimestre.",
        nextStepDetail: "Sigues con la marca 5 hasta completar los 3 cuatrimestres.",
        secondaryTechnical: "Prima vacacional (concepto 029).",
        helpsSplitOrDeferred: false,
        paysFullHelpNow: false,
        paysNoHelp: true,
      }
    }
  }

  // Régimen Semestral / General
  switch (mark) {
    case 1:
      return {
        mark: 1,
        title: "Marca 1: Pago y descanso repartidos",
        plainSummary: "Divides el periodo y también divides la ayuda. Cobras una parte ahora y la otra cuando programes la segunda fracción.",
        economicDetail: "Cobras la prima de esta fracción y la mitad de la ayuda cultural (50%).",
        nextStepDetail: "Para tu segunda fracción deberás anotar nuevamente la marca 1.",
        secondaryTechnical: "Prima vacacional (concepto 029 proporcional) + 50% de Ayuda cultural y recreativa (concepto 048).",
        helpsSplitOrDeferred: true,
        paysFullHelpNow: false,
        paysNoHelp: false,
      }

    case 2:
      return {
        mark: 2,
        title: "Marca 2: Conservar segundo periodo de descanso",
        plainSummary: "Conservas un segundo periodo de descanso. Cobras la prima de los días que disfrutas, pero esta opción no paga la ayuda cultural.",
        economicDetail: "Esta opción paga menos ahora porque no incluye la ayuda cultural 048.",
        nextStepDetail: "Para tu segundo periodo deberás anotar obligatoriamente la marca 3.",
        secondaryTechnical: "Prima vacacional (concepto 029). Sin ayuda cultural 048.",
        helpsSplitOrDeferred: false,
        paysFullHelpNow: false,
        paysNoHelp: true,
      }

    case 3:
      return {
        mark: 3,
        title: "Marca 3: Concluir segundo periodo de descanso",
        plainSummary: "Con esta marca terminas el periodo que tenías pendiente de la secuencia iniciada con marca 2.",
        economicDetail: "Cobras la prima vacacional correspondiente a esta segunda parte.",
        nextStepDetail: "Concluye tu ciclo vacacional anual ordinario.",
        secondaryTechnical: "Prima vacacional (concepto 029). Cierre de ciclo 2→3.",
        helpsSplitOrDeferred: false,
        paysFullHelpNow: false,
        paysNoHelp: true,
      }

    case 4:
      return {
        mark: 4,
        title: "Marca 4: Ayuda completa en este periodo",
        plainSummary: "Esta marca paga toda la ayuda en este periodo. Es la opción que más dinero adicional te da en este momento.",
        economicDetail: "Cobras la prima de estos días más el 100% de la ayuda cultural y recreativa.",
        nextStepDetail: "En el segundo periodo deberás anotar marca 9 (solo prima, pues la ayuda ya se cobró).",
        secondaryTechnical: "Prima vacacional (concepto 029) + 100% Ayuda cultural y recreativa (concepto 048).",
        helpsSplitOrDeferred: false,
        paysFullHelpNow: true,
        paysNoHelp: false,
      }

    case 9:
      return {
        mark: 9,
        title: "Marca 9: Ayuda diferida o periodo de cierre",
        plainSummary: stage === "SECOND_FRACTION_4_9"
          ? "Con la marca 9 cierras el periodo. Cobras la prima de estos días, pues la ayuda ya la cobraste completa en el periodo anterior."
          : "Esta opción paga menos ahora: cobras la prima, pero la ayuda se cobrará completa en el siguiente periodo con marca 4.",
        economicDetail: "Cobras únicamente la prima vacacional de estos días de descanso.",
        nextStepDetail: stage === "SECOND_FRACTION_4_9"
          ? "Concluye tu ciclo anual ordinario."
          : "En el siguiente periodo deberás anotar la marca 4 para cobrar completa la ayuda.",
        secondaryTechnical: "Prima vacacional (concepto 029).",
        helpsSplitOrDeferred: true,
        paysFullHelpNow: false,
        paysNoHelp: false,
      }

    case 0:
    default:
      return {
        mark: 0,
        title: "Marca 0: Periodo único / Año completo",
        plainSummary: "Concentras todo tu descanso y cobras completa la ayuda en una sola exhibición.",
        economicDetail: "Cobras la prima de todos tus días y el 100% de la ayuda cultural.",
        nextStepDetail: "Agotas tu derecho anual ordinario en este único periodo (no conservas segundo periodo).",
        secondaryTechnical: "Prima vacacional (concepto 029 completa) + Ayuda cultural y recreativa (concepto 048 completa).",
        helpsSplitOrDeferred: false,
        paysFullHelpNow: true,
        paysNoHelp: false,
      }
  }
}

/**
 * Ordena las marcas compatibles según la prioridad elegida por el trabajador en el Paso 3.
 */
export function orderMarksByPriority(
  allowedMarks: number[],
  priority: VacationPriority
): number[] {
  const list = [...allowedMarks]

  switch (priority) {
    case "MORE_NOW":
      return list.sort((a, b) => {
        const score = (m: number) => (m === 4 ? 10 : m === 0 ? 8 : m === 1 ? 5 : 1)
        return score(b) - score(a)
      })

    case "SPLIT_PAY":
      return list.sort((a, b) => {
        const score = (m: number) => (m === 1 ? 10 : m === 4 ? 5 : 1)
        return score(b) - score(a)
      })

    case "MORE_REST":
      return list.sort((a, b) => {
        const score = (m: number) => (m === 2 ? 10 : m === 1 ? 8 : m === 4 ? 6 : m === 0 ? 1 : 3)
        return score(b) - score(a)
      })

    case "COMPARE_ALL":
    default:
      return list
  }
}

/**
 * Explica de forma clara y adaptada al régimen por qué una marca específica NO puede ser seleccionada.
 */
export function getIncompatibleReason(
  mark: number,
  currentContinuity: number,
  regime: VacationRegime = "SEMESTRAL"
): string {
  if (regime === "CUATRIMESTRAL") {
    if (currentContinuity === 1) {
      if (mark === 2) {
        return "Ya comenzaste la opción A (con marca 0). No puedes cambiar a la opción B a mitad del ciclo."
      }
      if (mark === 5) {
        return "Esta marca solo continúa una opción B iniciada anteriormente. Tú estás en la opción A."
      }
      if (mark === 1) {
        return "La marca 1 es del régimen semestral. En el régimen cuatrimestral se utiliza la marca 0 para la opción A."
      }
      return `La marca ${mark} no corresponde a la opción A iniciada. Debes continuar con marca 0.`
    }

    if (currentContinuity === 2) {
      if (mark === 2) {
        return "Ya estás en el último periodo de la opción A. No puedes cambiar a la opción B."
      }
      if (mark === 5) {
        return "La marca 5 pertenece a la opción B. Tú estás concluyendo la opción A con marca 0."
      }
      return `Para cerrar la opción A cuatrimestral debes usar la marca 0.`
    }

    if (currentContinuity === 4) {
      if (mark === 0) {
        return "Iniciaste la opción B (con marca 2). Para no romper la secuencia debes continuar con marca 5."
      }
      if (mark === 2) {
        return "Ya iniciaste la opción B en el periodo anterior. Para el segundo periodo debes usar marca 5."
      }
      return `La marca ${mark} no corresponde a la opción B cuatrimestral iniciada.`
    }

    if (currentContinuity === 9) {
      if (mark === 0) {
        return "Estás concluyendo la opción B cuatrimestral. Debes cerrar con la marca 5."
      }
      if (mark === 2) {
        return "La marca 2 solo se usa para abrir la opción B en el primer periodo. Para cerrar debes usar marca 5."
      }
      return `Para el tercer periodo de la opción B cuatrimestral debes usar marca 5.`
    }

    // Estados cerrados: 0, 3, 14
    if ([0, 3, 14].includes(currentContinuity)) {
      if (mark === 5) {
        return "Esta marca solo continúa una opción B iniciada anteriormente con marca 2."
      }
      if ([1, 3, 4, 9].includes(mark)) {
        return `La marca ${mark} pertenece al régimen semestral y no corresponde al régimen cuatrimestral.`
      }
      return `En un ciclo cuatrimestral nuevo debes iniciar con marca 0 (opción A) o marca 2 (opción B).`
    }
  }

  // Régimen Semestral
  if (currentContinuity === 1 && mark !== 1) {
    return "Tienes abierta la primera fracción (marca 1). Para no romper la continuidad debes cerrarla con otra marca 1."
  }
  if (currentContinuity === 3 && mark !== 3) {
    return "Iniciaste la secuencia con marca 2. Para completar tu segundo periodo debes utilizar la marca 3."
  }
  if (currentContinuity === 4 && mark !== 9) {
    return "Cobraste la ayuda completa con marca 4 en el primer periodo. Para cerrar el ciclo debes usar marca 9."
  }
  if (currentContinuity === 9 && mark !== 4) {
    return "Dejaste pendiente la ayuda en el periodo anterior (marca 9). Para cobrarla debes utilizar la marca 4."
  }
  if (mark === 3 && currentContinuity !== 3) {
    return "La marca 3 solo se puede usar si previamente abriste con marca 2."
  }
  if (mark === 5) {
    return "La marca 5 corresponde al régimen cuatrimestral (opción B) y no aplica en el régimen semestral."
  }
  if (mark === 0 && (currentContinuity === 1 || currentContinuity === 3 || currentContinuity === 4 || currentContinuity === 9)) {
    return "No puedes tomar todo el año en un solo bloque porque ya tienes un periodo o fracción iniciado."
  }
  return `La marca ${mark} no es compatible con tu estado actual de continuidad (${currentContinuity}).`
}

/**
 * Devuelve la representación estructurada de las secuencias cuatrimestrales
 * a partir del motor normativo para mostrarlas en la UI.
 */
export function getCuatrimestralOptionSequences(): {
  optionA: { label: string; marks: number[]; summary: string }
  optionB: { label: string; marks: number[]; summary: string }
} {
  return {
    optionA: {
      label: "Opción A — Descanso regular con ayuda",
      marks: CUATRIMESTRAL_OPTION_A.map((s) => s.inclusionMark),
      summary: "Programas los tres periodos con marca 0, disfrutando tus días y cobrando prima vacacional y ayuda cultural completa.",
    },
    optionB: {
      label: "Opción B — Más días de descanso, sin ayuda cultural",
      marks: CUATRIMESTRAL_OPTION_B.map((s) => s.inclusionMark),
      summary: "Empiezas con marca 2 y continúas con marca 5. Mayor descanso programado sin liquidar la ayuda 048.",
    },
  }
}
