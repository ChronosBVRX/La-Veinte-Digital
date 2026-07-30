import type { ResolvedSalaryCategory } from "./types"
import { SALARY_DATA } from "../data/salaries"

export async function resolveSalaryCategory(
  categoryId: string,
  _projectionDate: string
): Promise<ResolvedSalaryCategory | null> {
  void _projectionDate
  const normalized = categoryId.replace(/\s+/g, " ").trim().toLowerCase()
  const record = SALARY_DATA.find(
    (s) =>
      s.categoryId.replace(/\s+/g, " ").trim().toLowerCase() === normalized ||
      s.categoryName.replace(/\s+/g, " ").trim().toLowerCase() === normalized
  )

  if (!record) {
    return null
  }

  return {
    categoryId: record.categoryId,
    categoryName: record.categoryName,
    categoryCode: record.categoryCode,
    workdayHours: record.workdayHours,
    monthlyBaseSalary: record.monthlyBaseSalary,
    biweeklyBaseSalary: record.biweeklyBaseSalary,
    effectiveFrom: record.effectiveFrom,
    effectiveTo: record.effectiveTo,
    sourceRecordId: record.sourceRecordId,
  }
}

export async function resolveSalaryCategoryByName(
  categoryName: string,
  projectionDate: string
): Promise<ResolvedSalaryCategory | null> {
  return resolveSalaryCategory(categoryName, projectionDate)
}
