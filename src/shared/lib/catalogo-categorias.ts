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
  categorias: tabulador2025Data as CategoriaSalarial[],
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
}

export function normalizeCategoryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
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
