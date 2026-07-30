import type { ResolvedSalaryCategory } from "./types"
import { SALARY_DATA } from "../data/salaries"

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
  void date

  if (existingCategoryId) {
    const exact = SALARY_DATA.find((s) => s.categoryId === existingCategoryId)
    if (exact) {
      const cat: ResolvedSalaryCategory = {
        categoryId: exact.categoryId,
        categoryName: exact.categoryName,
        categoryCode: exact.categoryCode,
        workdayHours: exact.workdayHours,
        monthlyBaseSalary: exact.monthlyBaseSalary,
        biweeklyBaseSalary: exact.biweeklyBaseSalary,
        effectiveFrom: exact.effectiveFrom,
        effectiveTo: exact.effectiveTo,
        sourceRecordId: exact.sourceRecordId,
      }
      return {
        resolved: true,
        category: cat,
        resolutionMethod: "id",
        status: "resolved",
      }
    }
  }

  const normInput = normalizeCategoryText(identifier)

  const exact = SALARY_DATA.find(
    (s) => normalizeCategoryText(s.categoryId) === normInput || normalizeCategoryText(s.categoryName) === normInput,
  )
  if (exact) {
    const cat: ResolvedSalaryCategory = {
      categoryId: exact.categoryId,
      categoryName: exact.categoryName,
      categoryCode: exact.categoryCode,
      workdayHours: exact.workdayHours,
      monthlyBaseSalary: exact.monthlyBaseSalary,
      biweeklyBaseSalary: exact.biweeklyBaseSalary,
      effectiveFrom: exact.effectiveFrom,
      effectiveTo: exact.effectiveTo,
      sourceRecordId: exact.sourceRecordId,
    }
    return {
      resolved: true,
      category: cat,
      resolutionMethod: "exact_name",
      status: "resolved",
    }
  }

  const scored: CategoryMatch[] = SALARY_DATA
    .map((s) => ({
      category: {
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        categoryCode: s.categoryCode,
        workdayHours: s.workdayHours,
        monthlyBaseSalary: s.monthlyBaseSalary,
        biweeklyBaseSalary: s.biweeklyBaseSalary,
        effectiveFrom: s.effectiveFrom,
        effectiveTo: s.effectiveTo,
        sourceRecordId: s.sourceRecordId,
      },
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
