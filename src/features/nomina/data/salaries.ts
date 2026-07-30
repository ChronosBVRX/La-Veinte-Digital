import { CATALOGO_CATEGORIAS } from "@/shared/lib/catalogo-categorias"
import { deriveWorkdayHoursFromCategoryName } from "../lib/types"

export interface SalaryDataRecord {
  categoryId: string
  categoryName: string
  categoryCode?: string
  workdayHours?: number
  monthlyBaseSalary?: number
  biweeklyBaseSalary: number
  effectiveFrom?: string
  effectiveTo?: string
  sourceRecordId: string
}

export const SALARY_DATA: SalaryDataRecord[] = CATALOGO_CATEGORIAS.map((c) => ({
  categoryId: c.nombre,
  categoryName: c.nombre,
  categoryCode: c.nombre,
  workdayHours: deriveWorkdayHoursFromCategoryName(c.nombre) ?? 8,
  biweeklyBaseSalary: c.sueldoQuincenal,
  effectiveFrom: "2025-01-01",
  sourceRecordId: `catalog:${c.nombre}`,
}))
