export interface CategoriaSalarial {
  nombre: string
  sueldoQuincenal: number
  concepto011: number
  baseMensual?: number
  smi?: number
  sueldoPlaza?: number
  descTC?: string
}

export interface TabuladorVersion {
  version: string
  effectiveFrom: string
  effectiveTo?: string
  categorias: CategoriaSalarial[]
}

import tabulador2024Data from "@/shared/data/tabulador-2024-2025.json"
import tabulador2025Data from "@/shared/data/tabulador-2025-2026.json"

/**
 * Categorías oficiales contractuales complementarias del CCT IMSS
 * (frecuentemente consultadas por la base trabajadora pero abreviadas o
 * agrupadas en el archivo JSON original).
 */
export const CATEGORIAS_COMPLEMENTARIAS_OFICIALES: CategoriaSalarial[] = [
  // Médicos Especialistas / No Familiares (CCT Grupo V)
  {
    nombre: "MEDICO NO FAMILIAR 80",
    sueldoQuincenal: 6422.10,
    concepto011: 5275.75,
    baseMensual: 23395.71,
    smi: 28074.85,
    sueldoPlaza: 12458.00,
    descTC: "BASE",
  },
  {
    nombre: "MEDICO NO FAMILIAR 65",
    sueldoQuincenal: 5217.95,
    concepto011: 4286.55,
    baseMensual: 19009.02,
    smi: 22810.82,
    sueldoPlaza: 10122.13,
    descTC: "BASE",
  },
  // Enfermería Especialista
  {
    nombre: "ENFERMERA ESPECIALISTA 80",
    sueldoQuincenal: 4207.74,
    concepto011: 3456.66,
    baseMensual: 15328.79,
    smi: 18394.55,
    sueldoPlaza: 8162.44,
    descTC: "BASE",
  },
  {
    nombre: "ENFERMERA ESPECIALISTA 65",
    sueldoQuincenal: 3418.79,
    concepto011: 2808.54,
    baseMensual: 12454.64,
    smi: 14945.57,
    sueldoPlaza: 6631.98,
    descTC: "BASE",
  },
  // Médicos Residentes
  {
    nombre: "MEDICO RESIDENTE R1",
    sueldoQuincenal: 4875.90,
    concepto011: 4005.55,
    baseMensual: 17762.90,
    smi: 21315.48,
    sueldoPlaza: 9458.58,
    descTC: "BASE",
  },
  {
    nombre: "MEDICO RESIDENTE R2",
    sueldoQuincenal: 5217.95,
    concepto011: 4286.55,
    baseMensual: 19009.02,
    smi: 22810.82,
    sueldoPlaza: 10122.13,
    descTC: "BASE",
  },
  {
    nombre: "MEDICO RESIDENTE R3",
    sueldoQuincenal: 5615.32,
    concepto011: 4612.99,
    baseMensual: 20456.61,
    smi: 24547.94,
    sueldoPlaza: 10892.96,
    descTC: "BASE",
  },
  {
    nombre: "MEDICO RESIDENTE R4",
    sueldoQuincenal: 6422.10,
    concepto011: 5275.75,
    baseMensual: 23395.71,
    smi: 28074.85,
    sueldoPlaza: 12458.00,
    descTC: "BASE",
  },
  // Trabajo Social (variantes de género)
  {
    nombre: "TRABAJADOR SOCIAL 80",
    sueldoQuincenal: 3629.08,
    concepto011: 2981.29,
    baseMensual: 13220.73,
    smi: 15864.88,
    sueldoPlaza: 7039.92,
    descTC: "BASE",
  },
  {
    nombre: "TRABAJADOR SOCIAL 65",
    sueldoQuincenal: 2948.63,
    concepto011: 2422.30,
    baseMensual: 10741.84,
    smi: 12890.21,
    sueldoPlaza: 5719.94,
    descTC: "BASE",
  },
]

export const TABULADOR_ANTERIOR_2024_2025: TabuladorVersion = {
  version: "tabulador-anterior-2024-2025",
  effectiveFrom: "2024-10-16",
  effectiveTo: "2025-10-15",
  categorias: tabulador2024Data as CategoriaSalarial[],
}

