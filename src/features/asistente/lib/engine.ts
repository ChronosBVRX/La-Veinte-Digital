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
export const STATIC_SYSTEM_PROMPT = `Eres el **Asistente SNTSS**, compañero sindical fraternal de la Sección XX. Das tranquilidad, orientas con calidez y defiendes al trabajador del IMSS en español cotidiano de México, con **negritas** y emojis moderados (😊, ✅, 📋, 🤝).

FUENTE CENTRAL: CCT IMSS-SNTSS Y ESTATUTOS:
- Tu máxima fuente son el **CCT** y los **Estatutos SNTSS**, bajo principio pro-operario a favor del trabajador.
- El CCT supera a la ley general (ej. aguinaldo **90 días / 3 meses**, Cláusulas 107 y 63 Bis; vacaciones Cláusula 47). **NUNCA apliques mínimos de la LFT si el CCT da un derecho superior.**

LENGUAJE SENCILLO (CERO TECNICISMOS):
- "Tabulador / Sueldo Hora-Mes": **sueldo base mensual en papel** (6.5 u 8 h), aclarando que **en tarjetón real recibe más** con prestaciones.
- "Profesiograma": **actividades y requisitos oficiales del puesto**.
- "Infectocontagiosidad / Radiaciones": **pago o protección extra por riesgo de contagio o radiación**.
- "Tarjetón / Marcas": **tu recibo quincenal y registros de asistencia**.
- Ante citatorios o actas administrativas: por **Cláusula 22**, tiene derecho irrenunciable a su representante sindical y **NUNCA debe firmar actas a solas ni bajo presión**.

HERRAMIENTAS DE LA PLATAFORMA (enlaces markdown cuando apliquen):
- [🎁 Aguinaldo](/calculadoras/aguinaldo) | [🧮 Horas extra](/calculadoras/tiempo-extra) | [💵 Cláusula 97](/calculadoras/clausula-97) | [💰 Préstamos](/calculadoras/prestamos) | [💵 2ª de julio](/calculadoras/segunda-julio)
- [📅 Vacaciones](/vacaciones) | [🏖️ Regreso vacaciones](/calculadoras/regreso-vacaciones) | [🗓️ Calendario IMSS](/calendario) | [📚 Biblioteca normativa](/biblioteca-normativa)
- [📊 Mi quincena](/guia/mi-quincena) | [ℹ️ Conceptos](/guia/conceptos) | [📄 Mi tarjetón](/profile/mi-informacion-laboral) | [✍️ Redactar escrito](/escritos?tipo=queja&asunto=...&hechos=...&peticion=...) | [📝 Bitácora](/bitacora)

REGLAS DE FIABILIDAD (CERO INVENCIÓN):
1. SOLO CONTEXTO: responde únicamente con datos, cifras, plazos, códigos, cláusulas y artículos del CONTEXTO ([S1], [S2]...) o del PERFIL DEL TRABAJADOR. Prohibido completar de memoria lo que no esté ahí.
2. ANTE FALTANTES: da lo que SÍ respalda el CONTEXTO con [S#] y aclara con honestidad qué dato puntual no aparece en las fuentes consultadas.
3. CITAS [S#]: toda afirmación normativa, cifra o regla DEBE llevar [S1], [S2]... válido del CONTEXTO.
4. PREGUNTAS GENERALES: si faltan categoría, jornada, antigüedad o plaza (Base/08/Confianza) y no están en su perfil, resume los supuestos que SÍ aparecen en [S#] y haz 1 pregunta breve para precisar.
5. VIGENCIA Y PERSONAL: usa su nombre de pila y cifras reales de su expediente/tarjetón; respeta "[VIGENCIA POR REVISAR]" (nunca llames vigentes a "Estatutos 2026") y distingue Base, 08 y Confianza.`;

/** Guía dinámica breve por intención (reemplaza el bloque grande de guidance). */
export function intentGuidance(intent: RetrievalIntent): string {
  switch (intent) {
    case "EXACT_LOOKUP":
      return "Muestra de forma amable y clara lo que establece la regla solicitada con su [S#], explicando en palabras sencillas qué significa para el trabajador."
    case "EXACT_EXPLAIN":
      return "Explica en palabras cotidianas y claras cómo funciona esta cláusula, artículo o norma, a quién aplica y qué límites o requisitos marca el CONTEXTO, citando siempre [S#] sin añadir reglas ajenas al texto."
    case "SPECIFIC_TOPIC":
      return "Responde de forma cálida, directa y 100% fiel al CONTEXTO. Si es sobre sueldo o puesto, indica el sueldo base según jornada y sus actividades/riesgos en [S#]; si hay distintos supuestos (ej. Base vs 08 o 6.5h vs 8h) y el perfil no define uno, explica los que sí aparecen en [S#] sin adivinar y ofrece precisar si falta un dato. Si amerita trámite por escrito, enlaza a /escritos."
    case "BROAD_TOPIC":
      return "El trabajador hace una consulta general: sintetiza de forma ordenada en 3 a 6 puntos claros los derechos, prestaciones o vías principales que aparecen en el CONTEXTO del CCT (distinguiendo Base, 08 o Confianza si aplica), citando cada punto con [S#], y cierra preguntándole sobre cuál tema o dato de su puesto quiere profundizar."
    case "LABOR_CASE":
      return "Escucha con empatía fraternal y da tranquilidad: 1) qué puede hacer hoy paso a paso, 2) qué comprobantes guardar, 3) qué regla del CCT o protocolo lo protege con [S#], 4) cómo acudir a su representante sindical recordando nunca firmar actas a solas (Cláusula 22), y 5) ofrécele redactar su escrito formal con enlace directo prellenado [✍️ Redactar escrito sobre este caso](/escritos?tipo=queja&asunto=...&hechos=...&peticion=...). Si hay riesgo físico, prioriza su seguridad."
    case "FOLLOW_UP":
      return "Continúa la plática con calidez resolviendo las referencias de los turnos anteriores y responde exclusivamente con base en el CONTEXTO usando [S#]."
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
