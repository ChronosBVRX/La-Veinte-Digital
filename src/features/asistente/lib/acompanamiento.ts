import type { RetrievalIntent } from "./retrieval-sources"

/**
 * Capa de acompañamiento sindical — PURE (sin I/O, testeable).
 *
 * Solo decide CÓMO comunicar una respuesta (estructura, tono, chips y
 * cuándo sugerir representación sindical). NO construye asesoría jurídica:
 * todo derecho/procedimiento sigue saliendo del retrieval + evidencias.
 *
 * Jamás recomienda representación mecánicamente: una consulta informativa
 * ("¿cuántos días de vacaciones?", "¿qué dice la cláusula 63 Bis?") no debe
 * recibir acompañamiento.
 */

export type AcompañamientoKind =
  | "seguridad" // agresión física / amenaza creíble / riesgo inmediato
  | "conflicto" // hostigamiento, sanciones, actas, negativas, fuera de categoría…
  | "informativo" // consulta simple: sin acompañamiento

export interface Acompañamiento {
  kind: AcompañamientoKind
  /** Sugerir a la representación sindical (evaluado, no mecánico). */
  recomendarRepresentante: boolean
  /** Chips de acción únicamente follow-up prompts (máx 4). */
  chips: string[]
  /** Fragmento de guía para el system prompt según el caso. */
  guidance: string
}

// ── Señales ─────────────────────────────────────────────────────────────

const SEGURIDAD_RE =
  /(agresi[oó]n f[ií]sica|violencia f[ií]sica|amenaza (de|con|de muerte|f[ií]sica)|est[aá]s en riesgo|riesgo (inmediato|imminente)|agresi[oó]n en curso|pon[eé]r en riesgo tu (seguridad|integridad)|te va a (pegar|agredir|da[ñn]ar)|agredid[oa] (f[ií]sica|f[íi]sica|fisic|físic)|agredi(ó|o|endo) (f[ií]sica|f[íi]sica|fisic|físic)|(f[ií]sica|f[íi]sica|fisic|físic)amente|golpe|v[ií]a f[ií]sica)/i

const CONFLICTO_RE =
  /(hostig|acoso|agresi[óo]n|amenaz|represali|sanci[oó]n|acta\b|procedimiento disciplinario|disciplinari|fuera de (mi )?categor|actividades que no (correspond|son de mi)|cambio injustificado|cambiar.*de (categor|funcion|adscripc)|jornada|horas (extra|extraordinarias).*(no|sin) (reconocid|pagad|pag)|no me (reconocen|pagan)|negaron|negan|neg[oó]|no (quieren|quiere) (respetar|darme|autorizarme)|conflicto con (mi )?jef|jefatura|no (me )?respet(a|an)|riesgo de trabajo|seguridad e higiene|discriminaci[oó]n|acoso|explotaci[oó]n|maltrat|despido injustificado|degradaci[oó]n|presi[oó]n|hostilidad|intimidaci[oó]n)/i

/** Sustantivo de negativa/conflicto en vacaciones/permisos que sí amerita ruta. */
const NEGATIVA_RE = /(negaron|negan|neg[oó]|no (quieren|quiere) (respetar|darme|autorizar|permitir)|no me (dieron|dieron|respetaron)|me amenaza|presionan|fuerzan|obligan)/i

// ── Chips por situación (follow-up prompts, nunca respuestas) ──────────

const CHIPS_HOSTIGAMIENTO = [
  "Ayúdame a hacer una cronología",
  "Preparar un escrito",
  "¿Qué pruebas debo guardar?",
  "¿Cuándo acudir al sindicato?",
]
const CHIPS_VACACIONES = ["Calcular mis vacaciones", "¿Qué hago si me las niegan?"]
const CHIPS_SANCIONES = ["Revisar mi caso", "¿Debo firmar el acta?", "Preparar mis antecedentes"]
const CHIPS_FUERA_CATEGORIA = ["¿Qué pruebas debo guardar?", "¿A quién reporto?", "Preparar un escrito"]
const CHIPS_EXTRAS = ["¿Qué hago ahora?", "¿Qué próximo paso conviene?"]

// ── Núcleo ─────────────────────────────────────────────────────────────

export function isInformativa(
  question: string,
  intent: RetrievalIntent,
  hasSpecific: boolean,
): boolean {
  // Referencia exacta o consulta de derecho concreto sin señales de conflicto.
  if (intent === "EXACT_LOOKUP" || intent === "EXACT_EXPLAIN") return !NEGATIVA_RE.test(question) && !CONFLICTO_RE.test(question)
  if (hasSpecific && !CONFLICTO_RE.test(question) && !NEGATIVA_RE.test(question)) return true
  // Consulta corta de monto/dato: aguinaldo, días, cláusula.
  if (/\b(cu[aá]nto|cu[aá]ntos|qu[eé] d[ií]ce|cu[aá]l es|qu[eé] es|cu[aá]ndo me corresponde)\b/i.test(question)) {
    return !CONFLICTO_RE.test(question) && !NEGATIVA_RE.test(question)
  }
  return false
}

