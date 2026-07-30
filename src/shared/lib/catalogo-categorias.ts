export interface CategoriaSalarial {
  nombre: string
  sueldoQuincenal: number
  concepto011: number
}

import catalogData from "@/shared/data/catalogo-categorias.json"

export const CATALOGO_CATEGORIAS: CategoriaSalarial[] = catalogData as CategoriaSalarial[]

const CATEGORIA_MAP = new Map<string, CategoriaSalarial>()
for (const c of CATALOGO_CATEGORIAS) {
  CATEGORIA_MAP.set(c.nombre.toLowerCase(), c)
}

export function findCategoria(nombre: string): CategoriaSalarial | undefined {
  const norm = nombre.toLowerCase().trim()
  const exact = CATEGORIA_MAP.get(norm)
  if (exact) return exact

  for (const [key, cat] of CATEGORIA_MAP) {
    if (key.includes(norm) || norm.includes(key)) return cat
  }

  for (const [key, cat] of CATEGORIA_MAP) {
    const keyWords = key.split(/\s+/)
    const normWords = norm.split(/\s+/)
    const matchCount = keyWords.filter((kw) => normWords.some((nw) => nw.includes(kw) || kw.includes(nw))).length
    if (matchCount >= Math.min(keyWords.length, normWords.length) * 0.5) return cat
  }

  return undefined
}

export function getAllCategorias(): CategoriaSalarial[] {
  return CATALOGO_CATEGORIAS
}
