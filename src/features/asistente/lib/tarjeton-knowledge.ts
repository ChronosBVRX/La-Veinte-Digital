import type { RetrievedSource } from "./retrieval-sources"
import {
  type SanitizedWorkerProfile,
  formatWorkerTarjetonEvidence,
} from "./worker-context-adapter"
import { GUIDE_CONCEPT_CONTENT_BY_CODE } from "@/data/guia-tarjeton/guide-content"
import { guideConcepts } from "@/data/guia-tarjeton/concepts"
import { vacationContinuityMarks, occupationMarks } from "@/data/guia-tarjeton/tables"

/**
 * Patrón robusto para detectar preguntas orientadas a los datos personales,
 * expediente, nómina, tarjetón o marcas del trabajador.
 */
const WORKER_CONTEXT_QUERY_PATTERN =
  /\b(tarjet[oó]n|08|sustitut[oa]s?|eventual(?:es)?|segunda\s+de\s+julio|fondo\s+de\s+ahorro|aguinaldo|mi\s+(?:[a-záéíóúñ]+\s+)?(?:tarjet[oó]n|recibo|n[oó]mina|quincena|sueldo|salario|pago|puesto|categor[íi]a|jornada|turno|adscripci[oó]n|antig[üu]edad|aguinaldo|fondo|prima|marca)|mis\s+(?:deducciones|percepciones|conceptos|marcas|faltas|retardos|vacaciones|incidencias)|cu[aá]nto\s+(?:me\s+)?(?:[a-záéíóúñ]+\s+)*(?:gano|cobro|cobr[eé]|lleg[oó]|pagan|pagar[aá]n|pagaron|depositan|depositar[aá]n|descontaron|descuentan|tengo|recib[ií]|recibir[eé]|toca|tocar[íi]a|corresponde|alcanza|es)|cu[aá]nt[ao]s?\s+(?:[a-záéíóúñ]+\s+)*(?:faltas?|retardos?|d[íi]as|marcas?|conceptos?|percepciones|deducciones)|por\s*qu[eé]\s+(?:me\s+)?descontaron|descuento\s+(?:de|en)|concepto\s+\d+|cpto\s+\d+|sin\s+retardo|pases?\s+de\s+salida|asiduidad|marca\s+de\s+continuidad)\b/i

const PERSONAL_PAYSLIP_READ_PATTERN =
  /\b(mi\s+(?:[a-záéíóúñ]+\s+)?(?:tarjet[oó]n|recibo|n[oó]mina|quincena|neto|sueldo\s+neto|pago)|mis\s+(?:deducciones|percepciones|conceptos|marcas|faltas|retardos|incidencias)|cu[aá]nto\s+(?:me\s+)?(?:gano|cobro|cobr[eé]|lleg[oó]|pagaron|depositan|depositaron|descontaron|descuentan)|por\s*qu[eé]\s+(?:me\s+)?descontaron)\b/i

const BENEFIT_PERSONALIZABLE_PATTERN =
  /\b(vacaciones|aguinaldo|segunda\s+de\s+julio|fondo\s+de\s+ahorro|prima\s+vacacional|sueldo|salario|quincena|tarjet[oó]n|recibo|n[oó]mina|deducci[oó]n|percepci[oó]n|descuento|marca|retardo|falta|sin\s+retardo|est[ií]mulo|asiduidad|033|034|058|063|radiaci[oó]n|infectocontagiosidad|jornada|categor[ií]a|puesto|antig[üu]edad|08|sustitut[oa]|jubilaci[oó]n|pensi[oó]n)\b/i

export function isWorkerContextQuery(question: string): boolean {
  return WORKER_CONTEXT_QUERY_PATTERN.test(question)
}

export function isPersonalPayslipReadQuery(question: string): boolean {
  const isConceptOrMarkDefinition =
    /\b(qu[eé]\s+(?:es|son|significa|significan)|expl[ií]came\s+el)\s+(?:el\s+|la\s+|los\s+|las\s+)?(?:concepto|cpto|clave|marca|0[0-9]{2}|1[0-9]{2})\b/i.test(
      question,
    )
  if (isConceptOrMarkDefinition && !/\b(cu[aá]nto|descontaron|cobr[eé]|pagaron|lleg[oó])\b/i.test(question)) {
    return false
  }
  return PERSONAL_PAYSLIP_READ_PATTERN.test(question)
}

