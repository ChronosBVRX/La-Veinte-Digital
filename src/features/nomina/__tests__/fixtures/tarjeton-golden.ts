import type {
  EmployeePayrollProfile,
  PayPeriod,
  ResolvedSalaryCategory,
  SeniorityResult,
} from "../../lib/types"

/**
 * FIXTURE GOLDEN — TARJETÓN REAL 2A-AGO-2026 (verdad de terreno IMSS).
 *
 * Categoría 20570080 / TÉCNICO RADIÓLOGO 80 · Periodo 2A-AGO-2026 · 15 días
 * Antigüedad efectiva registrada: 14 años.
 *
 * BASE = 002 + 011 = 7,172.41
 *   022 = trunc2(7172.41 × 27.5%) = 1,972.41
 *   032 = trunc2(7172.41 × 24%)  = 1,721.37  (Math.round daría .38 ❌)
 *   033 = trunc2(7172.41 × 16%)  = 1,147.58  (Math.round daría .59 ❌)
 *   054 = trunc2(7172.41 × 20%)  = 1,434.48
 *   072 = trunc2(7172.41 × 5%)   =   358.62
 *
 * TOTAL PERCEPCIONES = $14,256.87 · DEDUCCIONES = $10,339.87 · LÍQUIDO = $3,917.00
 *
 * El motor en modo baseline DEBE reconstruir el total a centavo exacto.
 */

export const GOLDEN_PERIOD: PayPeriod = {
  id: "2026-08-Q2",
  year: 2026,
  month: 8,
  half: 2,
  startDate: "2026-08-16",
  endDate: "2026-08-31",
  label: "08/2026 2da quincena",
}

export const GOLDEN_CATEGORY: ResolvedSalaryCategory = {
  categoryId: "TECNICO_RADIOLOGO_80",
  categoryName: "TECNICO RADIOLOGO 80",
  categoryCode: "20570080",
  workdayHours: 8,
  monthlyBaseSalary: 7875.28,
  biweeklyBaseSalary: 3937.64,
  conceptoTabular011: 3234.77,
  effectiveFrom: "2025-01-01",
  salaryTableVersion: "salary-table-2025-2027",
  sourceRecordId: "golden:20570080-tecnico-radiologo-80",
}

export const GOLDEN_SENIORITY: SeniorityResult = {
  years: 14,
  months: 0,
  days: 0,
  totalDays: 5113,
  referenceDate: "2026-08-31",
  source: "confirmed_effective_date",
  warnings: [],
}

/** Importes impresos en el tarjetón real (tolerancia EXACTA a centavo). */
export const GOLDEN_EXPECTED_BASELINE = {
  concepts: {
    "002": 3937.64,
    "011": 3234.77,
    "020": 250.00,
    "022": 1972.41,
    "032": 1721.37,
    "033": 1147.58,
    "050": 200.00,
    "054": 1434.48,
    "072": 358.62,
  },
  totalPercepciones: 14256.87,
  totalDeducciones: 10339.87,
  liquido: 3917.00,
  /** Conceptos que NO deben aparecer como percepciones incluidas. */
  excluded: [] as string[],
}

