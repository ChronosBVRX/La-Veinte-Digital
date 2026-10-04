import type { SanitizedWorkerProfile } from "./worker-context-adapter"

export interface CanonicalMapping {
  keywords: RegExp
  canonicalTitle: string
  associatedClauses: string[]
  searchExpansionTerms: string[]
}

export const CANONICAL_MAPPINGS: CanonicalMapping[] = [
  {
    keywords: /\b(radi[oó]log[oa]|rayos\s*x|gabinete de rayos|emanaci[oó]n|radiaci[oó]n)\b/i,
    canonicalTitle: "TÉCNICO RADIÓLOGO",
    associatedClauses: [
      "Cláusula 86 Bis",
      "Cláusula 63 Bis",
      "Reglamento de Infectocontagiosidad y Emanaciones Radiactivas",
    ],
    searchExpansionTerms: [
      "TECNICO RADIOLOGO",
      "clausula 86 bis",
      "clausula 63 bis",
      "emanaciones radiactivas",
      "sobresueldo",
      "riesgo",
      "tabulador de sueldos",
    ],
  },
  {
    keywords: /\b(enfermer[oa]|auxiliar de enfermer[íi]a|jefe de piso)\b/i,
    canonicalTitle: "ENFERMERA GENERAL / AUXILIAR DE ENFERMERÍA",
    associatedClauses: ["Cláusula 63", "Cláusula 86 Bis"],
    searchExpansionTerms: [
      "ENFERMERA GENERAL",
      "AUXILIAR DE ENFERMERIA",
      "ENFERMERA ESPECIALISTA",
      "tabulador",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(m[eé]dic[oa]|doctor[a]?|especialista)\b/i,
    canonicalTitle: "MÉDICO FAMILIAR / MÉDICO NO FAMILIAR",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos"],
    searchExpansionTerms: [
      "MEDICO FAMILIAR",
      "MEDICO NO FAMILIAR",
      "MEDICO GENERAL",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(camiller[oa])\b/i,
    canonicalTitle: "CAMILLERO EN UNIDADES HOSPITALARIAS",
    associatedClauses: ["Cláusula 63", "Reglamento de Infectocontagiosidad"],
    searchExpansionTerms: [
      "CAMILLERO EN UNIDADES HOSPITALARIAS",
      "infectocontagiosidad",
      "tabulador",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(ch[oó]fer|conductor)\b/i,
    canonicalTitle: "CHOFER",
    associatedClauses: ["Reglamento de Conductores de Vehículos", "Cláusula 63"],
    searchExpansionTerms: [
      "CONDUCTOR",
      "CHOFER",
      "viaticos",
      "reglamento de conductores",
    ],
  },
  {
    keywords: /\b(limpieza|intendencia|higiene y limpieza)\b/i,
    canonicalTitle: "AUXILIAR UNIVERSAL DE OFICINAS / INTENDENCIA",
    associatedClauses: ["Cláusula 63", "Reglamento de Infectocontagiosidad"],
    searchExpansionTerms: [
      "OPERADOR DE SERVICIOS GENERALES",
      "LIMPIEZA E HIGIENE",
      "infectocontagiosidad",
      "tabulador",
    ],
  },
  {
    keywords: /\b(manejador(a)?\s*(de)?\s*alimentos|cociner[oa]|nutrici[oó]n|diet[eé]tica|nutri[oó]log[oa]|dietista)\b/i,
    canonicalTitle: "MANEJADOR DE ALIMENTOS",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos", "Profesiogramas"],
    searchExpansionTerms: [
      "MANEJADOR DE ALIMENTOS",
      "SERVICIOS DE NUTRICION Y DIETETICA",
      "COCINERO TECNICO",
      "NUTRICIONISTA DIETISTA",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(asistente\s*m[eé]dic[oa]|trabajador(a)?\s*social)\b/i,
    canonicalTitle: "ASISTENTE MÉDICA / TRABAJADORA SOCIAL",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos", "Profesiogramas"],
    searchExpansionTerms: [
      "ASISTENTE MEDICA",
      "TRABAJADORA SOCIAL",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(farmacia|almac[eé]n|almacenista)\b/i,
    canonicalTitle: "OFICIAL DE FARMACIA / AUXILIAR DE ALMACÉN",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos", "Profesiogramas"],
    searchExpansionTerms: [
      "OFICIAL DE FARMACIA",
      "AUXILIAR DE FARMACIA",
      "AUXILIAR DE ALMACEN",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(laboratorista|auxiliar\s*de\s*laboratorio|qu[ií]mic[oa]\s*cl[ií]nic[oa]|citotecn[oó]log[oa]|histotecn[oó]log[oa])\b/i,
    canonicalTitle: "LABORATORISTA / QUÍMICO CLÍNICO",
    associatedClauses: ["Cláusula 63", "Cláusula 86 Bis", "Tabulador de Sueldos"],
    searchExpansionTerms: [
      "LABORATORISTA",
      "AUXILIAR DE LABORATORIO",
      "QUIMICO CLINICO",
      "CITOTECNOLOGO",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(auxiliar\s*universal\s*de\s*oficinas|auo\b|oficial\s*de\s*estad[ií]stica|oficial\s*de\s*personal|operador\s*telef[oó]nico|mensajero)\b/i,
    canonicalTitle: "AUXILIAR UNIVERSAL DE OFICINAS",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos", "Profesiogramas"],
    searchExpansionTerms: [
      "AUXILIAR UNIVERSAL DE OFICINAS",
      "OFICIAL DE ESTADISTICA",
      "OFICIAL DE PERSONAL",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(inhaloterapeuta|terapista\s*f[ií]sic[oa]|terapista\s*ocupacional|psic[oó]log[oa]|estomat[oó]log[oa]|dentista|fonoaudi[oó]log[oa])\b/i,
    canonicalTitle: "PERSONAL CLÍNICO Y PARAMÉDICO",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos", "Profesiogramas"],
    searchExpansionTerms: [
      "INHALOTERAPEUTA",
      "TERAPISTA FISICO",
      "PSICOLOGO CLINICO",
      "ESTOMATOLOGO",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(polivalente|electricista|plomero|mec[aá]nico|lavander[ií]a|ambulancia|operador\s*de\s*ambulancias|conservaci[oó]n)\b/i,
    canonicalTitle: "CONSERVACIÓN, LAVANDERÍA Y AMBULANCIAS",
    associatedClauses: ["Cláusula 63", "Tabulador de Sueldos", "Profesiogramas"],
    searchExpansionTerms: [
      "TECNICO POLIVALENTE",
      "OPERADOR DE SERVICIOS DE LAVANDERIA",
      "OPERADOR DE AMBULANCIAS",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(puericultista|guarder[ií]a|oficial\s*de\s*puericultura)\b/i,
    canonicalTitle: "OFICIAL DE PUERICULTURA / GUARDERÍAS",
    associatedClauses: ["Cláusula 63", "Reglamento de Guarderías", "Tabulador de Sueldos"],
    searchExpansionTerms: [
      "OFICIAL DE PUERICULTURA",
      "GUARDERIAS",
      "tabulador de sueldos",
      "profesiograma",
    ],
  },
  {
    keywords: /\b(cu[aá]nto (gana|gano|pagan)|cu[aá]l es el (sueldo|salario)|sueldo (de|neto|base|mensual|quincenal)|salario (de|base|mensual)|mi sueldo|ingreso mensual|percepciones|tabulador)\b/i,
    canonicalTitle: "SUELDO TABULAR DIARIO Y PERCEPCIONES",
    associatedClauses: ["Cláusula 63", "Cláusula 63 Bis", "Tabulador de Sueldos"],
    searchExpansionTerms: [
      "sueldo tabular diario",
      "concepto 011 ayuda de renta",
      "percepciones ordinarias",
      "tabulador de sueldos",
    ],
  },
  {
    keywords: /\b(peligrosidad|emanaciones|infecto|alto riesgo|riesgo de trabajo)\b/i,
    canonicalTitle: "SOBRESUELDO POR INFECTOCONTAGIOSIDAD Y EMANACIONES",
    associatedClauses: [
      "Cláusula 86 Bis",
      "Reglamento de Infectocontagiosidad y Emanaciones Radiactivas",
    ],
    searchExpansionTerms: [
      "clausula 86 bis",
      "concepto 063 emanaciones radiactivas",
      "concepto 058 infectocontagiosidad",
      "sobresueldo porcentaje",
    ],
  },
  {
    keywords: /\b(profesiograma|perfil de puesto|requisitos de puesto|funciones del puesto|actividades de)\b/i,
    canonicalTitle: "CATÁLOGO DE PROFESIOGRAMAS",
    associatedClauses: ["Profesiogramas", "Reglamento de Escalafón"],
    searchExpansionTerms: [
      "profesiograma descripcion de funciones",
      "requisitos academicos",
      "lineas de escalafon",
      "catalogo de puestos",
    ],
  },
]

export interface DecomposedQuery {
  focus: "SALARY" | "HAZARD_PAY" | "JOB_DESCRIPTION" | "GENERAL"
  query: string
}

const CONVERSATIONAL_STOPWORDS =
  /\b(cu[aá]l|cu[aá]les|cu[aá]nto|cu[aá]ntos|cu[aá]nta|cu[aá]ntas|c[oó]mo|d[oó]nde|cu[aá]ndo|qui[eé]n|qu[eé]|dime|expl[ií]came|puedes|podr[ií]as|quiero|necesito|saber|conocer|gana|gano|ganan|pagan|percibe|toca|corresponde|corresponden|hace|hacen|tengo|soy|favor|hola|buenos|buenas|d[ií]as|tardes|noches|gracias|ayuda|ay[uú]dame|mu[eé]strame|ens[eé][nñ]ame|h[aá]blame)\b/gi

/**
 * Construye una consulta léxica limpia para PostgreSQL FTS (`websearch_to_tsquery`),
 * eliminando verbos conversacionales e interrogativos que provocan 0 resultados
 * al combinarse con AND, y añadiendo términos canónicos de puesto con OR.
 */
export function buildLexicalQuery(
  question: string,
  matchedCategories: string[],
  hasSalary: boolean,
): string {
  const cleaned = question
    .replace(/[¿?¡!.,;:()"']/g, " ")
    .replace(CONVERSATIONAL_STOPWORDS, " ")
    .replace(/\s+/g, " ")
    .trim()

  const primaryCat = matchedCategories[0]
  if (primaryCat) {
    if (hasSalary) {
      return `sueldo ${primaryCat} OR ${primaryCat}`
    }
    return cleaned ? `${cleaned} OR ${primaryCat}` : primaryCat
  }

  if (hasSalary && cleaned && !/\bsueldo\b/i.test(cleaned)) {
    return `sueldo ${cleaned} OR ${cleaned}`
  }

  return cleaned || question.trim()
}

/**
 * Normaliza y expande la consulta léxica con términos canónicos de la institución.
 */
export function normalizeForRetrieval(
  question: string,
  userProfile?: SanitizedWorkerProfile | null,
): { expandedQuery: string; lexicalQuery: string; subQueries: DecomposedQuery[] } {
  const matchingExpansions: string[] = []
  const matchedCategories: string[] = []
  const subQueries: DecomposedQuery[] = []

  // 1. Si el usuario pregunta de forma personal ("cuánto gano", "mis vacaciones")
  // y cuenta con perfil de puesto en la plataforma, inyectamos su puesto directamente.
  const isPersonalQuery = /\b(cu[aá]nto (gano|me toca|me corresponde|debo ganar)|mi (sueldo|salario|puesto|categor[íi]a|aguinaldo|vacaci[oó]n))\b/i.test(
    question,
  )

  if (isPersonalQuery && userProfile?.hasProfile) {
    if (userProfile.categoria) {
      matchingExpansions.push(userProfile.categoria)
      matchedCategories.push(userProfile.categoria)
    }
    if (userProfile.jornadaHoras) {
      matchingExpansions.push(`jornada ${userProfile.jornadaHoras}`)
    }
    if (userProfile.exposicionRadiologica) {
      matchingExpansions.push("clausula 86 bis emanaciones radiactivas concepto 063")
    }
  }

  // 2. Mapeos canónicos por palabras clave en la pregunta
  for (const m of CANONICAL_MAPPINGS) {
    if (m.keywords.test(question)) {
      matchingExpansions.push(...m.searchExpansionTerms)
      if (
        m.canonicalTitle !== "SUELDO TABULAR DIARIO Y PERCEPCIONES" &&
        m.canonicalTitle !== "SOBRESUELDO POR INFECTOCONTAGIOSIDAD Y EMANACIONES" &&
        m.canonicalTitle !== "CATÁLOGO DE PROFESIOGRAMAS"
      ) {
        matchedCategories.push(m.searchExpansionTerms[0])
      }
    }
  }

  // 3. Descomposición Multi-Query cuando se detecta más de un dominio (ej. sueldo + riesgo + profesiograma)
  const hasSalary = /\b(sueldo|salario|gana|gano|ganan|percepciones|pag[ao]n?|tabulador)\b/i.test(question)
  const hasHazard = /\b(radi[oó]log[oa]s?|rayos|riesgo|emanaci[oó]n|infecto|peligro)\b/i.test(question)
  const hasJobDesc = /\b(profesiograma|funciones|requisitos|perfil|puesto|actividades)\b/i.test(question)

  if (hasSalary) {
    subQueries.push({
      focus: "SALARY",
      query: `${question} sueldo tabular diario tabulador de sueldos clausula 63`,
    })
  }
  if (hasHazard) {
    subQueries.push({
      focus: "HAZARD_PAY",
      query: `${question} emanaciones radiactivas clausula 86 bis concepto 063 reglamento infectocontagiosidad`,
    })
  }
  if (hasJobDesc) {
    subQueries.push({
      focus: "JOB_DESCRIPTION",
      query: `${question} profesiograma catalogo de perfiles de puesto requisitos funciones`,
    })
  }

  // Si no hubo subconsultas específicas, crear una genérica
  if (subQueries.length === 0) {
    subQueries.push({
      focus: "GENERAL",
      query: question,
    })
  }

  const dedupedTerms = [...new Set(matchingExpansions)].join(" ")
  const expandedQuery = dedupedTerms ? `${question} ${dedupedTerms}` : question
  const lexicalQuery = buildLexicalQuery(question, matchedCategories, hasSalary)

  return { expandedQuery, lexicalQuery, subQueries }
}