export function isBenefitPersonalizableQuery(question: string): boolean {
  return WORKER_CONTEXT_QUERY_PATTERN.test(question) || BENEFIT_PERSONALIZABLE_PATTERN.test(question)
}

/**
 * Construye la fuente de evidencia oficial a partir del tarjetón y expediente del trabajador.
 */
export function buildTarjetonSource(profile: SanitizedWorkerProfile): RetrievedSource | null {
  if (!profile.tarjeton && !profile.hasProfile) return null
  const periodo = profile.tarjeton?.periodo ?? "Expediente Activo"
  const fragmento = formatWorkerTarjetonEvidence(profile)
  if (!fragmento.trim()) return null

  return {
    id: "S1",
    chunkId: `tarjeton@${periodo}`,
    documentId: "TARJETON-IMSS",
    documento: `Tarjetón IMSS Oficial (${periodo})`,
    version: "Expediente Verificado",
    tipo: "expediente",
    numero: periodo,
    paginaInicio: null,
    paginaFin: null,
    fragmento,
    sourceUrl: "/profile/mi-informacion-laboral",
    validity: "VIGENTE",
    pendingReview: false,
    score: 999,
    origin: "worker_tarjeton",
  }
}

/**
 * Extrae y construye una fuente de evidencia curada desde la Guía del Tarjetón
 * si la pregunta alude a un concepto, marca de asistencia o marca de vacaciones.
 */
