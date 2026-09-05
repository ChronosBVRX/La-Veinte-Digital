export type EmploymentType =
  | "base"
  | "sustituto"
  | "interino"
  | "obra_determinada"
  | "confianza"
  | "otro"

export type Shift =
  | "matutino"
  | "vespertino"
  | "nocturno"
  | "jornada_acumulada"
  | "mixto"

export type JornadaHoras = 6 | 6.5 | 8 | 12

const VALID_JORNADAS: JornadaHoras[] = [6, 6.5, 8, 12]

export function deriveWorkdayHoursFromCategoryName(categoryName: string): JornadaHoras | null {
  const match = categoryName.trim().match(/(\d+)\s*$/)
  if (!match) return null
  const suffix = parseInt(match[1], 10)
  const hours = suffix / 10
  return VALID_JORNADAS.includes(hours as JornadaHoras) ? (hours as JornadaHoras) : null
}

export type OccupationalConditionType =
  | "radiation_non_medical"
  | "radiation_medical"
  | "infectious_medical"
  | "infectious_non_medical"
  | "nursing"
  | "teaching_nursing"
  | "high_cost_of_living"
  | "discontinuous_schedule"
  | "other"

export interface OccupationalCondition {
  type: OccupationalConditionType
  enabled: boolean
  permanentExposure?: boolean
  effectiveFrom?: string
  effectiveTo?: string
  yearsInCondition?: number
  notes?: string
}

export interface RecurringConceptOverride {
  code: string
  include: boolean
  amount?: number
  source: "last_payslip" | "manual" | "calculated"
  confirmed: boolean
}

export type PayrollFactKey =
  | "has_discontinuous_schedule"
  | "discontinuous_schedule_in_appointment"
  | "performs_academic_activities"
  | "participates_in_teaching"
  | "participates_in_research"
  | "participates_in_transplant_program"
  | "works_in_emergency_transport"
  | "performs_patient_transport"
  | "permanent_radiation_exposure"
  | "has_professional_degree"
  | "has_professional_license"
  | "concept_02_on_payslip"
  | "concept_012_on_payslip"
  | "concept_013_on_payslip"
  | "concept_051_on_payslip"
  | "concept_054_on_payslip"
  | "concept_057_on_payslip"
  | "concept_058_on_payslip"
  | "concept_061_on_payslip"
  | "concept_062_on_payslip"
  | "concept_072_on_payslip"
  | "concept_078_on_payslip"
  | "concept_083_on_payslip"

export type PayrollFactValue = boolean | string | number | null

export interface PayrollFact {
  key: PayrollFactKey
  value: PayrollFactValue
  source: "profile" | "last_payslip" | "multiple_payslips" | "user" | "appointment_document" | "catalog" | "calculated"
  confidence: number
  effectiveFrom?: string
  effectiveTo?: string
  updatedAt: string
}

export interface SiapConceptMark {
  conceptCode: string
  status: "confirmed" | "user_reported" | "inferred_from_payslip" | "unknown" | "not_authorized" | "expired"
  effectiveFrom?: string
  effectiveTo?: string
  source: "siap" | "last_payslip" | "appointment_document" | "user"
}

export interface RecurringConceptEvidence {
  conceptCode: string
  appearsNormally: boolean | null
  lastAmount?: number
  source: "last_payslip" | "multiple_payslips" | "appointment_document" | "user"
  firstSeenAt?: string
  lastSeenAt?: string
  confirmed: boolean
  /** Tipo de ocurrencia: solo 'recurring' y 'variable' se proyectan automáticamente. */
  occurrenceType: ConceptOccurrenceType
  /** Hasta cuándo se asume que el trabajador mantiene la elegibilidad. */
  eligibilityPersistence: EligibilityPersistence
}

export interface ResolvedProfileCategory {
  categoryId: string
  categoryCode?: string
  categoryName: string
  workdayCode?: string
  workdayHours: number
  catalogSourceId: string
  resolvedAt: string
  resolutionMethod: "id" | "code" | "exact_name" | "alias" | "fuzzy" | "manual"
}

export interface EmployeePayrollProfile {
  id: string
  userId: string
  consentGiven: boolean
  consentDate?: string

  categoryId?: string
  categoryName?: string
  categoryCode?: string
  workdayCode?: string
  workdayHours: JornadaHoras
  shift?: Shift

