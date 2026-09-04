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
        whatItMeans: "Tu periodo anterior fue registrado con Marca 0. Para continuar sin romper la secuencia, tu siguiente periodo debe utilizar la marca que corresponde a esa continuidad.",
        allowedMarksExplanation: "Debes continuar con la Marca 0 para programar tu segundo periodo cuatrimestral con derecho a prima y ayuda cultural.",
        allowedMarks: allowed,
      }
    }
    if (continuity === 2) {
      return {
        continuity: 2,
        regime: "CUATRIMESTRAL",
        whatItMeans: "Has completado dos periodos regulares con Marca 0. Estás listo para concluir tu ciclo anual.",
        allowedMarksExplanation: "Debes utilizar la Marca 0 para tu tercer y último periodo cuatrimestral regular.",
        allowedMarks: allowed,
      }
    }
    if (continuity === 4) {
      return {
        continuity: 4,
        regime: "CUATRIMESTRAL",
        whatItMeans: "Tu periodo anterior fue registrado con Marca 2 (inicio de periodos fraccionados con mayor descanso sin ayuda cultural).",
        allowedMarksExplanation: "Para tu segundo periodo debes continuar la secuencia fraccionada con la Marca 5.",
        allowedMarks: allowed,
      }
    }
    if (continuity === 9) {
      return {
        continuity: 9,
        regime: "CUATRIMESTRAL",
        whatItMeans: "Has programado los dos primeros periodos fraccionados (registrados con Marcas 2 y 5).",
        allowedMarksExplanation: "Para concluir tu tercer periodo cuatrimestral debes cerrar la secuencia con la Marca 5.",
        allowedMarks: allowed,
      }
    }
    // Estados cerrados / inicio de ciclo: 0, 3, 14
    return {
      continuity,
      regime: "CUATRIMESTRAL",
      whatItMeans: "Comienzas tu ciclo cuatrimestral de 3 periodos ordinarios. Puedes elegir disfrutar tu periodo regular con ayuda (Marca 0) o iniciar la modalidad fraccionada con mayor descanso (Marca 2).",
      allowedMarksExplanation: "Puedes elegir la Marca 0 para periodo regular con ayuda, o la Marca 2 para iniciar la modalidad fraccionada.",
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
        title: "Marca 0 — Periodo regular con ayuda",
        plainSummary: "Con esta marca disfrutas tu periodo ordinario. Recibirías prima vacacional 029 y la ayuda 048 que te corresponda conforme a tus datos.",
        economicDetail: "Recibirías tu prima vacacional (concepto 029) y la ayuda cultural y recreativa (concepto 048) calculada conforme a tu Sueldo Mensual Integrado y antigüedad por radiación.",
        nextStepDetail: "En el siguiente periodo deberás anotar: Marca 0",
        secondaryTechnical: "Prima vacacional (concepto 029) + Ayuda cultural y recreativa (concepto 048).",
        helpsSplitOrDeferred: false,
        paysFullHelpNow: true,
        paysNoHelp: false,
      }
    }
    if (mark === 2) {
      return {
        mark: 2,
        title: "Marca 2 — Inicio de periodos fraccionados",
        plainSummary: "Con esta marca comienzas la modalidad fraccionada. Puedes obtener más días de descanso, pero en este periodo no recibirías la ayuda 048.",
        economicDetail: "Solamente cobrarías la prima vacacional (concepto 029) de los días que descanses. En este periodo no recibirías la ayuda cultural 048.",
        nextStepDetail: "Después debes continuar con: Marca 5",
        secondaryTechnical: "Prima vacacional (concepto 029). Sin ayuda cultural 048.",
        helpsSplitOrDeferred: false,
        paysFullHelpNow: false,
        paysNoHelp: true,
      }
    }
    if (mark === 5) {
      return {
        mark: 5,
        title: "Marca 5 — Continuación de periodos fraccionados",
        plainSummary: "Continúas la modalidad fraccionada de tu ciclo cuatrimestral iniciada con Marca 2.",
        economicDetail: "Cobras la prima vacacional (concepto 029) de las jornadas programadas en este cuatrimestre (sin ayuda 048).",
        nextStepDetail: "Después debes continuar con: Marca 5",
        secondaryTechnical: "Prima vacacional (concepto 029). Sin ayuda cultural 048.",
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
        return "Tu periodo anterior fue registrado con Marca 0. Esta marca no corresponde con la continuidad que llevas (debes continuar con Marca 0)."
      }
      if (mark === 5) {
        return "La Marca 5 solo continúa una secuencia fraccionada iniciada anteriormente con Marca 2. Tu periodo anterior fue registrado con Marca 0."
      }
      if (mark === 1) {
        return "La Marca 1 pertenece al régimen semestral. En el régimen cuatrimestral debes continuar con Marca 0."
      }
      return `La Marca ${mark} no corresponde con la continuidad que llevas. Debes continuar con Marca 0.`
    }

    if (currentContinuity === 2) {
      if (mark === 2) {
        return "Ya estás en el último periodo del ciclo iniciado con Marca 0. Esta marca no corresponde con la continuidad que llevas (debes cerrar con Marca 0)."
      }
      if (mark === 5) {
        return "La Marca 5 pertenece a la secuencia fraccionada. Tu periodo anterior fue registrado con Marca 0; debes concluir con Marca 0."
      }
      return `Para cerrar tu ciclo cuatrimestral regular debes usar la Marca 0.`
    }

    if (currentContinuity === 4) {
      if (mark === 0) {
        return "Tu periodo anterior fue registrado con Marca 2. Para no romper la secuencia debes continuar con Marca 5."
      }
      if (mark === 2) {
        return "Ya iniciaste la secuencia fraccionada con Marca 2 en el periodo anterior. Para el segundo periodo debes usar Marca 5."
      }
      return `La Marca ${mark} no corresponde con la continuidad que llevas. Para tu segundo periodo fraccionado debes usar Marca 5.`
    }

    if (currentContinuity === 9) {
      if (mark === 0) {
        return "Estás concluyendo la secuencia fraccionada iniciada con Marca 2. Esta marca no corresponde con la continuidad que llevas (debes cerrar con Marca 5)."
      }
      if (mark === 2) {
        return "La Marca 2 solo se usa para abrir la secuencia en el primer periodo. Para cerrar el ciclo debes usar Marca 5."
      }
      return `Para el tercer periodo de la secuencia fraccionada debes usar Marca 5.`
    }

    // Estados cerrados: 0, 3, 14
    if ([0, 3, 14].includes(currentContinuity)) {
      if (mark === 5) {
        return "La Marca 5 solo continúa una secuencia fraccionada iniciada anteriormente con Marca 2."
      }
      if ([1, 3, 4, 9].includes(mark)) {
        return `La Marca ${mark} pertenece al régimen semestral y no corresponde al régimen cuatrimestral.`
      }
      return `En un ciclo cuatrimestral nuevo debes iniciar con Marca 0 (periodo regular con ayuda) o Marca 2 (inicio de periodos fraccionados).`
    }
  }

  // Régimen Semestral
  if (currentContinuity === 1 && mark !== 1) {
    return "Tienes abierta la primera fracción: tu periodo anterior fue registrado con Marca 1. Para no romper la continuidad debes cerrarla con otra Marca 1."
  }
  if (currentContinuity === 3 && mark !== 3) {
    return "Tu periodo anterior fue registrado con Marca 2. Para completar tu segundo periodo debes utilizar obligatoriamente la Marca 3."
  }
  if (currentContinuity === 4 && mark !== 9) {
    return "Cobraste la ayuda completa con Marca 4 en el primer periodo. Para cerrar el ciclo debes usar la Marca 9 (marca 9)."
  }
  if (currentContinuity === 9 && mark !== 4) {
    return "Dejaste pendiente la ayuda en el periodo anterior (Marca 9). Para cobrarla debes utilizar la Marca 4 (marca 4)."
  }
  if (mark === 3 && currentContinuity !== 3) {
    return "La Marca 3 solo se puede usar si previamente iniciaste con Marca 2."
  }
  if (mark === 5) {
    return "La Marca 5 corresponde al régimen cuatrimestral y no aplica en el régimen semestral."
  }
  if (mark === 0 && (currentContinuity === 1 || currentContinuity === 3 || currentContinuity === 4 || currentContinuity === 9)) {
    return "No puedes tomar todo el año en un solo bloque porque ya tienes un periodo o fracción iniciado."
  }
  return `La Marca ${mark} no es compatible con tu estado actual de continuidad (${currentContinuity}).`
}

