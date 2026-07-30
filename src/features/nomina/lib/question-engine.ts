import type {
  EmployeePayrollProfile,
  PayrollFact,
  PayrollFactKey,
  PayrollFactValue,
} from "./types"
import type { EligibilityResult, MissingPayrollFact } from "./eligibility"

export type QuestionAnswerType =
  | "yes_no_unknown"
  | "single_select"
  | "multi_select"
  | "date"
  | "number"
  | "concept_confirmation"

export interface ConditionalPayrollQuestion {
  id: string
  factKey: PayrollFactKey
  question: string
  helpText?: string
  whyItMatters?: string
  answerType: QuestionAnswerType
  options?: { value: string | boolean | null; label: string }[]
  requiredForConcepts: string[]
  priority: "essential" | "important" | "optional"
  estimatedImpact?: number
}

function estimateImpactForFact(factKey: PayrollFactKey, profile: EmployeePayrollProfile): number {
  const impactEstimates: Partial<Record<PayrollFactKey, number>> = {
    concept_072_on_payslip: 358,
    concept_054_on_payslip: 1434,
    concept_02_on_payslip: 1138,
    concept_012_on_payslip: 1076,
    concept_013_on_payslip: 1434,
    concept_057_on_payslip: 1183,
    concept_058_on_payslip: 2223,
    concept_061_on_payslip: 717,
    concept_062_on_payslip: 1434,
    concept_078_on_payslip: 717,
    participates_in_transplant_program: 1434,
    participates_in_teaching: 2223,
    performs_patient_transport: 717,
    performs_academic_activities: 717,
    has_professional_degree: 200,
    has_professional_license: 200,
  }
  return impactEstimates[factKey] ?? 100
}

export function buildPendingQuestions(
  profile: EmployeePayrollProfile,
  eligibilityResults: EligibilityResult[],
  previousAnswers: PayrollFact[],
): ConditionalPayrollQuestion[] {
  const missingFactsMap = new Map<string, MissingPayrollFact & { conceptCode: string }>()

  for (const result of eligibilityResults) {
    for (const mf of result.missingFacts) {
      const existing = missingFactsMap.get(mf.factKey)
      if (existing) {
        existing.conceptCode += `,${mf.conceptCode}`
      } else {
        missingFactsMap.set(mf.factKey, { ...mf, conceptCode: mf.conceptCode })
      }
    }
  }

  const alreadyAnswered = new Set((previousAnswers ?? []).map((a) => a.key))

  const questions: ConditionalPayrollQuestion[] = []

  for (const [factKeyStr, mf] of missingFactsMap) {
    const factKey = factKeyStr as PayrollFactKey
    if (alreadyAnswered.has(factKey)) continue

    const impact = estimateImpactForFact(factKey, profile)
    const concepts = mf.conceptCode.split(",")

    questions.push({
      id: `q_${factKey}`,
      factKey,
      question: getQuestionText(factKey as PayrollFactKey),
      helpText: getHelpText(factKey as PayrollFactKey),
      whyItMatters: getWhyItMatters(factKey as PayrollFactKey),
      answerType: "yes_no_unknown",
      options: [
        { value: true, label: "Sí" },
        { value: false, label: "No" },
        { value: null, label: "No lo sé" },
      ],
      requiredForConcepts: concepts,
      priority: impact > 1000 ? "important" : "optional",
      estimatedImpact: impact,
    })
  }

  questions.sort((a, b) => {
    const priorityOrder = { essential: 0, important: 1, optional: 2 }
    const aOrder = priorityOrder[a.priority]
    const bOrder = priorityOrder[b.priority]
    if (aOrder !== bOrder) return aOrder - bOrder
    return (b.estimatedImpact ?? 0) - (a.estimatedImpact ?? 0)
  })

  return questions.slice(0, 3)
}