export function buildGoldenProfile(): EmployeePayrollProfile {
  return {
    id: "golden-real-1",
    userId: "golden-user",
    consentGiven: true,
    employmentType: "base",
    categoryId: GOLDEN_CATEGORY.categoryId,
    categoryName: GOLDEN_CATEGORY.categoryName,
    workdayHours: 8,
    shift: "matutino",
    occupationalConditions: [],
    displayedSeniorityAtLastPayslip: {
      years: 14, months: 0, days: 0,
      referenceDate: "2026-08-31",
    },
    facts: [
      { key: "concept_054_on_payslip", value: true, source: "last_payslip", confidence: 0.9, updatedAt: "2026-08-25" },
      { key: "concept_072_on_payslip", value: true, source: "last_payslip", confidence: 0.9, updatedAt: "2026-08-25" },
    ],
    siapConceptMarks: [],
    recurringConcepts: [
      { conceptCode: "002", appearsNormally: true,  lastAmount: 3937.64, source: "last_payslip", firstSeenAt: "2026-08-31", lastSeenAt: "2026-08-31", confirmed: true, occurrenceType: "recurring", eligibilityPersistence: "persistent" },
      { conceptCode: "011", appearsNormally: true,  lastAmount: 3234.77, source: "last_payslip", firstSeenAt: "2026-08-31", lastSeenAt: "2026-08-31", confirmed: true, occurrenceType: "recurring", eligibilityPersistence: "persistent" },
      { conceptCode: "020", appearsNormally: true,  lastAmount: 250.00,  source: "last_payslip", firstSeenAt: "2026-08-31", lastSeenAt: "2026-08-31", confirmed: true, occurrenceType: "recurring", eligibilityPersistence: "persistent" },
      { conceptCode: "022", appearsNormally: false, lastAmount: 1972.41, source: "last_payslip", firstSeenAt: "2026-08-31", lastSeenAt: "2026-08-31", confirmed: true, occurrenceType: "periodic", eligibilityPersistence: "period_scoped" },
      { conceptCode: "032", appearsNormally: true,  lastAmount: 1721.37, source: "last_payslip", firstSeenAt: "2026-08-31", lastSeenAt: "2026-08-31", confirmed: true, occurrenceType: "variable", eligibilityPersistence: "until_changed" },
      { conceptCode: "033", appearsNormally: true,  lastAmount: 1147.58, source: "last_payslip", firstSeenAt: "2026-08-31", lastSeenAt: "2026-08-31", confirmed: true, occurrenceType: "variable", eligibilityPersistence: "until_changed" },
      { conceptCode: "050", appearsNormally: true,  lastAmount: 200.00,  source: "last_payslip", firstSeenAt: "2026-08-31", lastSeenAt: "2026-08-31", confirmed: true, occurrenceType: "recurring", eligibilityPersistence: "persistent" },
      { conceptCode: "054", appearsNormally: true,  lastAmount: 1434.48, source: "last_payslip", firstSeenAt: "2026-08-31", lastSeenAt: "2026-08-31", confirmed: true, occurrenceType: "variable", eligibilityPersistence: "until_changed" },
      { conceptCode: "072", appearsNormally: true,  lastAmount: 358.62,  source: "last_payslip", firstSeenAt: "2026-08-31", lastSeenAt: "2026-08-31", confirmed: true, occurrenceType: "variable", eligibilityPersistence: "until_changed" },
    ],
    createdAt: "2026-08-25",
    updatedAt: "2026-08-25",
  }
}

/** Perturbación: cambio de categoría (mismo periodo) → descendientes recalculados. */
export const GOLDEN_PERTURBATION_CATEGORY = {
  category: {
    categoryId: "PSICOLOGO_CLINICO_80",
    categoryName: "PSICOLOGO CLINICO 80",
    workdayHours: 8,
    biweeklyBaseSalary: 4500,
    conceptoTabular011: 3696.75,
  } as Partial<ResolvedSalaryCategory>,
  /** Base nueva: 4500 + 3696.75 = 8196.75. Todos los derivados recalculan con truncamiento. */
  mustRecompute: {
    "002": 4500,
    "011": 3696.75,
    "022": Math.floor((4500 + 3696.75) * 0.275 * 100) / 100, // 2254.10
    "032": Math.floor((4500 + 3696.75) * 0.24 * 100) / 100,  // 1967.22
    "033": Math.floor((4500 + 3696.75) * 0.16 * 100) / 100,  // 1311.48
    "054": Math.floor((4500 + 3696.75) * 0.20 * 100) / 100,  // 1639.35
    // Psicólogo Clínico tiene 15% en Apéndice F Tabla 07:
    "072": Math.floor((4500 + 3696.75) * 0.15 * 100) / 100,  // 1229.51
  } as Record<string, number>,
  mustStayFixed: { "020": 250, "050": 200 } as Record<string, number>,
}

/**
 * Regresión de ventana del 055: ancla sintética de julio (hipotética) debe
 * valer CERO en agosto. Se usa perfil clonado porque el tarjetón real es de
 * agosto y no trae Fondo de Ahorro.
 */
export const GOLDEN_PERTURBATION_JULY_ANCHOR = {
  julyPeriod: {
    id: "2026-07-Q2", year: 2026, month: 7, half: 2,
    startDate: "2026-07-16", endDate: "2026-07-31", label: "07/2026 2da quincena",
  } as PayPeriod,
  syntheticAnchor: { code: "055", amount: 13800.00 },
  augustPeriod: GOLDEN_PERIOD,
}
