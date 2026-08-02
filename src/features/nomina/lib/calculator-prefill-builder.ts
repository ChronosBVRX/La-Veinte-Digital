import type {
  CalculatorId,
  CalculatorPrefillFields,
  CalculatorPrefillResponse,
  CategoryResolutionStatus,
  PrefillConfidence,
  PrefillField,
  PrefillSource,
} from "@/shared/contracts/calculator-prefill"
import {
  VALID_WORKDAY_HOURS,
  SENIORITY_YEARS_MAX,
  DAYS_WORKED_MAX,
} from "@/shared/contracts/calculator-prefill"
import type { CalculatedPayrollConcept, EmployeePayrollProfile, ResolvedSalaryCategory, SeniorityResult } from "./types"
import { getAllRules } from "./rules"
import { getCalculatorPolicy } from "./calculator-prefill-policy"

/**
 * Constructor puro del prerrelleno normativo.
 *
 * Recibe un contexto ya resuelto (categoría, salario, antigüedad, conceptos
 * calculados por el motor de nómina) y produce la respuesta de prerrelleno
 * filtrada por la política de la calculadora solicitada.
 *
 * Este módulo NO escribe en la base de datos y NO ejecuta fórmulas de
 * calculadora: solo consulta el motor existente y arma el contrato.
 */

export interface RecurringEvidenceEntry {
  conceptCode: string
  amount: number
  source: PrefillSource
  confirmed: boolean
}

export interface CalculatorPrefillBuildContext {
  calculatorId: CalculatorId
  targetDate: string
  generatedAt: string
  profile: EmployeePayrollProfile | null
  category: ResolvedSalaryCategory | null
  categoryStatus: CategoryResolutionStatus
  categoryResolutionMessage?: string
  seniority: SeniorityResult | null
  /** Cómo se obtuvo la antigüedad (para confianza y trazabilidad). */
  senioritySource: "effective_date" | "parsed_text" | "payslip_reconstructed" | null
  /** Fecha efectiva de antigüedad cuando se pudo reconstruir. */
  effectiveSeniorityDate?: string
  /** Conceptos calculados por el motor de nómina (reglas registradas). */
  concepts: ReadonlyMap<string, CalculatedPayrollConcept>
  /** Evidencia de conceptos recurrentes confirmados en tarjetón. */
  recurringEvidence: RecurringEvidenceEntry[]
  /** Días laborados reales y verificables (solo si existen). */
  daysWorkedInAnnualPeriod?: { value: number; source: PrefillSource; note?: string }
  /** Advertencias previas del servicio (p. ej. consentimiento no otorgado). */
  warnings?: string[]
}

function mapConfidence(confidence: CalculatedPayrollConcept["confidence"]): PrefillConfidence {
  switch (confidence) {
    case "high": return "high"
    case "medium": return "medium"
    case "low": return "requires_confirmation"
    case "requires_confirmation": return "requires_confirmation"
  }
}

function mapSource(source: CalculatedPayrollConcept["source"]): PrefillSource {
  switch (source) {
    case "salary_table": return "salary_table"
    case "contract_rule": return "contract_rule"
    case "regulation_rule": return "regulation_rule"
    case "last_payslip": return "last_payslip"
    case "user_input": return "user_confirmation"
    case "estimated_tax": return "calculated"
    case "reconstructed_rule": return "calculated"
  }
}

function fieldFromConcept(
  concept: CalculatedPayrollConcept,
  ruleVersion: string | undefined,
  effectiveAt: string,
  warning?: string,
): PrefillField<number> {
  return {
    value: concept.amount,
    source: mapSource(concept.source),
    confidence: mapConfidence(concept.confidence),
    effectiveAt,
    editable: true,
    ruleVersion,
    legalReference: concept.legalBasis[0]?.reference ?? concept.legalBasis[0]?.title,
    warning,
  }
}