  employmentType: EmploymentType

  ooad?: string
  region?: string
  unitCode?: string
  unitName?: string
  serviceCode?: string
  serviceName?: string
  positionCode?: string
  responsibilityArea?: string

  institutionalEntryDate?: string
  effectiveSeniorityDate?: string

  displayedSeniorityAtLastPayslip?: {
    years: number
    months: number
    days: number
    /** Fecha de referencia del tarjetón; puede faltar en datos antiguos. */
    referenceDate?: string
  }

  professionalCredentials?: {
    hasProfessionalDegree: boolean | null
    hasProfessionalLicense: boolean | null
    confirmedByUser: boolean
    effectiveFrom?: string
  }

  occupationalConditions: OccupationalCondition[]
  facts: PayrollFact[]
  siapConceptMarks: SiapConceptMark[]
  recurringConcepts: RecurringConceptEvidence[]
  recurringConceptOverrides?: RecurringConceptOverride[]

  /**
   * Unidades computables del Fondo de Ahorro (055) en el periodo anual
   * (1 jul – 30 jun), base de 360 días. Solo se escribe cuando hay un valor
   * confirmado (tarjetón/captura); su ausencia activa el supuesto de 360.
   */
  fondoAhorro?: {
    unidades?: number
    regime?: "ordinario" | "confianza_a"
    unitsConfirmed?: boolean
  }

  lastPayslipId?: string

  createdAt: string
  updatedAt: string
}

export interface SeniorityResult {
  years: number
  months: number
  days: number
  totalDays: number
  referenceDate: string
  source: "confirmed_effective_date" | "reconstructed_from_payslip" | "institutional_entry_date"
  warnings: string[]
}

export interface PayPeriod {
  id: string
  year: number
  month: number
  half: 1 | 2
  startDate: string
  endDate: string
  paymentDate?: string
  label: string
}

export interface ResolvedSalaryCategory {
  categoryId: string
  categoryName: string
  categoryCode?: string
  workdayHours?: number
  monthlyBaseSalary?: number
  biweeklyBaseSalary: number
  /** Valor tabular del concepto 011 según el catálogo oficial (Cláusula 63 Bis, inciso b). */
  conceptoTabular011?: number
  effectiveFrom?: string
  effectiveTo?: string
  salaryTableVersion?: string
  sourceRecordId: string
}

export type PayrollConceptType = "earning" | "deduction"
export type PayrollConceptNature =
  | "base"
  | "fixed"
  | "derived"
  | "seniority_based"
  | "incident_based"
  | "periodic"
  | "extraordinary"
  | "loan"
  | "tax"
  | "manual"

export type RuleVerificationStatus =
  | "contract_verified"
  | "regulation_verified"
  | "institutional_catalog_verified"
  | "empirically_verified"
  | "app_reconstructed"
  | "pending_validation"

export type ConceptNature = "base" | "fixed" | "derived" | "seniority_based" | "incident_based" | "periodic" | "extraordinary" | "manual"

export type MathematicalStatus = "calculated" | "missing_base" | "formula_pending_validation"
export type EligibilityStatus = "confirmed" | "probable" | "requires_answer" | "not_eligible" | "insufficient_data"
export type AdministrativeStatus = "confirmed" | "confirmed_from_payslip" | "user_reported" | "unknown" | "not_authorized" | "expired"

export interface ConceptEvaluationStatus {
  mathematicalStatus: MathematicalStatus
  eligibilityStatus: EligibilityStatus
  administrativeStatus: AdministrativeStatus
}

export interface LegalBasis {
  source: "CCT" | "regulation" | "salary_table" | "institutional_catalog" | "reconstructed_application" | "user_confirmation"
  title: string
  reference: string
  version?: string
  effectiveFrom?: string
  effectiveTo?: string
  notes?: string
}

export interface PayrollConceptDefinition {
  code: string
  name: string
  type: PayrollConceptType
  nature: PayrollConceptNature
  dependencies: string[]
  ruleId?: string
  frequency: "biweekly" | "monthly" | "annual" | "eventual" | "conditional"
  verificationStatus: RuleVerificationStatus
  enabled: boolean
  legalBasis?: LegalBasis[]
}