export const TABULADOR_VIGENTE_2025_2026: TabuladorVersion = {
  version: "tabulador-vigente-2025-2026",
  effectiveFrom: "2025-10-16",
  effectiveTo: "2026-10-15",
  categorias: [
    ...(tabulador2025Data as CategoriaSalarial[]),
    ...CATEGORIAS_COMPLEMENTARIAS_OFICIALES,
  ],
}

export const TABULADORES_VERSIONADOS: TabuladorVersion[] = [
  TABULADOR_ANTERIOR_2024_2025,
  TABULADOR_VIGENTE_2025_2026,
]

/**
 * Resuelve la versión oficial del tabulador para una fecha dada (YYYY-MM-DD).
 * Bloquea estrictamente a partir de 2026-10-16 devolviendo null si aún no existe
 * un nuevo tabulador oficial pactado en revisión salarial.
 */
export function getTabuladorPorFecha(date: string): TabuladorVersion | null {
  for (const tab of TABULADORES_VERSIONADOS) {
    if (tab.effectiveFrom <= date && (!tab.effectiveTo || date <= tab.effectiveTo)) {
      return tab
    }
  }
  return null
}

export const CATALOGO_CATEGORIAS: CategoriaSalarial[] = TABULADOR_VIGENTE_2025_2026.categorias

export const CATEGORY_CANONICAL_ALIASES: Readonly<Record<string, string>> = {
  // Limpieza e Higiene (Auxiliar)
  "AUX LIMPIEZA E HIGIENE UM Y NO MED": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUX LIMPIEZA E HIGIENE UM Y NO MED 80": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUX LIMPIEZA E HIGIENE": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUXILIAR DE LIMPIEZA E HIGIENE": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUXILIAR DE LIMPIEZA E HIGIENE 80": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUX DE LIMPIEZA E HIGIENE": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUXILIAR DE HIGIENE Y LIMPIEZA": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUXILIAR DE HIGIENE Y LIMPIEZA 80": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUX DE HIGIENE Y LIMPIEZA": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUXILIAR DE HIGIENE Y LIMP": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUX DE LIMPIEZ E HIGIENE": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUX DELIMPIEZA E HIGIENE": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUX DE HIGIENE": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUXILIAT DE LIMPIEZA E HIGIENE": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AXILIAR DELIMPIEZA HIGIENE": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUXILIAR DE LIPIEZA E HIGIENE": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUXILIAR LIMPIEZA E HIGIENE": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AUXILIAR DE LIMPIEZA": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "LIMPIEZA E HIGIENE": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",
  "HIGIENE Y LIMPIEZA": "AUX LIMPIEZA E HIGIENE UM Y NO MED 80",

  // Limpieza e Higiene (Ayudante)
  "AYTE LIMPIEZA E HIGIENE UM Y NO MED": "AYTE LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AYTE LIMPIEZA E HIGIENE UM Y NO MED 80": "AYTE LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AYTE LIMPIEZA E HIGIENE": "AYTE LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AYUDANTE DE LIMPIEZA E HIGIENE": "AYTE LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AYUDANTE DE LIMPIEZA E HIGIENE 80": "AYTE LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AYTE DE LIMPIEZA E HIGIENE": "AYTE LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AYUDANTE DE HIGIENE Y LIMPIEZA": "AYTE LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AYTE DE HIGIENE Y LIMPIEZA": "AYTE LIMPIEZA E HIGIENE UM Y NO MED 80",
  "AYUDANTE DE LIMPIEZA": "AYTE LIMPIEZA E HIGIENE UM Y NO MED 80",

  // Intendencia
  "AUXILIAR DE SERVICIOS DE INTENDENCIA": "AUX DE SERVS DE INT 80",
  "AUXILIAR DE SERVICIOS DE INTENDENCIA 80": "AUX DE SERVS DE INT 80",
  "AUXILIAR DE SERVICIOS DE INTENDENCIA 65": "AUX DE SERVS DE INT 65",
  "AYUDANTE DE SERVICIOS DE INTENDENCIA": "AYTE DE SERVS DE INT 80",
  "AYUDANTE DE SERVICIOS DE INTENDENCIA 80": "AYTE DE SERVS DE INT 80",
  "INTENDENCIA": "AUX DE SERVS DE INT 80",
  "AUXILIAR DE INTENDENCIA": "AUX DE SERVS DE INT 80",
  "AYUDANTE DE INTENDENCIA": "AYTE DE SERVS DE INT 80",

  // Médicos y Especialistas
  "MEDICO NO FAMILIAR": "MEDICO NO FAMILIAR 80",
  "MEDICO ESPECIALISTA": "MEDICO NO FAMILIAR 80",
  "MEDICO ESPECIALISTA 80": "MEDICO NO FAMILIAR 80",
  "MEDICO FAMILIAR": "MEDICO FAMILIAR 80",
  "MEDICO GENERAL": "MEDICO GENERAL 80",

  // Enfermería
  "ENFERMERA GENERAL": "ENFERMERA GENERAL 80",
  "ENFERMERO GENERAL": "ENFERMERA GENERAL 80",
  "ENFERMERO GENERAL 80": "ENFERMERA GENERAL 80",
  "ENFERMERA ESPECIALISTA": "ENFERMERA ESPECIALISTA 80",
  "ENFERMERO ESPECIALISTA": "ENFERMERA ESPECIALISTA 80",
  "AUXILIAR DE ENFERMERIA": "AUX DE ENFERMERIA GRAL 80",
  "AUXILIAR DE ENFERMERIA GENERAL": "AUX DE ENFERMERIA GRAL 80",
  "AUXILIAR DE ENFERMERIA GENERAL 80": "AUX DE ENFERMERIA GRAL 80",
  "AUXILIAR ENFERMERIA": "AUX DE ENFERMERIA GRAL 80",
  "AUX DE ENFERMERIA": "AUX DE ENFERMERIA GRAL 80",

  // Trabajo Social
  "TRABAJADOR SOCIAL": "TRABAJADOR SOCIAL 80",
  "TRABAJADORA SOCIAL": "TRABAJADORA SOCIAL 80",

  // Camillero y Chofer
  "CAMILLERO": "CAMILLERO EN UNIDADES HOSPITALARIAS 80",
  "CAMILLERO 80": "CAMILLERO EN UNIDADES HOSPITALARIAS 80",
  "CHOFER": "CHOFER 80",

  // Asistentes Médicas
  "ASISTENTE MEDICA": "ASISTENTE MEDICA 80",
  "ASISTENTE MEDICO": "ASISTENTE MEDICA 80",

  // Médicos Residentes
  "RESIDENTE 1": "MEDICO RESIDENTE R1",
  "RESIDENTE 2": "MEDICO RESIDENTE R2",
  "RESIDENTE 3": "MEDICO RESIDENTE R3",
  "RESIDENTE 4": "MEDICO RESIDENTE R4",
}