export function findTarjetonGuideSource(
  question: string,
  profile?: SanitizedWorkerProfile | null,
): RetrievedSource | null {
  const q = question.toLowerCase()

  // 1. Detección de Aguinaldo (Cláusula 107 CCT y Concepto 049 en Tarjetón)
  if (/\b(aguinaldo|gratificaci[oó]n anual|concepto\s*0?49|cpto\s*0?49)\b/i.test(question)) {
    const fragmento = [
      "Aguinaldo en el IMSS (Cláusula 107 CCT y Concepto 049 en Tarjetón):",
      "- Importe año completo: 90 días de sueldo tabular (o cuota diaria sobre salario tabular integrado: conceptos 002 + 011 + 054 según aplique). Equivale a 6 quincenas de salario tabular.",
      "- Proporcionalidad para trabajadores sustitutos (08), eventuales o con año incompleto: Tienen derecho a recibir la parte proporcional conforme a los días efectivamente laborados en el ejercicio anual.",
      "- Fórmula proporcional: (Días laborados / 360) × 90 días de salario = Días a pagar.",
      "- Factor mensual: Por cada mes laborado (30 días), corresponden 7.5 días de salario tabular (90 / 12 = 7.5 días/mes).",
      "- Fecha de pago: Se cubre en el mes de diciembre conforme al calendario oficial institucional.",
      "- Si el trabajador cuenta con tarjetón registrado, la cuota diaria se calcula dividiendo su base tabular quincenal (002 + 011) entre 15 días.",
    ].join("\n")

    return {
      id: "S_GUIDE",
      chunkId: "guia:prestacion:aguinaldo",
      documentId: "CCT-CLAUSULA-107",
      documento: "Contrato Colectivo de Trabajo IMSS — Cláusula 107 (Aguinaldo)",
      version: "CCT 2025-2027",
      tipo: "clausula",
      numero: "107",
      paginaInicio: null,
      paginaFin: null,
      fragmento,
      sourceUrl: "/calculadoras/aguinaldo",
      validity: "VIGENTE",
      pendingReview: false,
      score: 860,
      origin: "tarjeton_guide_aguinaldo",
    }
  }

  // 2. Detección de Segunda de Julio / Fondo de Ahorro (Cláusula 144 y Cláusula 63 Bis inc. b CCT y Concepto 055)
  if (/\b(segunda\s+de\s+julio|fondo\s+de\s+ahorro|concepto\s*0?55|cpto\s*0?55)\b/i.test(question)) {
    const fragmento = [
      "Fondo de Ahorro / Segunda de Julio en el IMSS (Cláusula 144, Cláusula 63 Bis inc. b CCT y Concepto 055 en Tarjetón):",
      "- Importe año completo: 46 días de salario tabular (base: Concepto 002 Sueldo Tabular + Concepto 011 Ayuda de Renta por repercusión de la Cláusula 63 Bis inc. b).",
      "- Valor diario: Base quincenal (002 + 011) ÷ 15 días.",
      "- Periodo computable: Comprende del 1 de julio del año anterior al 30 de junio del año en curso (base de 360 unidades anuales).",
      "- Proporcionalidad para trabajadores sustitutos (08), temporales o con año incompleto: Se paga en proporción directa al tiempo laborado conforme al procedimiento 1A74-003-024.",
      "- Fórmula proporcional: (Días laborados / 360) × 46 días de salario = Días a pagar (o Importe completo × [días laborados / 360]).",
      "- Factor mensual: Por cada mes laborado (30 días), corresponden 3.83 días de salario tabular (46 / 12 = 3.8333 días/mes).",
      "- Fecha de pago: Se deposita en la segunda quincena del mes de julio junto con el sueldo regular.",
    ].join("\n")

    return {
      id: "S_GUIDE",
      chunkId: "guia:prestacion:segunda_julio",
      documentId: "CCT-CLAUSULA-144",
      documento: "Contrato Colectivo de Trabajo IMSS — Cláusula 144 y 63 Bis b (Fondo de Ahorro / Segunda de Julio)",
      version: "CCT 2025-2027",
      tipo: "clausula",
      numero: "144",
      paginaInicio: null,
      paginaFin: null,
      fragmento,
      sourceUrl: "/calculadoras/segunda-julio-proporcional",
      validity: "VIGENTE",
      pendingReview: false,
      score: 860,
      origin: "tarjeton_guide_segunda_julio",
    }
  }

  // 3. Detección de conceptos por código numérico (ej. "concepto 022", "cpto 52", "107, 108 y 152")
  // Excluir primero claves de NOM-xxx y homoclaves (1A74-003-025) para evitar falsos positivos (NOM-035 != cpto 035).
  const sanitizedForConcepts = question
    .replace(/\bNOM[-\s]?\d{3}(?:[-\s]?[A-Z0-9]+)*\b/gi, " ")
    .replace(/\b\d[AB]\d{2}-\d{3}-\d{3}\b/gi, " ")
  const conceptMatches = [...sanitizedForConcepts.matchAll(/\b(?:concepto|cpto|clave)\s*([0-9]{1,3})\b|\b(0[0-9]{2}|1[0-9]{2})\b/gi)]
  const requestedCodes: string[] = []
  for (const m of conceptMatches) {
    const raw = m[1] || m[2]
    if (!raw) continue
    const code = raw.padStart(3, "0")
    if (!requestedCodes.includes(code)) requestedCodes.push(code)
    if (requestedCodes.length >= 4) break
  }

  if (requestedCodes.length > 0) {
    const entries: string[] = []
    let firstCode = requestedCodes[0]
    let firstTitle = `Concepto ${firstCode}`
    for (const code of requestedCodes) {
      const guideContent = GUIDE_CONCEPT_CONTENT_BY_CODE.get(code)
      const meta = guideConcepts.find((c) => c.code === code)
      if (!guideContent && !meta) continue
      const nombre = meta?.name || guideContent?.easy?.short || `Concepto ${code}`
      const tipo = meta?.kind === "deduction" ? "Deducción" : "Percepción"
      if (entries.length === 0) {
        firstCode = code
        firstTitle = `Concepto ${code} (${nombre})`
      }
      const lineas: string[] = [`Concepto [${code}]: ${nombre} (${tipo})`]
      if (guideContent?.easy?.short) lineas.push(`Definición: ${guideContent.easy.short}`)
      if (guideContent?.easy?.whyMatters) lineas.push(`Importancia: ${guideContent.easy.whyMatters}`)
      if (guideContent?.easy?.whenAppears) lineas.push(`¿Cuándo aparece?: ${guideContent.easy.whenAppears}`)
      if (guideContent?.detailed?.howItWorks) lineas.push(`Operación: ${guideContent.detailed.howItWorks}`)
      if (guideContent?.detailed?.calculation?.formula) lineas.push(`Cálculo/Fórmula: ${guideContent.detailed.calculation.formula}`)
      entries.push(lineas.join("\n"))
    }

    if (entries.length > 0) {
      return {
        id: "S_GUIDE",
        chunkId: `guia:concepto:${requestedCodes.join(",")}`,
        documentId: "GUIA-TARJETON-CONCEPTOS",
        documento:
          entries.length === 1
            ? `Guía Oficial del Tarjetón IMSS — ${firstTitle}`
            : `Guía Oficial del Tarjetón IMSS — Conceptos ${requestedCodes.join(", ")}`,
        version: "Edición Vigente",
        tipo: "concepto",
        numero: firstCode,
        paginaInicio: null,
        paginaFin: null,
        fragmento: entries.join("\n\n"),
        sourceUrl: `/guia/conceptos?codigo=${firstCode}`,
        validity: "VIGENTE",
        pendingReview: false,
        score: 850,
        origin: "tarjeton_guide_concept",
      }
    }
  }

  // 3b. Si pregunta en general por los conceptos/deducciones/percepciones de SU tarjetón cargado
  if (
    profile?.tarjeton &&
    /(?:qu[eé]\s+(?:son|significan)|expl[ií]came|desgl[oó]sa(?:me)?|por\s*qu[eé]\s+(?:me\s+)?descuentan)\s+(?:los\s+|mis\s+|cada\s+)?(?:conceptos|percepciones|deducciones|descuentos|recibo|tarjet[oó]n)/i.test(
      question,
    )
  ) {
    const profileCodes = [
      ...profile.tarjeton.percepciones.map((p) => p.codigo),
      ...profile.tarjeton.deducciones.map((d) => d.codigo),
    ].slice(0, 10)
    const lines: string[] = []
    for (const code of [...new Set(profileCodes)]) {
      const guideContent = GUIDE_CONCEPT_CONTENT_BY_CODE.get(code)
      const meta = guideConcepts.find((c) => c.code === code)
      if (!guideContent && !meta) continue
      const nombre = meta?.name || `Concepto ${code}`
      const tipo = meta?.kind === "deduction" ? "Deducción" : "Percepción"
      const desc = guideContent?.easy?.short || meta?.catalog?.detail?.[0]?.text?.slice(0, 180) || ""
      lines.push(`- [${code}] ${nombre} (${tipo})${desc ? `: ${desc}` : ""}`)
    }
    if (lines.length > 0) {
      return {
        id: "S_GUIDE",
        chunkId: `guia:tarjeton_conceptos:${profile.tarjeton.periodo ?? "activo"}`,
        documentId: "GUIA-TARJETON-CONCEPTOS",
        documento: "Guía Oficial del Tarjetón IMSS — Conceptos de tu recibo",
        version: "Edición Vigente",
        tipo: "concepto",
        numero: null,
        paginaInicio: null,
        paginaFin: null,
        fragmento: `Significado oficial de los conceptos que aparecen en tu tarjetón:\n${lines.join("\n")}`,
        sourceUrl: "/guia/mi-quincena",
        validity: "VIGENTE",
        pendingReview: false,
        score: 845,
        origin: "tarjeton_guide_concept_summary",
      }
    }
  }

  // 4. Detección de marcas de continuidad vacacional (0, 1, 2, 3, 4, 5, 9)
  const vacMarkMatch = question.match(/\b(?:marca\s*(?:de continuidad\s*)?([0123459])|continuidad vacacional)\b/i)
  if (vacMarkMatch || (q.includes("marca") && q.includes("vacaci"))) {
    const markNum = vacMarkMatch?.[1]
    const foundMark = markNum ? vacationContinuityMarks.find((m) => m.mark === markNum) : null

    const fragmento = foundMark
      ? `Marca de Continuidad ${foundMark.mark} en Tarjetón (Cláusula 47 CCT):\n- Disfrute: ${foundMark.enjoyment}\n- Cierre de ciclo: ${foundMark.cycleClose}`
      : `Marcas de Continuidad Vacacional en Tarjetón IMSS (Cláusula 47 CCT):\n` +
        vacationContinuityMarks
          .map((m) => `- Marca ${m.mark}: ${m.enjoyment}`)
          .join("\n")

    return {
      id: "S_GUIDE",
      chunkId: `guia:marca_vacaciones:${markNum ?? "todas"}`,
      documentId: "GUIA-MARCAS-VACACIONES",
      documento: "Guía de Marcas del Tarjetón IMSS — Continuidad Vacacional",
      version: "Cláusula 47 CCT",
      tipo: "marca",
      numero: markNum ?? null,
      paginaInicio: null,
      paginaFin: null,
      fragmento,
      sourceUrl: "/vacaciones",
      validity: "VIGENTE",
      pendingReview: false,
      score: 840,
      origin: "tarjeton_guide_vacation_mark",
    }
  }

  // 5. Detección de registro de asistencia / marcas de puntualidad ("sin retardo", estímulo 033)
  if (/(sin retardo|asiduidad|marcas? de puntualidad|marcas? de asistencia|retardo|asistencia puntual)/i.test(q)) {
    const fragmento = [
      "Registro de Asistencia y Puntualidad en el Tarjetón IMSS (Cláusula 38 CCT y Art. 93 Reglamento Interior de Trabajo):",
      "- Sin retardo: Marca numérica que identifica las veces que el trabajador registró su asistencia dentro de los 5 minutos de tolerancia diarios. En este margen no se genera sanción.",
      "- Estímulo de Puntualidad (Concepto 033): Por cada 10 marcas de asistencia puntual ('Sin retardo') acumuladas, se genera el pago de 2 días de aguinaldo pagaderos en la quincena correspondiente.",
      "- Retardos: Registro de asistencia posterior a los 5 minutos de tolerancia (del minuto 6 al 15 o posterior, según turno). Generan descuento o sanción disciplinaria.",
      "- Pases de salida: Autorizaciones oficiales de ausencia transitoria que no afectan el cómputo de asistencia si son oficiales.",
      "- Asiduidad: Registro de constancia de asistencia que respalda reconocimientos sindicales e institucionales.",
    ].join("\n")

    return {
      id: "S_GUIDE",
      chunkId: "guia:asistencia_marcas",
      documentId: "GUIA-ASISTENCIA-PUNTUALIDAD",
      documento: "Guía Oficial del Tarjetón IMSS — Registro de Asistencia y Puntualidad",
      version: "Cláusula 38 CCT y Art. 93 RIT",
      tipo: "asistencia",
      numero: "033",
      paginaInicio: null,
      paginaFin: null,
      fragmento,
      sourceUrl: "/guia/conceptos?codigo=033",
      validity: "VIGENTE",
      pendingReview: false,
      score: 840,
      origin: "tarjeton_guide_attendance",
    }
  }

  // 6. Detección de marcas de ocupación de plaza (00, 01, 02, etc.)
  const occMatch = question.match(/\b(?:marca\s*(?:de ocupaci[oó]n\s*)?([0-9]{2})|ocupaci[oó]n plaza)\b/i)
  if (occMatch) {
    const occCode = occMatch[1]
    const foundOcc = occCode ? occupationMarks.find((o) => o.code === occCode) : null

    const fragmento = foundOcc
      ? `Marca ${foundOcc.code} de Ocupación de Plaza:\n- Condición: ${foundOcc.description}\n- Utilización: ${foundOcc.use}`
      : `Marcas de Ocupación de Plaza en Tarjetón IMSS:\n` +
        occupationMarks
          .map((o) => `- Marca ${o.code} (${o.description}): ${o.use}`)
          .join("\n")

    return {
      id: "S_GUIDE",
      chunkId: `guia:marca_ocupacion:${occCode ?? "todas"}`,
      documentId: "GUIA-MARCAS-OCUPACION",
      documento: "Guía de Marcas del Tarjetón IMSS — Ocupación de Plaza",
      version: "Movimientos de Plantilla",
      tipo: "marca",
      numero: occCode ?? null,
      paginaInicio: null,
      paginaFin: null,
      fragmento,
      sourceUrl: "/profile/mi-informacion-laboral",
      validity: "VIGENTE",
      pendingReview: false,
      score: 830,
      origin: "tarjeton_guide_occupation_mark",
    }
  }

  return null
}