/**
 * Devuelve la representación estructurada de las secuencias cuatrimestrales
 * a partir del motor normativo para mostrarlas en la UI.
 */
export function getCuatrimestralOptionSequences(): {
  regular: { label: string; marks: number[]; summary: string }
  fraccionado: { label: string; marks: number[]; summary: string }
  optionA: { label: string; marks: number[]; summary: string }
  optionB: { label: string; marks: number[]; summary: string }
} {
  const regular = {
    label: "Periodo regular con ayuda (Marca 0)",
    marks: CUATRIMESTRAL_OPTION_A.map((s) => s.inclusionMark),
    summary: "Programas los tres periodos con Marca 0, disfrutando tus días y cobrando prima vacacional 029 y ayuda cultural 048 completa.",
  }
  const fraccionado = {
    label: "Periodos fraccionados (Marca 2 → Marca 5 → Marca 5)",
    marks: CUATRIMESTRAL_OPTION_B.map((s) => s.inclusionMark),
    summary: "La Marca 2 inicia la secuencia. Las marcas 5 continúan los siguientes periodos. No puedes cambiar de modalidad a mitad de la secuencia.",
  }
  return {
    regular,
    fraccionado,
    optionA: regular,
    optionB: fraccionado,
  }
}

/**
 * Explica de forma clara e independiente qué marca se deberá o podrá usar
 * en el siguiente periodo conforme a la continuidad resultante.
 */
export function getNextStepFromContinuity(
  regime: VacationRegime,
  nextContinuity: number,
  isFinalPeriod: boolean
): string {
  if (isFinalPeriod) {
    return "Concluye tu ciclo vacacional anual ordinario."
  }
  const allowed = getCompatibleInclusionMarks(regime, nextContinuity)
  if (allowed.length === 0) {
    return "Concluye tu ciclo vacacional anual ordinario."
  }
  if (allowed.length === 1) {
    const nextMark = allowed[0]
    if (nextMark === 5 || nextMark === 3) {
      return `Después debes continuar con: Marca ${nextMark}`
    }
    return `En el siguiente periodo deberás anotar: Marca ${nextMark}`
  }
  return `En el siguiente periodo podrás usar: ${allowed.map((m) => `Marca ${m}`).join(" o ")}`
}

