import type { PayrollFactKey } from "../lib/types"

export interface EligibilityDefinition {
  allowedCategoryIds?: string[]
  allowedCategoryPatterns?: string[]
  allowedEmploymentTypes?: string[]
  allowedWorkdayCodes?: string[]
  allowedRegions?: string[]
  allowedServiceCodes?: string[]
  requiredFacts?: PayrollFactKey[]
  incompatibleConcepts?: string[]
  requiresAuthorizedCategoryTable?: boolean
}

export const CONCEPT_ELIGIBILITY: Record<string, EligibilityDefinition> = {
  "02": {
    requiredFacts: ["concept_02_on_payslip"],
    incompatibleConcepts: [],
  },
  "012": {
    allowedEmploymentTypes: ["base"],
    requiredFacts: ["has_discontinuous_schedule", "discontinuous_schedule_in_appointment"],
    incompatibleConcepts: ["013", "057"],
  },
  "013": {
    requiredFacts: ["concept_013_on_payslip"],
    incompatibleConcepts: ["012"],
    requiresAuthorizedCategoryTable: true,
  },
  "051": {
    requiredFacts: ["participates_in_transplant_program"],
    incompatibleConcepts: [],
  },
  "054": {
    requiredFacts: ["permanent_radiation_exposure"],
    incompatibleConcepts: [],
  },
  "057": {
    requiredFacts: ["concept_057_on_payslip"],
    incompatibleConcepts: ["012"],
  },
  "058": {
    allowedEmploymentTypes: ["base", "confianza"],
    requiredFacts: ["participates_in_teaching"],
    incompatibleConcepts: [],
  },
  "061": {
    requiredFacts: ["performs_patient_transport"],
    incompatibleConcepts: [],
  },
  "062": {
    requiredFacts: ["concept_062_on_payslip"],
    incompatibleConcepts: [],
    requiresAuthorizedCategoryTable: true,
  },
  "072": {
    requiredFacts: ["concept_072_on_payslip"],
    incompatibleConcepts: ["062"],
  },
  "078": {
    requiredFacts: ["performs_academic_activities"],
    incompatibleConcepts: [],
  },
  "083": {
    requiredFacts: ["has_professional_degree", "has_professional_license"],
    incompatibleConcepts: [],
  },
}