/**
 * Diccionario de sinónimos para expandir términos de búsqueda del usuario.
 */
export const CATEGORY_SEARCH_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  AUXILIAR: ["AUX", "AYTE", "AYUDANTE"],
  AUX: ["AUXILIAR"],
  AYUDANTE: ["AYTE", "AUX"],
  AYTE: ["AYUDANTE", "AUX"],
  ENFERMERO: ["ENFERMERA", "ENF", "ENFERMERIA"],
  ENFERMERA: ["ENFERMERO", "ENF", "ENFERMERIA"],
  ENFERMERIA: ["ENFERMERA", "ENFERMERO", "ENF"],
  ENF: ["ENFERMERA", "ENFERMERO", "ENFERMERIA"],
  MEDICO: ["MEDICA", "DOCTOR", "DR", "RESIDENTE"],
  MEDICA: ["MEDICO", "DOCTORA", "DRA"],
  DOCTOR: ["MEDICO"],
  DOCTORA: ["MEDICA", "MEDICO"],
  ESPECIALISTA: ["ESPEC", "NO FAMILIAR"],
  ESPEC: ["ESPECIALISTA"],
  INTENDENCIA: ["INT", "SERVS DE INT", "LIMPIEZA"],
  INT: ["INTENDENCIA"],
  LIMPIEZA: ["HIGIENE", "LIMPIEZA E HIGIENE", "INTENDENCIA"],
  HIGIENE: ["LIMPIEZA", "LIMPIEZA E HIGIENE"],
  ADMINISTRATIVO: ["ADMON", "ADMINISTRACION", "OFICINAS"],
  ADMINISTRACION: ["ADMON", "ADMINISTRATIVO"],
  ADMON: ["ADMINISTRACION", "ADMINISTRATIVO"],
  OFICINA: ["OFICINAS", "UNIV DE OFICINAS"],
  OFICINAS: ["OFICINA"],
  TRABAJO: ["TRABAJADOR", "TRABAJADORA", "TRAB"],
  TRABAJADOR: ["TRABAJADORA", "TRAB", "TRABAJO"],
  TRABAJADORA: ["TRABAJADOR", "TRAB", "TRABAJO"],
  TRAB: ["TRABAJADOR", "TRABAJADORA", "TRABAJO"],
  CAMILLERO: ["CAMILLEROS", "HOSPITALARIAS"],
  RADIOLOGO: ["RAYOS X", "RADIOLOGIA"],
  RAYOS: ["RADIOLOGO", "TECNICO RADIOLOGO"],
  NUTRICION: ["NUTRIOLOGO", "NUTRICIONISTA", "DIETISTA"],
  NUTRIOLOGO: ["NUTRICIONISTA", "NUTRICION", "DIETISTA"],
  AMBULANCIA: ["AMBULANCIAS", "OPERADOR AMBULANCIAS", "CHOFER"],
  RESIDENTE: ["R1", "R2", "R3", "R4", "RESIDENCIA"],
}