export interface CalculationStep {
  label: string
  expression: string
  value: number
}

export interface CalculatedPayrollConcept {
  code: string
  name: string
  type: PayrollConceptType
  nature: PayrollConceptNature
  amount: number
  included: boolean
  source: "salary_table" | "contract_rule" | "regulation_rule" | "last_payslip" | "user_input" | "estimated_tax" | "reconstructed_rule"
  confidence: "high" | "medium" | "low" | "requires_confirmation"
  verificationStatus: RuleVerificationStatus
  evaluationStatus?: ConceptEvaluationStatus
  dependencies: { code: string; amount: number }[]
  calculationSteps: CalculationStep[]
  legalBasis: LegalBasis[]
  warnings: string[]
  /** Importe comprobado del último tarjetón real (ancla). */
  anchorAmount?: number
  /** Fecha de la última evidencia del tarjetón para este concepto. */
  anchorDate?: string
  /** Origen de la elegibilidad del concepto. */
  elegibilitySource: "payslip_confirmed" | "contract_rule" | "tabular_value" | "user_reported" | "formula_deduced" | "unknown"
  /** Auditoría de la decisión ancla-vs-fórmula (presente si hubo ancla). */
  resolutionAudit?: ResolutionAudit
}

/** Par de anclaje: importe comprobado + fecha de evidencia. */
export interface ConceptAnchor {
  amount: number
  date: string
  /** Tipo de ocurrencia del concepto en el tarjetón. */
  occurrenceType: ConceptOccurrenceType
  /** Hasta cuándo se asume que el trabajador mantiene la elegibilidad. */
  eligibilityPersistence: EligibilityPersistence
  /** Id del periodo quincenal del tarjetón (opcional; si falta se usa `date`). */
  sourcePeriodId?: string
}

/** Clasifica la frecuencia con que un concepto aparece en el tarjetón. */
export type ConceptOccurrenceType =
  | "recurring"   // aparece siempre (002, 011, 020, 050, 023, 063)
  | "periodic"    // solo en periodos específicos (022 anual, 055 julio)
  | "variable"    // aparece regularmente pero el importe varía con la base (054, 072, etc.)
  | "one_time"    // apareció una sola vez, no debe reaparecer automáticamente
  | "unknown"     // sin clasificar

/** Define hasta cuándo se asume que el trabajador mantiene la elegibilidad. */
export type EligibilityPersistence =
  | "persistent"     // derecho permanente (002, 011, 020)
  | "until_changed"  // mantiene mientras no haya evidencia de cambio (054, 072, etc.)
  | "period_scoped"  // solo en el periodo específico (055 julio, 022 anual)
  | "event_scoped"   // condicionado a un hecho con vigencia limitada (incidencias)

/**
 * Define si el IMPORTE histórico del tarjetón puede reutilizarse en una
 * proyección, separado de la persistencia de la ELEGIBILIDAD.
 *
 * - `replay_only`: el ancla solo puede reproducirse en `baseline` sobre el
 *   mismo periodo. En cualquier otro caso el importe debe recalcularse con la
 *   fórmula vigente; el ancla queda como evidencia de verificación.
 * - `while_dependencies_unchanged`: si las dependencias coinciden a centavos
 *   con el tarjetón de referencia, el importe comprobado se conserva (los
 *   mismos insumos produjeron ese importe REAL); con dependencias cambiadas
 *   o desconocidas se recalcula.
 */
export type ValuePersistence =
  | "replay_only"
  | "while_dependencies_unchanged"

/** Fuente del importe seleccionado tras resolver ancla vs fórmula. */
export type ResolutionSelectedSource = "anchor" | "formula" | "zero"

/**
 * Auditoría de resolución de un concepto: explica por qué el importe
 * proyectado es el que es (ancla vs fórmula), con el estado de las
 * dependencias y la razón de la decisión.
 */
export interface ResolutionAudit {
  ruleId?: string
  conceptCode: string
  targetPeriodId: string
  targetPeriodLabel?: string
  hadAnchor: boolean
  anchorValue?: number
  anchorDate?: string
  /** true si el ancla pertenece al MISMO periodo que se proyecta. */
  anchorInTargetPeriod: boolean
  /** Elegibilidad evaluada con evidencia ACTUAL, independiente del ancla. */
  eligibleNow: boolean
  dependencyStatus: "unchanged" | "changed" | "unknown" | "none"
  formulaComputable: boolean
  formulaValue: number
  valuePersistence: ValuePersistence
  selectedValue: number
  selectedSource: ResolutionSelectedSource
  /** Razón legible de la decisión (códigos estables para tests). */
  reason: string
}

