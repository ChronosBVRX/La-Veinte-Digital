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

export const SALARY_DATA: SalaryDataRecord[] = [
  {
    categoryId: "1",
    categoryName: "ABOGADO 80",
    categoryCode: "ABG80",
    workdayHours: 8,
    monthlyBaseSalary: 7875.28,
    biweeklyBaseSalary: 3937.64,
    effectiveFrom: "2025-01-01",
    sourceRecordId: "built-in:abogado80",
  },
  {
    categoryId: "2",
    categoryName: "ENFERMERA 80",
    categoryCode: "ENF80",
    workdayHours: 8,
    monthlyBaseSalary: 7500.00,
    biweeklyBaseSalary: 3750.00,
    effectiveFrom: "2025-01-01",
    sourceRecordId: "built-in:enfermera80",
  },
  {
    categoryId: "3",
    categoryName: "MEDICO 80",
    categoryCode: "MED80",
    workdayHours: 8,
    monthlyBaseSalary: 12000.00,
    biweeklyBaseSalary: 6000.00,
    effectiveFrom: "2025-01-01",
    sourceRecordId: "built-in:medico80",
  },
  {
    categoryId: "4",
    categoryName: "TRABAJADOR SOCIAL 80",
    categoryCode: "TS80",
    workdayHours: 8,
    monthlyBaseSalary: 6800.00,
    biweeklyBaseSalary: 3400.00,
    effectiveFrom: "2025-01-01",
    sourceRecordId: "built-in:ts80",
  },
]