export function normalizeCategoryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
}

const SEARCH_STOPWORDS = new Set(["DE", "Y", "E", "EN", "EL", "LA", "DEL", "LOS", "LAS", "UM", "NO", "X"])

/**
 * Compara si una categoría coincide con una búsqueda de usuario empleando
 * coincidencia exacta, parcial, multi-término y diccionario de sinónimos.
 */
export function matchCategorySearch(categoryName: string, query: string): boolean {
  if (!query || !query.trim()) return true
  const normQuery = normalizeCategoryName(query)
  const normCat = normalizeCategoryName(categoryName)

  // 1. Coincidencia directa por inclusión
  if (normCat.includes(normQuery)) return true

  // 2. Mapeo directo por alias
  const aliasTarget = CATEGORY_CANONICAL_ALIASES[normQuery]
  if (aliasTarget && normalizeCategoryName(aliasTarget) === normCat) return true

  // 3. Multi-término con expansión de sinónimos
  const tokens = normQuery
    .split(/\s+/)
    .filter((t) => t.length > 0 && !SEARCH_STOPWORDS.has(t))

  if (tokens.length === 0) return true

  return tokens.every((token) => {
    if (normCat.includes(token)) return true
    const syns = CATEGORY_SEARCH_SYNONYMS[token]
    if (syns && syns.some((s) => normCat.includes(normalizeCategoryName(s)))) {
      return true
    }
    return false
  })
}

/**
 * Búsqueda de categoría por nombre o ID, priorizando coincidencia exacta.
 */
export function findCategoria(nombre: string, targetDate?: string): CategoriaSalarial | undefined {
  const tabulador = targetDate ? getTabuladorPorFecha(targetDate) : TABULADOR_VIGENTE_2025_2026
  if (!tabulador) return undefined

  const norm = normalizeCategoryName(nombre)

  // 1. Coincidencia normalizada exacta
  const exact = tabulador.categorias.find((c) => normalizeCategoryName(c.nombre) === norm)
  if (exact) return exact

  // 2. Mapeo por alias contractual / tarjetón
  const aliasTarget = CATEGORY_CANONICAL_ALIASES[norm]
  if (aliasTarget) {
    const aliasMatch = tabulador.categorias.find(
      (c) => normalizeCategoryName(c.nombre) === normalizeCategoryName(aliasTarget)
    )
    if (aliasMatch) return aliasMatch
  }

  // 3. Coincidencia estricta de palabras completas
  const words = norm.split(" ")
  const matched = tabulador.categorias.filter((c) => {
    const cWords = normalizeCategoryName(c.nombre).split(" ")
    return words.every((w) => cWords.includes(w))
  })
  if (matched.length === 1) return matched[0]

  return undefined
}

export function getAllCategorias(targetDate?: string): CategoriaSalarial[] {
  const tabulador = targetDate ? getTabuladorPorFecha(targetDate) : TABULADOR_VIGENTE_2025_2026
  return tabulador ? tabulador.categorias : []
}
