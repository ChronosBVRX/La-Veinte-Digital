import type { ResolvedSalaryCategory } from "./types"
import { SALARY_DATA, LEGACY_CATEGORY_ID_MAP, isRecordActiveAt, type SalaryDataRecord } from "../data/salaries"

export interface CategoryMatch {
  category: ResolvedSalaryCategory
  score: number
  reasons: string[]
}

export interface CategoryResolutionResult {
  resolved: boolean
  category?: ResolvedSalaryCategory
  matches?: CategoryMatch[]
  resolutionMethod?: "id" | "code" | "exact_name" | "alias" | "fuzzy" | "manual"
  status: "resolved" | "ambiguous" | "not_found" | "error"
  message?: string
}

function normalizeCategoryText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

function isNumericText(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim())
}

function toResolvedCategory(record: SalaryDataRecord): ResolvedSalaryCategory {
  return {
    categoryId: record.categoryId,
    categoryName: record.categoryName,
    categoryCode: record.categoryCode,
    workdayHours: record.workdayHours,
    monthlyBaseSalary: record.monthlyBaseSalary,
    biweeklyBaseSalary: record.biweeklyBaseSalary,
    conceptoTabular011: record.conceptoTabular011,
    effectiveFrom: record.effectiveFrom,
    effectiveTo: record.effectiveTo,
    salaryTableVersion: record.salaryTableVersion,
    sourceRecordId: record.sourceRecordId,
  }
}

function calculateScore(input: string, candidate: string): number {
  const normInput = normalizeCategoryText(input)
  const normCandidate = normalizeCategoryText(candidate)

  if (normInput === normCandidate) return 1.0

  const inputWords = normInput.split(/\s+/)
  const candidateWords = normCandidate.split(/\s+/)

  let matches = 0
  const usedCandidate = new Set<number>()

  for (const iw of inputWords) {
    for (let j = 0; j < candidateWords.length; j++) {
      if (usedCandidate.has(j)) continue
      if (iw === candidateWords[j] || candidateWords[j].includes(iw) || iw.includes(candidateWords[j])) {
        matches++
        usedCandidate.add(j)
        break
      }
    }
  }

  const maxLen = Math.max(inputWords.length, candidateWords.length)
  return matches / maxLen
}

export function resolveCategory(
  identifier: string,
  date: string,
  existingCategoryId?: string,
): CategoryResolutionResult {
  const activeRecords = SALARY_DATA.filter((r) => isRecordActiveAt(r, date))

  if (activeRecords.length === 0) {
    return {
      resolved: false,
      matches: [],
      status: "not_found",
      message: `No hay versión del tabulador vigente para la fecha ${date}`,
    }
  }

  if (existingCategoryId) {
    const stableId = LEGACY_CATEGORY_ID_MAP.get(existingCategoryId) ?? existingCategoryId
    const exact = activeRecords.find((s) => s.categoryId === stableId)
    if (exact) {
      return {
        resolved: true,
        category: toResolvedCategory(exact),
        resolutionMethod: "id",
        status: "resolved",
      }
    }
  }

  const normInput = normalizeCategoryText(identifier)

  const exactById = activeRecords.find((s) => normalizeCategoryText(s.categoryId) === normInput)
  if (exactById) {
    return {
      resolved: true,
      category: toResolvedCategory(exactById),
      resolutionMethod: "id",
      status: "resolved",
    }
  }

  const exactByCode = activeRecords.find((s) => s.categoryCode && normalizeCategoryText(s.categoryCode) === normInput)
  if (exactByCode) {
    return {
      resolved: true,
      category: toResolvedCategory(exactByCode),
      resolutionMethod: "code",
      status: "resolved",
    }
  }

  const exactByName = activeRecords.find((s) => normalizeCategoryText(s.categoryName) === normInput)
  if (exactByName) {
    return {
      resolved: true,
      category: toResolvedCategory(exactByName),
      resolutionMethod: "exact_name",
      status: "resolved",
    }
  }

  const legacyById = LEGACY_CATEGORY_ID_MAP.get(identifier.trim())
  if (legacyById) {
    const legacyRecord = activeRecords.find((s) => s.categoryId === legacyById)
    if (legacyRecord) {
      return {
        resolved: true,
        category: toResolvedCategory(legacyRecord),
        resolutionMethod: "id",
        status: "resolved",
      }
    }
  }

  // Una entrada puramente numérica sin coincidencia exacta (ni ID ni ID
  // anterior) es una falsa coincidencia: "5" o "10" no deben matchear por
  // similitud contra nombres de categorías.
  if (isNumericText(identifier)) {
    return {
      resolved: false,
      matches: [],
      status: "not_found",
      message: `No se encontró ninguna categoría con el identificador "${identifier}"`,
    }
  }

  const scored: CategoryMatch[] = activeRecords
    .map((s) => ({
      category: toResolvedCategory(s),
      score: calculateScore(identifier, s.categoryName),
      reasons: [] as string[],
    }))
    .filter((m) => m.score >= 0.75)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((m) => ({
      ...m,
      reasons: [`Coincidencia: ${(m.score * 100).toFixed(0)}%`],
    }))

  if (scored.length === 0) {
    return {
      resolved: false,
      matches: [],
      status: "not_found",
      message: `No se encontró ninguna categoría similar a "${identifier}"`,
    }
  }

  if (scored.length === 1 && scored[0].score >= 0.95) {
    return {
      resolved: true,
      category: scored[0].category,
      matches: scored,
      resolutionMethod: "fuzzy",
      status: "resolved",
    }
  }

  if (scored.length === 1 && scored[0].score >= 0.75) {
    return {
      resolved: true,
      category: scored[0].category,
      matches: scored,
      resolutionMethod: "fuzzy",
      status: "resolved",
      message: "Se encontró una posible coincidencia. Verifica que sea correcta.",
    }
  }

  return {
    resolved: false,
    matches: scored.slice(0, 5),
    status: "ambiguous",
    message: "Encontramos más de una categoría parecida. ¿Cuál aparece en tu tarjetón?",
  }
}

export async function resolveSalaryCategory(
  categoryId: string,
  projectionDate: string,
): Promise<ResolvedSalaryCategory | null> {
  const result = resolveCategory(categoryId, projectionDate, categoryId)
  return result.category ?? null
}

export async function resolveSalaryCategoryByName(
  categoryName: string,
  projectionDate: string,
): Promise<ResolvedSalaryCategory | null> {
  const result = resolveCategory(categoryName, projectionDate)
  return result.category ?? null
}
