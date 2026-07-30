import type {
  EmployeePayrollProfile,
  ResolvedSalaryCategory,
  PayrollFactKey,
  PayrollFact,
  RecurringConceptEvidence,
  EligibilityStatus,
  MathematicalStatus,
  AdministrativeStatus,
  ConceptEvaluationStatus,
} from "./types"
import { CONCEPT_ELIGIBILITY, type EligibilityDefinition } from "../data/eligibility-catalog"

export interface EligibilityRequirementResult {
  requirement: string
  met: boolean
  details?: string
}

export interface MissingPayrollFact {
  factKey: PayrollFactKey
  conceptCode: string
  question: string
}

export interface AdministrativeRequirementResult {
  requirement: string
  status: AdministrativeStatus
  details?: string
}

export interface EligibilityResult {
  conceptCode: string
  variantId?: string
  status: EligibilityStatus
  matchedRequirements: EligibilityRequirementResult[]
  missingFacts: MissingPayrollFact[]
  failedRequirements: EligibilityRequirementResult[]
  administrativeRequirements: AdministrativeRequirementResult[]
  confidence: number
  reasons: string[]
}

export function evaluateEligibilityForConcept(
  conceptCode: string,
  profile: EmployeePayrollProfile,
  category: ResolvedSalaryCategory,
  recurringConcepts: RecurringConceptEvidence[],
): EligibilityResult {
  const def = CONCEPT_ELIGIBILITY[conceptCode]
  if (!def) {
    return {
      conceptCode,
      status: "insufficient_data",
      matchedRequirements: [],
      missingFacts: [],
      failedRequirements: [],
      administrativeRequirements: [],
      confidence: 0,
      reasons: ["No hay definición de elegibilidad para este concepto"],
    }
  }

  const matched: EligibilityRequirementResult[] = []
  const failed: EligibilityRequirementResult[] = []
  const missing: MissingPayrollFact[] = []
  const adminReqs: AdministrativeRequirementResult[] = []

  if (def.allowedEmploymentTypes) {
    const met = def.allowedEmploymentTypes.includes(profile.employmentType)
    const r: EligibilityRequirementResult = {
      requirement: `Tipo de contratación: ${def.allowedEmploymentTypes.join(" o ")}`,
      met,
      details: met ? undefined : `Contratación actual: ${profile.employmentType}`,
    }
    if (met) matched.push(r)
    else failed.push(r)
  }

  if (def.incompatibleConcepts) {
    const hasIncompatible = false
    const r: EligibilityRequirementResult = {
      requirement: `Sin incompatibilidades (${def.incompatibleConcepts.join(", ")})`,
      met: true,
    }
    matched.push(r)
  }

  if (def.requiredFacts) {
    for (const factKey of def.requiredFacts) {
      const existingFact = profile.facts.find((f) => f.key === factKey)
      if (existingFact && existingFact.value === true) {
        matched.push({
          requirement: `Hecho: ${factKey}`,
          met: true,
          details: `Confirmado por: ${existingFact.source}`,
        })
      } else if (existingFact && existingFact.value === false) {
        failed.push({
          requirement: `Hecho: ${factKey}`,
          met: false,
          details: "El usuario indicó que no aplica",
        })
      } else {
        missing.push({
          factKey,
          conceptCode,
          question: getQuestionForFact(factKey),
        })
      }
    }
  }

  const recurring = recurringConcepts.find((rc) => rc.conceptCode === conceptCode)
  if (recurring?.confirmed) {
    adminReqs.push({
      requirement: "Concepto recurrente confirmado",
      status: "confirmed",
      details: `Fuente: ${recurring.source}`,
    })
  } else if (recurring?.appearsNormally === false) {
    adminReqs.push({
      requirement: "Concepto en tarjetones anteriores",
      status: "not_authorized",
      details: "No aparece en tarjetones anteriores",
    })
  } else {
    adminReqs.push({
      requirement: "Autorización administrativa",
      status: "unknown",
      details: "Sin acceso a SIAP para verificar autorización",
    })
  }

  const confidence = calculateConfidence(matched, failed, missing, adminReqs)
  const status = determineStatus(matched, failed, missing, adminReqs)
  const reasons = buildReasons(matched, failed, missing, adminReqs)

  return {
    conceptCode,
    status,
    matchedRequirements: matched,
    missingFacts: missing,
    failedRequirements: failed,
    administrativeRequirements: adminReqs,
    confidence,
    reasons,
  }
}