/**
 * Instantánea del estado de referencia (último tarjetón) usada para detectar
 * si las causas externas cambiaron entre el baseline y la proyección.
 *
 * No almacena importes (eso es `conceptAnchors`); almacena las causas
 * verificables que determinan si un concepto debe recalcularse.
 */
export interface PayrollReferenceSnapshot {
  /** Fecha de referencia del último tarjetón. */
  date: string
  /** Categoría en el momento del tarjetón. */
  categoryId: string
  /** Antigüedad comprobada en el momento del tarjetón. */
  seniority: {
    years: number
    months: number
    days: number
  }
  /** Versión de la tabla salarial vigente en el momento del tarjetón. */
  salaryTableVersion?: string
  /** Versiones de tablas de importes fijos en el momento del tarjetón. */
  fixedTableVersions: Record<string, string>
}

export interface PayrollRuleContext {
  profile: EmployeePayrollProfile
  category: ResolvedSalaryCategory
  period: PayPeriod
  seniority: SeniorityResult
  incidents: PayrollIncident[]
  confirmedRecurringConcepts: RecurringConceptOverride[]
  calculatedConcepts: ReadonlyMap<string, CalculatedPayrollConcept>
  /** Anclas de importe comprobado del último tarjetón real. */
  conceptAnchors: ReadonlyMap<string, ConceptAnchor>
  /** Modo de cálculo: baseline reproduce el tarjetón real; projection proyecta hacia adelante. */
  mode: ProjectionMode
  /** Instantánea del estado de referencia para comparar causas externas. */
  referenceSnapshot?: PayrollReferenceSnapshot
  /**
   * Cierre transitivo de dependencias por regla (id → dependencias indirectas
   * incluidas las especiales `seniority` / `fixedTable:*`). Permite que
   * `dependenciesStatus` detecte cambios en toda la cadena causal, no solo en
   * los padres directos.
   */
  dependencyClosure?: ReadonlyMap<string, ReadonlySet<string>>
}

export interface RuleCalculationResult {
  concept: CalculatedPayrollConcept
  dependencies: string[]
}

export interface PayrollRule {
  id: string
  version: string
  effectiveFrom: string
  effectiveTo?: string
  dependencies: string[]
  /**
   * Política de reutilización del importe histórico del tarjetón.
   * Default: `"replay_only"` (la fórmula vigente recalcula siempre que pueda).
   */
  valuePersistence?: ValuePersistence
  calculate: (context: PayrollRuleContext) => RuleCalculationResult
}

export type PayrollIncidentType =
  | "absence"
  | "delay"
  | "overtime"
  | "weekly_rest_work"
  | "mandatory_rest_work"
  | "vacation"
  | "paid_leave"
  | "unpaid_leave"
  | "medical_leave"
  | "maternity_leave"
  | "temporary_category"
  | "shift_change"
  | "manual_adjustment"

export interface PayrollIncident {
  id: string
  type: PayrollIncidentType
  dateFrom: string
  dateTo?: string
  hours?: number
  days?: number
  amount?: number
  notes?: string
  confirmed: boolean
}

export interface OvertimeIncident {
  date: string
  hours: number
  dayType: "ordinary" | "weekly_rest" | "mandatory_rest" | "weekly_and_mandatory_rest"
  authorized: boolean
}

export type AnalysisStatus = "pending" | "analyzing" | "persisting" | "ready" | "partial" | "error"

export interface ImportedPayslip {
  id: string
  userId: string
  period: PayPeriod | string
  periodRaw?: string
  categoryId?: string
  categoryName?: string
  institutionalEntryDate?: string
  displayedSeniority?: { years: number; months: number; days: number }
  earnings: ImportedPayslipLine[]
  deductions: ImportedPayslipLine[]
  perceptions?: ImportedPayslipLine[]
  totalEarnings: number
  totalDeductions: number
  netPay: number
  netAmount?: number
  source: "manual" | "image" | "pdf" | "structured_import"
  confirmedByUser: boolean
  analysisStatus?: AnalysisStatus
}

