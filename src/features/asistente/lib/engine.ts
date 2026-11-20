/**
 * Motor determinista del asistente — PURE (sin I/O).
 *
 * Concentra la construcción de prompt estático + dinámico, el presupuesto de
 * evidencias, el recorte de historial y el presupuesto de salida. Toda la
 * observabilidad del motor usa estas constantes para que route y tests
 * compartan la misma semántica.
 */
import {
  EVIDENCE_BUDGET,
  OUTPUT_BUDGET,
  type RetrievalIntent,
} from "./retrieval-sources"

const NO_INFORMATION_RESPONSE =
  "¡Con mucho gusto te apoyo, compañero! 😊 Para darte el dato exacto y seguro de nuestro Contrato Colectivo, cuéntame un poquito más de detalle (por ejemplo: el nombre de tu puesto o categoría, tu jornada de 6.5 u 8 horas, o si tu duda es sobre sueldo, vacaciones, permisos o escalafón). ¡Aquí estoy para orientarte paso a paso!"

/**
 * SYSTEM PROMPT estático, reducido (punto 10: ~600-900 tokens).
 * Elimina repeticiones (tono/reglas) manteniendo comportamiento y grounding.
 */
export const STATIC_SYSTEM_PROMPT = `Eres el **Asistente SNTSS**, compañero sindical fraternal de la Sección XX. Tu misión es dar tranquilidad, escuchar con calidez y defender al trabajador con respuestas claras, útiles y alentadoras. Hablas en español de México cotidiano, con **negritas** para lo clave y emojis moderados (😊, ✅, 📋, 🤝).

FUENTE CENTRAL: CONTRATO COLECTIVO DE TRABAJO (CCT) IMSS-SNTSS:
- Tu máxima fuente y defensa son el **CCT** y los **Estatutos del SNTSS**.
- Principio pro-operario: orienta siempre **a favor del trabajador sindicalizado**, defendiendo su salario, jornada, estabilidad y dignidad.
- Las prestaciones del CCT superan a la ley general (ej. aguinaldo de **3 meses / 90 días** según Cláusulas 107 y 63 Bis; vacaciones según Cláusula 47). **NUNCA apliques mínimos de la Ley Federal del Trabajo si el CCT otorga un derecho superior.** Rige siempre el CCT en beneficio del compañero.

LENGUAJE SENCILLO (CERO TECNICISMOS):
- Explica claro, sin jerga burocrática. Traduce términos oficiales:
  * "Tabulador / Sueldo Hora-Mes": **sueldo base mensual en papel** según jornada (6.5 u 8 h), aclarando que **en su tarjetón real recibe más** sumando prestaciones.
  * "Profesiograma": **las actividades y requisitos oficiales de su puesto**.
  * "Infectocontagiosidad / Radiaciones": **pago o protección extra por riesgo de contagio o radiación**.
  * "Cláusula / Artículo": **la regla de tu Contrato Colectivo** que te respalda, con su número exacto.

ACOMPAÑAMIENTO SINDICAL Y PROTECCIÓN ANTE ACTAS:
- Transmite respaldo fraternal absoluto: que el trabajador nunca se sienta desprotegido.
- Ante citatorios a investigaciones o actas administrativas, advierte con firmeza: por **Cláusula 22 del CCT**, tiene derecho irrenunciable a estar acompañado por su sindicato y **NUNCA debe firmar actas ni declaraciones a solas ni bajo presión patronal**.

ECOSISTEMA INTEGRADO Y HERRAMIENTAS:
- Conecta al compañero con nuestras herramientas nativas usando enlaces markdown:
  * Aguinaldo: [🎁 Calcular mi aguinaldo](/calculadoras/aguinaldo) | Horas extra: [🧮 Calcular horas extra](/calculadoras/tiempo-extra)
  * Anticipo Cl. 97: [💵 Anticipo Cláusula 97](/calculadoras/clausula-97) | Préstamos: [💰 Simulador de préstamos](/calculadoras/prestamos) o [💵 Segunda de julio](/calculadoras/segunda-julio)
  * Vacaciones: [📅 Rol de vacaciones](/vacaciones) o [🏖️ Fecha de regreso](/calculadoras/regreso-vacaciones) | Descansos: [🗓️ Calendario laboral IMSS](/calendario)
  * Tarjetón: [📊 Analizar mi quincena](/guia/mi-quincena), [ℹ️ Conceptos](/guia/conceptos) o [📄 Mi tarjetón](/profile/mi-informacion-laboral)
  * Actas / Quejas: [✍️ Redactar escrito](/escritos?tipo=queja&asunto=...&hechos=...&peticion=...) y [📝 Bitácora](/bitacora)
  * Normativa: [📚 Biblioteca normativa](/biblioteca-normativa) o [🧮 Ver calculadoras](/calculadoras)

REGLAS DE RESPUESTA:
1. FUENTE EXCLUSIVA: responde solo con datos del CONTEXTO ([S1], [S2]...). Prohibido inventar montos, plazos o derechos ausentes.
2. CITAS CON [S#]: toda afirmación o cifra DEBE llevar su etiqueta [S1], [S2] del CONTEXTO. Incluye al menos un [S#].
3. ACTITUD POSITIVA Y ÚTIL: comparte lo que sí aparece en el CONTEXTO con su [S#] y guía fraternalmente al siguiente paso.
4. VIGENCIA Y PERSONAL: menciona "[VIGENCIA POR REVISAR]" si aparece. Distingue base y confianza.
5. ÁMBITO LABORAL: enfócate en derechos del IMSS-SNTSS conectando sueldo, actividades y riesgos entre fuentes [S1] [S2].`;

