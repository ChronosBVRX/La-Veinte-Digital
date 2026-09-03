import {
  TABULADORES_VERSIONADOS,
  TABULADOR_VIGENTE_2025_2026,
  type TabuladorVersion,
} from "@/shared/lib/catalogo-categorias"
import { deriveWorkdayHoursFromCategoryName } from "../lib/types"

export interface SalaryDataRecord {
  categoryId: string
  categoryCode?: string
  categoryName: string
  biweeklyBaseSalary: number
  monthlyBaseSalary?: number
  conceptoTabular011?: number
  workdayHours: number
  effectiveFrom: string
  effectiveTo?: string
  salaryTableVersion: string
  sourceRecordId: string
}

/** Versión vigente del tabulador al 16-10-2025. */
export const SALARY_TABLE_VERSION = "salary-table-2025-2026"

/**
 * ID estable y determinista por categoría, derivado del nombre del catálogo.
 * Ejemplo: "TECNICO RADIOLOGO 80" -> "TECNICO_RADIOLOGO_80".
 */
export function stableCategoryId(categoryName: string): string {
  return categoryName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function buildRecordsFromTabulador(tab: TabuladorVersion): SalaryDataRecord[] {
  return tab.categorias.map((c) => ({
    categoryId: stableCategoryId(c.nombre),
    categoryName: c.nombre,
    categoryCode: c.nombre,
    workdayHours: deriveWorkdayHoursFromCategoryName(c.nombre) ?? 8,
    monthlyBaseSalary: c.baseMensual ?? c.sueldoQuincenal * 2,
    biweeklyBaseSalary: c.sueldoQuincenal,
    conceptoTabular011: c.concepto011,
    effectiveFrom: tab.effectiveFrom,
    effectiveTo: tab.effectiveTo,
    salaryTableVersion: tab.version,
    sourceRecordId: `${tab.version}:${c.nombre}`,
  }))
}

export const SALARY_DATA: SalaryDataRecord[] = TABULADORES_VERSIONADOS.flatMap((t) =>
  buildRecordsFromTabulador(t)
)

export const LEGACY_CATEGORY_ID_MAP: ReadonlyMap<string, string> = new Map(
  TABULADOR_VIGENTE_2025_2026.categorias.map((c, idx) => [
    String(idx + 1),
    stableCategoryId(c.nombre),
  ])
)

export function isRecordActiveAt(record: SalaryDataRecord, date: string): boolean {
  if (!record.effectiveFrom || record.effectiveFrom > date) return false
  if (record.effectiveTo && record.effectiveTo < date) return false
  return true
}