function getQuestionText(factKey: PayrollFactKey): string {
  const questions: Record<string, string> = {
    has_discontinuous_schedule: "¿Tu jornada base de ocho horas se interrumpe una hora o más?",
    discontinuous_schedule_in_appointment: "¿Esa jornada discontinua está indicada en tu nombramiento?",
    performs_academic_activities: "¿Realizas regularmente actividades académicas como parte de tu puesto?",
    participates_in_teaching: "¿Realizas formalmente actividades de docencia en Enfermería?",
    participates_in_transplant_program: "¿Estás incorporado formalmente a un programa de trasplantes?",
    performs_patient_transport: "¿Estás adscrito a un vehículo de urgencias o terapia intensiva y realizas traslado de pacientes?",
    permanent_radiation_exposure: "¿Tu trabajo implica exposición constante y permanente a radiaciones en las condiciones reconocidas para tu plaza?",
    has_professional_degree: "¿Cuentas con título profesional aplicable a tu categoría?",
    has_professional_license: "¿Cuentas con cédula profesional aplicable?",
    concept_02_on_payslip: "¿El concepto 02 (Transporte y Control de Vehículos) aparece normalmente en tu tarjetón?",
    concept_012_on_payslip: "¿El concepto 012 (Jornada Discontinua) aparece normalmente en tu tarjetón?",
    concept_013_on_payslip: "¿El concepto 013 (Sobresueldo Médico) aparece normalmente en tu tarjetón?",
    concept_051_on_payslip: "¿El concepto 051 (Disponibilidad en Trasplantes) aparece normalmente en tu tarjetón?",
    concept_054_on_payslip: "¿El concepto 054 (Emanaciones Radiactivas) aparece normalmente en tu tarjetón?",
    concept_057_on_payslip: "¿El concepto 057 (Atención Integral Continua) aparece normalmente en tu tarjetón?",
    concept_058_on_payslip: "¿El concepto 058 (Docencia en Enfermería) aparece normalmente en tu tarjetón?",
    concept_061_on_payslip: "¿El concepto 061 (Traslado de Pacientes) aparece normalmente en tu tarjetón?",
    concept_062_on_payslip: "¿El concepto 062 (Ayuda para Libros a Médicos) aparece normalmente en tu tarjetón?",
    concept_072_on_payslip: "¿El concepto 072 (Ayuda para Libros) aparece normalmente en tu tarjetón?",
    concept_078_on_payslip: "¿El concepto 078 (Actividades Académicas) aparece normalmente en tu tarjetón?",
    concept_083_on_payslip: "¿El concepto 083 aparece normalmente en tu tarjetón?",
  }
  return questions[factKey] ?? `¿Aplica el hecho ${factKey}?`
}

function getHelpText(factKey: PayrollFactKey): string | undefined {
  const help: Partial<Record<PayrollFactKey, string>> = {
    has_discontinuous_schedule: "No se refiere solamente al tiempo habitual para comer; debe ser una condición formal de la jornada.",
    discontinuous_schedule_in_appointment: "Revisa tu nombramiento para ver si menciona jornada discontinua.",
    participates_in_teaching: "Debe tratarse de una función reconocida o asignada, no solo de orientar ocasionalmente a otro trabajador.",
    performs_patient_transport: "Aplica principalmente en CDMX y Valle de México.",
    permanent_radiation_exposure: "No es exposición ocasional — debe ser constante y permanente según las condiciones de tu plaza.",
    concept_072_on_payslip: "Puede aparecer como ayuda para libros y el porcentaje depende de la categoría.",
    concept_054_on_payslip: "Si no aparece, preguntaremos por la exposición directa.",
  }
  return help[factKey]
}

function getWhyItMatters(factKey: PayrollFactKey): string | undefined {
  const matters: Partial<Record<PayrollFactKey, string>> = {
    participates_in_transplant_program: "Determina si puedes recibir el concepto 051 (20% sobre 002+011).",
    participates_in_teaching: "Determina si puedes recibir el concepto 058 para docencia en Enfermería.",
    concept_072_on_payslip: "Confirma si recibes ayuda para libros no médicos en tu nómina.",
    concept_054_on_payslip: "Confirma si recibes el pago por emanaciones radiactivas.",
    has_professional_degree: "Cambia el porcentaje del concepto 083 de 5% a 20%.",
    has_professional_license: "Junto con el título, determina el porcentaje del concepto 083.",
  }
  return matters[factKey]
}
