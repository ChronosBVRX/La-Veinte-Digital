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
    keywords: /\b(cu[aá]nto (gana|gano|pagan)|sueldo neto|salario base|mi sueldo|ingreso mensual|percepciones)\b/i,
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
    keywords: /\b(profesiograma|perfil de puesto|requisitos de puesto|funciones del puesto)\b/i,
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

/**
 * Normaliza y expande la consulta léxica con términos canónicos de la institución.
 */
export function normalizeForRetrieval(
  question: string,
  userProfile?: SanitizedWorkerProfile | null,
): { expandedQuery: string; subQueries: DecomposedQuery[] } {
  const matchingExpansions: string[] = []
  const subQueries: DecomposedQuery[] = []

  // 1. Si el usuario pregunta de forma personal ("cuánto gano", "mis vacaciones")
  // y cuenta con perfil de puesto en la plataforma, inyectamos su puesto directamente.
  const isPersonalQuery = /\b(cu[aá]nto (gano|me toca|me corresponde|debo ganar)|mi (sueldo|salario|puesto|categor[íi]a|aguinaldo|vacaci[oó]n))\b/i.test(
    question,
  )

  if (isPersonalQuery && userProfile?.hasProfile) {
    if (userProfile.categoria) {
      matchingExpansions.push(userProfile.categoria)
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
    }
  }

  // 3. Descomposición Multi-Query cuando se detecta más de un dominio (ej. sueldo + riesgo + profesiograma)
  const hasSalary = /\b(sueldo|salario|gana|gano|percepciones|pag[ao])\b/i.test(question)
  const hasHazard = /\b(radi[oó]log[oa]s?|rayos|riesgo|emanaci[oó]n|infecto|peligro)\b/i.test(question)
  const hasJobDesc = /\b(profesiograma|funciones|requisitos|perfil|puesto)\b/i.test(question)

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

  return { expandedQuery, subQueries }
}