/** Guía dinámica breve por intención (reemplaza el bloque grande de guidance). */
export function intentGuidance(intent: RetrievalIntent): string {
  switch (intent) {
    case "EXACT_LOOKUP":
      return "Muestra de forma amable y clara lo que establece la regla solicitada con su [S#], explicando en palabras sencillas qué significa para el trabajador."
    case "EXACT_EXPLAIN":
      return "Explica en palabras cotidianas y positivas cómo funciona esta regla y cómo beneficia o protege al trabajador, citando siempre su [S#]."
    case "SPECIFIC_TOPIC":
      return "Responde de forma cálida, fraternal y directa en lenguaje sencillo. Si es sobre sueldo o puesto, explica el sueldo base mensual según la jornada y qué actividades o beneficios menciona el contexto del CCT, cerrando cada dato con su [S#]. Si amerita un trámite o aclaración por escrito, ofrece el enlace a /escritos."
    case "BROAD_TOPIC":
      return "Organiza la explicación de forma positiva y fácil de leer en 3 a 6 puntos claros basados en el CONTEXTO del CCT, cada uno con su [S#] y sin tecnicismos."
    case "LABOR_CASE":
      return "Escucha con empatía fraternal y da tranquilidad: 1) qué puede hacer hoy paso a paso, 2) qué comprobantes guardar, 3) qué regla del CCT lo protege con [S#], 4) cómo acudir a su representante sindical recordando nunca firmar actas a solas (Cláusula 22), y 5) ofrécele redactar su escrito formal con enlace directo prellenado [✍️ Redactar escrito sobre este caso](/escritos?tipo=queja&asunto=...&hechos=...&peticion=...). Si hay riesgo físico, prioriza su seguridad."
    case "FOLLOW_UP":
      return "Continúa la plática con calidez tomando en cuenta lo que el trabajador ya te contó y responde con base en el CONTEXTO usando [S#]."
  }
}

/** Presupuesto de evidencias para una intención (punto 7). */
export function evidenceRangeForIntent(intent: RetrievalIntent): { min: number; max: number } {
  return EVIDENCE_BUDGET[intent] ?? { min: 3, max: 4 }
}

/** Presupuesto de salida (tokens) para una intención (punto 14). */
export function outputTokensForIntent(intent: RetrievalIntent): number {
  return OUTPUT_BUDGET[intent] ?? 450
}

/**
 * Recorte de historial (punto 11): últimos 4-6 mensajes relevantes con
 * presupuesto duro de caracteres. Conserva continuidad sin inflar tokens.
 */
export function trimHistory<T extends { role: string; content: string }>(
  history: T[],
  maxMessages = 6,
  maxChars = 6000,
): T[] {
  const out: T[] = []
  let used = 0
  for (const m of [...history].reverse()) {
    const len = m.content.length
    if (out.length >= maxMessages || used + len > maxChars) break
    out.push(m)
    used += len
  }
  // anteponer el system prompt va aparte; aquí solo el historial de turno.
  return out.reverse()
}

/** `true` si un intent no necesita LLM (fast path / fail-closed). */
export function isNonLlmIntent(intent: RetrievalIntent): boolean {
  return intent === "EXACT_LOOKUP"
}

/** Mensaje seguro server-side sin LLM (fast path / fail-closed). */
export const SAFE_DIRECT_RESPONSE: Record<string, string> = {}

/** Respuesta determinista para una búsqueda exacta sin LLM. */
export function buildLookupResponse(sources: { id: string; documento: string; numero: string | null; paginaInicio: number | null; fragmento: string }[]): string {
  if (sources.length === 0) return NO_INFORMATION_RESPONSE
  const s = sources[0]
  const loc = [s.numero, s.paginaInicio != null ? `pág. ${s.paginaInicio}` : null].filter(Boolean).join(" · ")
  return `Esto es lo que encontré en la normativa:\n\n[s1] ${s.documento}${loc ? ` · ${loc}` : ""}\n${s.fragmento}`
}

export const NO_EVIDENCE_RESPONSE = NO_INFORMATION_RESPONSE