export interface ImportedPayslipLine {
  code: string
  description: string
  amount: number
  suggestedNature?: PayrollConceptNature
  confirmedNature?: PayrollConceptNature
  includeInNextProjection?: boolean
  confirmedByUser: boolean
}

export interface ProjectionTotals {
  confirmedEarnings: number
  probableEarnings: number
  conditionalPotentialEarnings: number
  confirmedDeductions: number
  estimatedDeductions: number
  confirmedGross: number
  probableGross: number
  possibleGross: number
  confirmedNet?: number
  estimatedNetRange?: { minimum: number; maximum: number }
}

export type ProjectionMode = "strict" | "assisted" | "exploratory" | "baseline"

export interface PayrollProjection {
  id: string
  userId: string
  generatedAt: string
  period: PayPeriod
  category: ResolvedSalaryCategory
  seniorityAtPeriodEnd: SeniorityResult
  earnings: CalculatedPayrollConcept[]
  deductions: CalculatedPayrollConcept[]
  probableConcepts: CalculatedPayrollConcept[]
  conditionalConcepts: CalculatedPayrollConcept[]
  excludedConcepts: CalculatedPayrollConcept[]
  totals: ProjectionTotals
  totalEarnings: number
  totalDeductions: number
  estimatedNet: number
  confidence: "high" | "medium" | "low"
  warnings: string[]
  unresolvedConcepts: string[]
  requiredConfirmations: string[]
  mode: ProjectionMode
  snapshot?: PayrollProjectionSnapshot
}

export interface PayrollProjectionSnapshot {
  salaryTableVersion?: string
  categorySnapshot: ResolvedSalaryCategory
  ruleVersions: Record<string, string>
  profileSnapshot: Partial<EmployeePayrollProfile>
}

export interface ProjectionComparison {
  projectionId: string
  actualPayslipId: string
  projectedNet: number
  actualNet: number
  difference: number
  percentageDifference?: number
  conceptDifferences: { code: string; projected?: number; actual?: number; difference: number }[]
  observations: string[]
}

export interface CalculatorPrefillData {
  categoryId?: string
  categoryName?: string
  concept002?: number
  concept011?: number
  concept020?: number
  concept022?: number
  concept023?: number
  concept050?: number
  concept054?: number
  concept063?: number
  workdayHours?: number
  effectiveSeniorityDate?: string
  seniorityYears?: number
  daysWorkedInAnnualPeriod?: number
}

export interface SalaryPeriodSegment {
  startDate: string
  endDate: string
  concept002: number
  concept011: number
  computableDays: number
}

export interface SalaryHistoryEntry {
  categoryId: string
  effectiveFrom: string
  effectiveTo?: string
  concept002: number
  calculatedConcept011?: number
}

/**
 * Tabla contractual de DÍAS por antigüedad (Cláusula 63 Bis, inciso c) —
 * FUENTE DEL FACTOR quincenal del concepto 022:
 *
 *   022 = trunc2(base × días(años cumplidos) ÷ 360)
 *
 * Calibrada con el tarjetón real 2A-AGO-2026: 14 años → 99 días → factor
 * 0.2750000 → $1,972.41 sobre base 7,172.41. El crecimiento NO es lineal
 * (15a=105d, 16a=114d): usar la tabla, jamás progresiones derivadas ni el
 * máximo (270) como fallback para entradas ausentes (>40 años exige
 * confirmación). La lectura anual lump-sum previa permanece como legado en
 * `lib/old-rules.ts`.
 */
export const CLAUSE_63_BIS_C_DAYS: Record<number, number> = {
  5: 60, 6: 63, 7: 66, 8: 69, 9: 72, 10: 75,
  11: 81, 12: 87, 13: 93, 14: 99, 15: 105,
  16: 114, 17: 123, 18: 132, 19: 141, 20: 150,
  21: 156, 22: 162, 23: 168, 24: 174, 25: 180,
  26: 186, 27: 192, 28: 198, 29: 204, 30: 210,
  31: 216, 32: 222, 33: 228, 34: 234, 35: 240,
  36: 246, 37: 252, 38: 258, 39: 264, 40: 270,
}
