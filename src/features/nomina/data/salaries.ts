import { CATALOGO_CATEGORIAS } from "@/shared/lib/catalogo-categorias"
import { deriveWorkdayHoursFromCategoryName } from "../lib/types"

export interface SalaryDataRecord {
  categoryId: string
  categoryCode?: string
  categoryName: string
  biweeklyBaseSalary: number
  monthlyBaseSalary?: number
  workdayHours: number
  effectiveFrom: string
  effectiveTo?: string
  salaryTableVersion: string
  sourceRecordId: string
}

/**
 * Versión del tabulador. Se incrementa cuando cambia una tabla de sueldos.
 * La política de prerrelleno lo expone como ruleVersion en cada campo salarial.
 */
export const SALARY_TABLE_VERSION = "salary-table-2025-2027"

/**
 * ID estable y determinista por categoría, derivado del nombre del catálogo.
 * Ejemplo: "TECNICO RADIOLOGO 80" -> "TECNICO_RADIOLOGO_80".
 * A diferencia del índice numérico anterior, este ID no cambia si el
 * tabulador se reordena o se insertan registros.
 */
export function stableCategoryId(categoryName: string): string {
  return categoryName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export const SALARY_DATA: SalaryDataRecord[] = CATALOGO_CATEGORIAS.map((c) => ({
  categoryId: stableCategoryId(c.nombre),
  categoryName: c.nombre,
  categoryCode: c.nombre,
  workdayHours: deriveWorkdayHoursFromCategoryName(c.nombre) ?? 8,
  monthlyBaseSalary: c.sueldoQuincenal * 2,
  biweeklyBaseSalary: c.sueldoQuincenal,
  effectiveFrom: "2025-01-01",
  salaryTableVersion: SALARY_TABLE_VERSION,
  sourceRecordId: `catalog:${c.nombre}`,
}))

/**
 * Mapeo de compatibilidad con los IDs numéricos anteriores (índice del
 * arreglo original: "1".."117"). Permite resolver perfiles guardados antes
 * de la migración a IDs estables sin perder información.
 */
export const LEGACY_CATEGORY_ID_MAP: ReadonlyMap<string, string> = new Map(
  CATALOGO_CATEGORIAS.map((_, idx) => [String(idx + 1), SALARY_DATA[idx].categoryId])
)

export function isRecordActiveAt(record: SalaryDataRecord, date: string): boolean {
  if (!record.effectiveFrom || record.effectiveFrom > date) return false
  if (record.effectiveTo && record.effectiveTo < date) return false
  return true
}
