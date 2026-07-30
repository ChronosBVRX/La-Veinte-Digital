export interface CategoryPercentageEntry {
  categoryPattern?: string
  categoryId?: string
  percentage: number
  notes?: string
}

export interface PercentageTable {
  id: string
  description: string
  entries: CategoryPercentageEntry[]
  defaultPercentage?: number
}

export const PERCENTAGE_TABLES: Record<string, PercentageTable> = {
  concept_072_category_percentages: {
    id: "concept_072_category_percentages",
    description: "Porcentajes de Ayuda para Libros no médicos por categoría",
    entries: [
      { categoryPattern: "TECNICO RADIOLOGO", percentage: 0.05, notes: "Técnico Radiólogo" },
      { categoryPattern: "TRABAJADOR SOCIAL", percentage: 0.05, notes: "Trabajo Social" },
    ],
    defaultPercentage: 0.05,
  },
}

export function getPercentageForConcept072(
  categoryName: string,
  categoryId?: string,
): number | null {
  return getPercentageForCategory("concept_072_category_percentages", categoryName, categoryId)
}

export function getPercentageForCategory(
  tableId: string,
  categoryName: string,
  categoryId?: string
): number | null {
  const table = PERCENTAGE_TABLES[tableId]
  if (!table) return null

  const normalized = categoryName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()

  for (const entry of table.entries) {
    if (entry.categoryId && entry.categoryId === categoryId) return entry.percentage
    if (entry.categoryPattern && normalized.includes(entry.categoryPattern)) return entry.percentage
  }

  return table.defaultPercentage ?? null
}