export function classifyAcompañamiento(
  question: string,
  intent: RetrievalIntent,
): Acompañamiento {
  const isSeguridad = SEGURIDAD_RE.test(question)
  const isConflicto = CONFLICTO_RE.test(question) || NEGATIVA_RE.test(question)

  if (isSeguridad) {
    return {
      kind: "seguridad",
      recomendarRepresentante: true,
      chips: CHIPS_HOSTIGAMIENTO,
      guidance:
        "SEGURIDAD PRIMERO: si existe agresión física, amenaza creíble o riesgo inmediato, prioriza la seguridad. " +
        "Indica: 'Si existe una agresión en curso o consideras que tu integridad está en riesgo, prioriza salir de la situación y busca apoyo inmediato.' " +
        "Luego continúa con documentación, ruta institucional y —si corresponde— acompañamiento sindical. No conviertas quejas laborales en emergencias.",
    }
  }

  if (isConflicto) {
    const esHostigamiento = /(hostig|acoso|agresi|amenaz|represali|maltrat|hostilidad|intimidaci|presi[oó]n)/i.test(question)
    const esSancion = /(sanci[oó]n|acta|disciplinar|despido|reconsiderar)/i.test(question)
    const esVacaciones = /vacaciones|permiso|descanso/i.test(question)
    const esFueraCategoria = /(fuera de (mi )?categor|actividades que no|no corresponden a (mi )?categor|profesiograma|categor)/i.test(question)
    const chips = esHostigamiento
      ? CHIPS_HOSTIGAMIENTO
      : esSancion
        ? CHIPS_SANCIONES
        : esVacaciones
          ? CHIPS_VACACIONES
          : esFueraCategoria
            ? CHIPS_FUERA_CATEGORIA
            : CHIPS_EXTRAS

    return {
      kind: "conflicto",
      recomendarRepresentante: true,
      chips: chips.slice(0, 4),
      guidance:
        "CASO DE CONFLICTO LABORAL: Añade acompañamiento sindical cuando resulte pertinente, explicando PARA QUÉ sirve " +
        "(que el representante conozca el antecedente y te acompañe a presentar un escrito, acudir a una reunión o " +
        "identificar el procedimiento). Nunca afirme que el representante ganará el caso, detendrá una sanción o " +
        "puede ordenar algo al IMSS. Estructura con la guía A–F.",
    }
  }

  // Informativo: sin recomendación de representante.
  return {
    kind: "informativo",
    recomendarRepresentante: false,
    chips: [],
    guidance:
      "CONSULTA INFORMATIVA: responde de forma clara y concisa con base en el contexto. " +
      "No incluyas acompañamiento sindical ni pasos de gestión; solo si el trabajador lo pide explícitamente.",
  }
}

/**
 * Guía de ESTRUCTURA para problemas laborales concretos (A–F).
 * Se inyecta al prompt cuando el caso lo amerita.
 */
export const ESTRUCTURA_GUIA = `ESTRUCTURA COMO GUÍA INTERNA DE TRABAJO — úsala para organizar lo que dirás, PERO NO la escribas ni la etiquetes con letras. No digas "A. ORIENTACIÓN", "B. QUÉ HACER", etc. Narra en lenguaje natural y cercano, como un compañero que conversa.

Ordena la respuesta así (incluye las secciones que apliquen, sin encabezados):
1. primero una frase cálida de orientación inicial (que haya una forma ordenada de actuar). Evita clichés como "lamento mucho lo que vives" salvo que la gravedad lo amerite.
2. luego pasos concretos de qué hacer ahora.
3. qué evidencia conservar si aplica: mensajes, correos, documentos, comunicaciones. NO afirmes que toda grabación es legal; si se menciona, di: "conserva lo que ya tengas; si consideras grabar, evita poner en riesgo tu seguridad y no afirmes su validez jurídica salvo respaldo normativo del corpus".
4. qué dice la normativa en lenguaje normal, cada afirmación con [S#].
5. acompañamiento sindical cuando resulte pertinente: explica PARA QUÉ sirve, sin prometer resultados.
6. cierra ofreciendo una acción concreta que el asistente pueda ayudar a hacer (ej. "si quieres, puedo ayudarte a armar una cronología de los hechos").

Regla de CITAS: toda afirmación normativa, cifra, plazo o artículo debe llevar [S#]. Los consejos prácticos de sentido común (guardar mensajes, anotar fechas, no confrontar) no requieren cita, pero tampoco deben inventar requisitos legales.`

/**
 * Señales usadas por el evaluador de acompañamiento (expuestas para tests).
 */
export const detectionSignals = {
  seguridad: SEGURIDAD_RE,
  conflicto: CONFLICTO_RE,
  negativa: NEGATIVA_RE,
}

/**
 * CONTINUIDAD CONVERSACIONAL (punto 11): detecta si el mensaje parece
 * continuar un caso iniciado antes (referencias deícticas al caso previo,
 * sin re-explicar el tema). Solo cambia el tono/guía, nunca el grounding.
 */
export function isContinuation(question: string, hasPriorLaborEvents: boolean): boolean {
  const deictic =
    /^(¿?y |¿?pero |ya |entonces |y si |eso |eso ya |ya tengo |ya hab[ií]a |ahora |seguir|continuar|y adem[aá]s|y tambi[eé]n|me dijeron |me contestaron |me respondieron|al final |como te dec[aí]a|te cuento|m[eé]tete)/i.test(
      question.trim(),
    ) ||
    /\b(esos mensajes|lo que te dije|el caso|ese caso|como te dije|empezamos|antes |el d[ií]a que te dije|mi jefe|el jefe)\b/i.test(question)
  return deictic && hasPriorLaborEvents
}

export const GUIDANCE_CONTINUATION =
  "CONTINUIDAD CONVERSACIONAL: parece que el trabajador sigue contando un caso ya mencionado. NO respondas desde cero: " +
  "reconoce los elementos que ya aportó (mensajes, fechas, personas) y continúa la orientación en la misma línea. " +
  "Mantén el grounding documental: toda afirmación sigue exigiéndose citada con [S#]."