export function buildCalculatorPrefillResponse(ctx: CalculatorPrefillBuildContext): CalculatorPrefillResponse {
  const policy = getCalculatorPolicy(ctx.calculatorId)
  const warnings: string[] = [...(ctx.warnings ?? [])]
  const missingFacts: string[] = []
  const fields: CalculatorPrefillFields = {}

  const ruleVersions = new Map<string, string>()
  for (const rule of getAllRules()) {
    ruleVersions.set(rule.id, `${rule.id}@${rule.version}`)
  }

  const concept = (code: string) => ctx.concepts.get(code)

  if (ctx.categoryStatus === "resolved" && ctx.category) {
    if (policy.allowCategory) {
      const categoryConfidence: PrefillConfidence =
        ctx.categoryResolutionMessage ? "medium" : "high"
      fields.categoryId = {
        value: ctx.category.categoryId,
        source: "profile",
        confidence: categoryConfidence,
        effectiveAt: ctx.targetDate,
        editable: true,
        legalReference: "Perfil del trabajador",
      }
      fields.categoryName = {
        value: ctx.category.categoryName,
        source: "profile",
        confidence: categoryConfidence,
        effectiveAt: ctx.targetDate,
        editable: true,
        legalReference: "Perfil del trabajador",
      }
    }

    const c002 = concept("002")
    if (c002 && policy.allowedConceptCodes.includes("002")) {
      fields.concepto002 = fieldFromConcept(c002, ctx.category.salaryTableVersion, ctx.targetDate)
    }

    const c011 = concept("011")
    if (c011 && policy.allowedConceptCodes.includes("011")) {
      fields.concepto011 = fieldFromConcept(c011, ruleVersions.get("011"), ctx.targetDate)
    }

    const c020 = concept("020")
    if (c020 && policy.allowedConceptCodes.includes("020") && c020.included && c020.amount > 0) {
      fields.concepto020 = fieldFromConcept(c020, ruleVersions.get("020"), ctx.targetDate)
    }

    const c022 = concept("022")
    if (c022 && policy.includeConcept022AsInfo && c022.amount > 0) {
      fields.concepto022 = fieldFromConcept(
        c022,
        ruleVersions.get("022"),
        ctx.targetDate,
        "Prestación anual por antigüedad — se muestra como referencia y NO se integra automáticamente en ninguna base.",
      )
    }

    const c050 = concept("050")
    const c050Evidence = ctx.recurringEvidence.find((e) => e.conceptCode === "050")
    if (policy.allowedConceptCodes.includes("050")) {
      if (c050Evidence) {
        fields.concepto050 = {
          value: c050Evidence.amount,
          source: "last_payslip",
          confidence: "medium",
          effectiveAt: ctx.targetDate,
          editable: true,
          warning: "Importe del último tarjetón confirmado.",
        }
      } else if (c050 && c050.amount > 0) {
        fields.concepto050 = fieldFromConcept(c050, ruleVersions.get("050"), ctx.targetDate)
      } else {
        warnings.push("Concepto 050 pendiente de validación — no se prerrellena un monto sin fuente confirmada.")
      }
    }

    const c054 = concept("054")
    if (policy.allowedConceptCodes.includes("054")) {
      if (c054 && c054.included && c054.amount > 0) {
        fields.concepto054 = fieldFromConcept(c054, ruleVersions.get("054"), ctx.targetDate)
      } else if (c054 && c054.amount > 0) {
        warnings.push(
          "El concepto 054 requiere evidencia de exposición permanente o confirmación en tarjetón — no se prerrellena.",
        )
        missingFacts.push("condición ocupacional de exposición a emanaciones radiactivas")
      }
    }

    for (const code of ["023", "063"] as const) {
      if (!policy.allowedConceptCodes.includes(code)) continue
      const evidence = ctx.recurringEvidence.find((e) => e.conceptCode === code)
      if (evidence && evidence.confirmed && evidence.amount > 0) {
        const value: PrefillField<number> = {
          value: evidence.amount,
          source: evidence.source,
          confidence: "requires_confirmation",
          effectiveAt: ctx.targetDate,
          editable: true,
          warning: "Valor del último tarjetón confirmado — no es una fórmula normativa validada.",
        }
        if (code === "023") fields.concepto023 = value
        else fields.concepto063 = value
      }
    }

    if (policy.includeWorkdayHours) {
      const hours = ctx.category.workdayHours ?? ctx.profile?.workdayHours
      if (hours && VALID_WORKDAY_HOURS.includes(hours)) {
        fields.workdayHours = {
          value: hours,
          source: "salary_table",
          confidence: "high",
          effectiveAt: ctx.targetDate,
          editable: true,
          ruleVersion: ctx.category.salaryTableVersion,
          legalReference: "Sufijo numérico de la categoría (jornada)",
        }
      }
    }
  }

  if (policy.includeSeniority && ctx.seniority) {
    if (ctx.seniority.years <= SENIORITY_YEARS_MAX) {
      fields.seniorityYears = {
        value: ctx.seniority.years,
        source: "calculated",
        confidence: "high",
        effectiveAt: ctx.targetDate,
        editable: true,
        legalReference: "Antigüedad efectiva del trabajador",
      }
    } else {
      warnings.push("La antigüedad efectiva supera el límite normativo razonable — no se prerrellena.")
      missingFacts.push("antigüedad")
    }
    if (ctx.senioritySource === "effective_date" || ctx.senioritySource === "payslip_reconstructed") {
      fields.effectiveSeniorityDate = {
        value: ctx.effectiveSeniorityDate ?? ctx.seniority.referenceDate,
        source: "profile",
        confidence: "high",
        effectiveAt: ctx.targetDate,
        editable: true,
        legalReference: "Fecha efectiva de antigüedad",
      }
    }
  }

  if (policy.includeDaysWorked && ctx.daysWorkedInAnnualPeriod) {
    if (ctx.daysWorkedInAnnualPeriod.value >= 0 && ctx.daysWorkedInAnnualPeriod.value <= DAYS_WORKED_MAX) {
      fields.daysWorkedInAnnualPeriod = {
        value: ctx.daysWorkedInAnnualPeriod.value,
        source: ctx.daysWorkedInAnnualPeriod.source,
        confidence: "requires_confirmation",
        effectiveAt: ctx.targetDate,
        editable: true,
        warning: ctx.daysWorkedInAnnualPeriod.note ?? "Solo se prerrellena con una fuente real y verificable.",
      }
    } else {
      warnings.push("Los días laborados del periodo están fuera de rango — no se prerrellenan.")
      missingFacts.push("días laborados en el periodo anual")
    }
  }

  if (ctx.categoryStatus === "missing_profile") {
    missingFacts.push("categoría (perfil no registrado)")
  } else if (ctx.categoryStatus === "not_found") {
    missingFacts.push("categoría")
  }

  if (ctx.seniority === null && policy.includeSeniority) {
    missingFacts.push("antigüedad")
  }

  if (policy.includeDaysWorked && !ctx.daysWorkedInAnnualPeriod) {
    missingFacts.push("días laborados en el periodo anual")
  }

  if (ctx.categoryStatus === "ambiguous") {
    warnings.push("No fue posible identificar la categoría de forma única — no se prerrellenan valores salariales.")
  }
  if (ctx.categoryResolutionMessage) {
    warnings.push(ctx.categoryResolutionMessage)
  }

  return {
    schemaVersion: "1.0",
    calculatorId: ctx.calculatorId,
    targetDate: ctx.targetDate,
    generatedAt: ctx.generatedAt,
    categoryResolved: ctx.categoryStatus === "resolved",
    categoryResolutionStatus: ctx.categoryStatus,
    fields,
    missingFacts,
    warnings,
  }
}
