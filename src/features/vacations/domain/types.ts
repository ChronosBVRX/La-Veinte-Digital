export type ContractType =
  | "BASE"
  | "CONFIANZA_B"
  | "CONFIANZA"
  | "CONFIANZA_A_ESTATUTO"
  | "TEMPORAL"
  | "SUSTITUTO"
  | "MEDICO_RESIDENTE"
  | "BECADO"
  | "OTRO";

export type VacationRegime =
  | "SEMESTRAL"
  | "CUATRIMESTRAL"
  | "EXTRAORDINARIO_V20"
  | "ESTATUTO";

export type WorkScheduleType =
  | "ORDINARY"
  | "ACCUMULATED_WEEKEND_DAY"
  | "ACCUMULATED_NIGHT"
  | "ROTATING"
  | "CUSTOM";

export type SemestralContinuity = 0 | 1 | 2 | 3 | 4 | 6 | 9 | 13;
export type SemestralInclusionMark = 0 | 1 | 2 | 3 | 4 | 9;

export type CuatrimestralContinuity = 0 | 1 | 2 | 3 | 4 | 9 | 14;
export type CuatrimestralInclusionMark = 0 | 2 | 5;

export type V20InclusionMark = 0 | 6 | 7 | 8;
export type V20Continuity = 0 | 1 | 2 | 3;

export type VacationStage =
  | "FULL_OR_CLOSED_OPTION"
  | "FIRST_FRACTION"
  | "SECOND_FRACTION"
  | "FIRST_COMPLETE_PERIOD"
  | "SECOND_COMPLETE_PERIOD"
  | "FIRST_FRACTION_4_9"
  | "SECOND_FRACTION_4_9"
  | "FIRST_FRACTION_9_4"
  | "SECOND_FRACTION_9_4"
  | "CERRADO"
  | "CUATRIMESTRAL_SEQUENCE_A"
  | "CUATRIMESTRAL_SEQUENCE_B";

export interface EffectiveSeniority {
  years: number;
  fortnights: number;
  days: number;
  asOfDate?: string;
  precision?: "EXACT" | "CALCULATED" | "APPROXIMATE" | "FROM_TARJETON";
}

export interface WorkerProfile {
  fullName?: string;
  matricula?: string;
  contractType: ContractType;
  category?: string;
  categoryCode?: string;
  workScheduleType?: WorkScheduleType;
  shift?: string;
  adscription?: string;
  unit?: string;
  service?: string;
  entryDate?: string;
  effectiveSeniority: EffectiveSeniority;
  radiologicalExposure?: boolean | "UNSURE";
  weeklyRestDays: number[];
  contractEndDate?: string;
}

export interface AnticipationResult {
  allowed: boolean;
  dueDate: string;
  earliestAllowedDate: string;
  requestedDate: string;
  daysInAdvance: number;
  reasonCode?: string;
  friendlyMessage: string;
}

export interface VacationDateCalculationInput {
  startDate: string;
  entitlementUnits: number;
  unitType: "WORKDAY" | "JOURNEY" | "VELADA";
  weeklyRestDays: number[];
  mandatoryRestDates: string[];
  workSchedule: WorkScheduleDefinition;
}

export interface WorkScheduleDefinition {
  type: WorkScheduleType;
  workingDays?: number[];
  customSchedule?: string[];
}

export interface VacationDateCalculationResult {
  startDate: string;
  lastVacationDate: string;
  returnToWorkDate: string;
  consumedDates: string[];
  excludedWeeklyRestDates: string[];
  excludedMandatoryRestDates: string[];
  totalCalendarDays: number;
  totalVacationUnits: number;
  truncated: boolean;
}

export interface SemestralTransition {
  currentContinuity: number[];
  inclusionMark: SemestralInclusionMark;
  stage: VacationStage;
  nextContinuity: SemestralContinuity;
  upoIncrement: number;
}

export interface CuatrimestralStep {
  periodIndex: number;
  inclusionMark: CuatrimestralInclusionMark;
  nextContinuity: CuatrimestralContinuity;
  option: "A" | "B";
}

export interface SavedVacationSimulation {
  id: string;
  userId: string;
  calendarId: string;
  ruleVersionId: string;
  inputSnapshot: unknown;
  resultSnapshot: unknown;
  status: "DRAFT" | "COMPLETED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface VacationRule {
  id: string;
  code: string;
  regime: VacationRegime;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceDocument: string;
  sourceReference: string;
  priority: number;
  configuration: unknown;
  enabled: boolean;
}

export interface RuleTrace {
  ruleCode: string;
  result: "APPLIED" | "SKIPPED" | "BLOCKED" | "WARNING";
  input: unknown;
  output?: unknown;
  explanation: string;
}

export interface AnnualVacationCalendar {
  id: string;
  year: number;
  version: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sourceName: string;
  sourceDate?: string;
  publishedAt?: string;
  roles: VacationRole[];
}

export interface VacationRole {
  id: string;
  roleNumber: number;
  startDate: string;
  label?: string;
  enabled: boolean;
}

export interface NormativeConflict {
  requiresReview: boolean;
  sources: string[];
  description: string;
  cctValue?: number;
  administrativeValue?: number;
}

export interface VacationSimulationInput {
  workerProfile: WorkerProfile;
  regime: VacationRegime;
  continuityMark: number;
  nextPeriodNumber: number;
  dueDate: string;
  expiredVacationPeriods: number;
  enjoyedVacationDays: number;
  totalYearVacationDays: number;
  periodToEnjoy: number;
  calendarId: string;
  selectedInclusionMark?: number;
  selectedStartDate?: string;
  vacationStage?: VacationStage;
}

export interface VacationSimulationResult {
  /**
   * "BLOCKED" cuando la inclusión propuesta no es compatible con la marca de
   * continuidad actual: no se producen datos aparentes (unidades, UPO, fechas)
   * y solo se reportan las opciones compatibles.
   */
  status: "COMPUTED" | "BLOCKED";
  regime: VacationRegime;
  periodNumber: number;
  startDate?: string;
  endDate?: string;
  returnDate?: string;
  unitsUsed?: number;
  unitType: "WORKDAY" | "JOURNEY" | "VELADA";
  originalContinuityMark: number;
  proposedInclusionMark: number;
  resultingContinuityMark?: number;
  affectedUPO?: number;
  dueDate: string;
  anticipationDays: number;
  requiresSpecialProcess: boolean;
  requiresNormativeReview: boolean;
  normativeConflicts: NormativeConflict[];
  warnings: string[];
  traces: RuleTrace[];
  calendarVersion: string;
  ruleVersionId: string;
  compatibleOptions?: string[];
  anticipationResult?: AnticipationResult;
}