function getQuestionForFact(factKey: PayrollFactKey): string {
  const questions: Record<string, string> = {
    has_discontinuous_schedule: "¿Tu jornada base de ocho horas se interrumpe una hora o más?",
    discontinuous_schedule_in_appointment: "¿Esa jornada discontinua está indicada en tu nombramiento?",
    performs_academic_activities: "¿Realizas regularmente actividades académicas como parte de tu puesto?",
    participates_in_teaching: "¿Realizas formalmente actividades de docencia en Enfermería?",
    participates_in_research: "¿Participas en actividades de investigación?",
    participates_in_transplant_program: "¿Estás incorporado formalmente a un programa de trasplantes?",
    works_in_emergency_transport: "¿Trabajas en transporte de urgencias?",
    performs_patient_transport: "¿Estás adscrito a un vehículo de urgencias o terapia intensiva y realizas traslado de pacientes?",
    permanent_radiation_exposure: "¿Tu trabajo implica exposición constante y permanente a radiaciones?",
    has_professional_degree: "¿Cuentas con título profesional aplicable a tu categoría?",
    has_professional_license: "¿Cuentas con cédula profesional aplicable?",
    concept_02_on_payslip: "¿El concepto 02 aparece normalmente en tu tarjetón?",
    concept_012_on_payslip: "¿El concepto 012 aparece normalmente en tu tarjetón?",
    concept_013_on_payslip: "¿El concepto 013 aparece normalmente en tu tarjetón?",
    concept_051_on_payslip: "¿El concepto 051 aparece normalmente en tu tarjetón?",
    concept_054_on_payslip: "¿El concepto 054 aparece normalmente en tu tarjetón?",
    concept_057_on_payslip: "¿El concepto 057 aparece normalmente en tu tarjetón?",
    concept_058_on_payslip: "¿El concepto 058 aparece normalmente en tu tarjetón?",
    concept_061_on_payslip: "¿El concepto 061 aparece normalmente en tu tarjetón?",
    concept_062_on_payslip: "¿El concepto 062 aparece normalmente en tu tarjetón?",
    concept_072_on_payslip: "¿El concepto 072 aparece normalmente en tu tarjetón?",
    concept_078_on_payslip: "¿El concepto 078 aparece normalmente en tu tarjetón?",
    concept_083_on_payslip: "¿El concepto 083 aparece normalmente en tu tarjetón?",
  }
  return questions[factKey] ?? `¿Aplica el hecho ${factKey}?`
}

function calculateConfidence(
  matched: EligibilityRequirementResult[],
  failed: EligibilityRequirementResult[],
  missing: MissingPayrollFact[],
  adminReqs: AdministrativeRequirementResult[],
): number {
  const total = matched.length + failed.length + missing.length + adminReqs.length
  if (total === 0) return 0
  const adminConfirmed = adminReqs.filter((a) => a.status === "confirmed").length
  return (matched.length + adminConfirmed) / total
}

function determineStatus(
  matched: EligibilityRequirementResult[],
  failed: EligibilityRequirementResult[],
  missing: MissingPayrollFact[],
  adminReqs: AdministrativeRequirementResult[],
): EligibilityStatus {
  if (failed.length > 0 && matched.length === 0) return "not_eligible"
  if (matched.length > 0 && missing.length === 0 && adminReqs.some((a) => a.status === "confirmed")) {
    return "confirmed"
  }
  if (matched.length > 0 && missing.length === 0) return "probable"
  if (missing.length > 0) return "requires_answer"
  if (matched.length > 0 && failed.length > 0) return "insufficient_data"
  return "insufficient_data"
}

function buildReasons(
  matched: EligibilityRequirementResult[],
  failed: EligibilityRequirementResult[],
  missing: MissingPayrollFact[],
  adminReqs: AdministrativeRequirementResult[],
): string[] {
  const reasons: string[] = []
  if (matched.length > 0) reasons.push(`${matched.length} requisitos cumplidos`)
  if (failed.length > 0) reasons.push(`${failed.length} requisitos no cumplidos: ${failed.map((f) => f.requirement).join(", ")}`)
  if (missing.length > 0) reasons.push(`${missing.length} datos pendientes de confirmar`)
  const adminStatus = adminReqs.find((a) => a.status !== "unknown")
  if (adminStatus) reasons.push(`Administración: ${adminStatus.status}`)
  else reasons.push("Autorización administrativa no confirmada")
  return reasons
}
