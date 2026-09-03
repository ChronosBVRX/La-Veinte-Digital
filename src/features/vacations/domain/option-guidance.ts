import type { VacationRegime, VacationStage } from "./types"

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
        title: "Opción A: Periodo regular con ayuda completa",
        plainSummary: "Esta marca programa tu periodo cuatrimestral correspondiente e incluye la ayuda cultural.",
        economicDetail: "Recibes tu prima vacacional y la ayuda cultural completa.",
        nextStepDetail: "En el siguiente periodo continuarás con la misma secuencia de marca 0.",
        secondaryTechnical: "Prima vacacional (concepto 029) + Ayuda cultural y recreativa (concepto 048).",
        helpsSplitOrDeferred: false,
        paysFullHelpNow: true,
        paysNoHelp: false,
      }
    }
    if (mark === 2) {
      return {
        mark: 2,
        title: "Opción B: Inicio de secuencia cuatrimestral",
        plainSummary: "Inicias la secuencia cuatrimestral de tres periodos con descanso programado.",
        economicDetail: "Solamente cobras la prima vacacional de los días que disfrutas; no incluye ayuda 048.",
        nextStepDetail: "Tu siguiente periodo deberá llevar obligatoriamente la marca 5.",
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
        plainSummary: "Con esta marca continúas o concluyes el ciclo cuatrimestral iniciado con marca 2.",
        economicDetail: "Cobras la prima de las jornadas programadas en este cuatrimestre.",
        nextStepDetail: "Sigue la secuencia de marca 5 hasta completar los 3 cuatrimestres.",
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
          ? "Concluye tu ciclo anual."
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
      // Prefiere marca 4 (ayuda completa) o marca 0 primero, luego 1 (mitad), luego 2 o 9 (sin ayuda)
      return list.sort((a, b) => {
        const score = (m: number) => (m === 4 ? 10 : m === 0 ? 8 : m === 1 ? 5 : 1)
        return score(b) - score(a)
      })

    case "SPLIT_PAY":
      // Prefiere marca 1 (mitad y mitad)
      return list.sort((a, b) => {
        const score = (m: number) => (m === 1 ? 10 : m === 4 ? 5 : 1)
        return score(b) - score(a)
      })

    case "MORE_REST":
      // Prefiere marca 2 o secuencias fraccionadas (1, 2, 4) sobre 0
      return list.sort((a, b) => {
        const score = (m: number) => (m === 2 ? 10 : m === 1 ? 8 : m === 4 ? 6 : m === 0 ? 1 : 3)
        return score(b) - score(a)
      })

    case "COMPARE_ALL":
    default:
      // Orden natural
      return list
  }
}

/**
 * Explica por qué una marca específica NO puede ser seleccionada dado el estado actual.
 */
export function getIncompatibleReason(
  mark: number,
  currentContinuity: number,
  _regime: VacationRegime
): string {
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
  if (mark === 0 && (currentContinuity === 1 || currentContinuity === 3 || currentContinuity === 4 || currentContinuity === 9)) {
    return "No puedes tomar todo el año en un solo bloque porque ya tienes un periodo o fracción iniciado."
  }
  return `La marca ${mark} no es compatible con tu estado actual de continuidad (${currentContinuity}).`
}
