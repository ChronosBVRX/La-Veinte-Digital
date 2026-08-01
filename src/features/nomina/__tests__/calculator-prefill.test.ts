import { describe, it, expect } from "vitest"
import { buildCalculatorPrefillResponse, type CalculatorPrefillBuildContext, type RecurringEvidenceEntry } from "../lib/calculator-prefill-builder"
import { CALCULATOR_POLICIES } from "../lib/calculator-prefill-policy"
import { resolveCategory } from "../lib/category-resolver"
import { LEGACY_CATEGORY_ID_MAP } from "../data/salaries"
import type { CalculatedPayrollConcept, EmployeePayrollProfile, ResolvedSalaryCategory, SeniorityResult } from "../lib/types"

const TARGET_DATE = "2026-07-31"

const category = (): ResolvedSalaryCategory => {
  const r = resolveCategory("TECNICO RADIOLOGO 80", TARGET_DATE)
  if (!r.resolved || !r.category) throw new Error("categoría de prueba no resuelta")
  return r.category
}

const seniority: SeniorityResult = {
  years: 12, months: 3, days: 10, totalDays: 4480,
  referenceDate: TARGET_DATE,
  source: "confirmed_effective_date",
  warnings: [],
}

const profile: EmployeePayrollProfile = {
  id: "user-1",
  userId: "user-1",
  consentGiven: true,
  categoryId: category().categoryId,
  categoryName: category().categoryName,
  workdayHours: 8,
  employmentType: "base",
  occupationalConditions: [],
  facts: [],
  siapConceptMarks: [],
  recurringConcepts: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

function concept(code: string, amount: number, opts: Partial<CalculatedPayrollConcept> = {}): CalculatedPayrollConcept {
  return {
    code,
    name: code,
    type: "earning",
    nature: "base",
    amount,
    included: true,
    source: "salary_table",
    confidence: "high",
    verificationStatus: "contract_verified",
    dependencies: [],
    calculationSteps: [],
    legalBasis: [],
    warnings: [],
    ...opts,
  }
}

function makeContext(overrides: Partial<CalculatorPrefillBuildContext> = {}): CalculatorPrefillBuildContext {
  const cat = category()
  return {
    calculatorId: "aguinaldo",
    targetDate: TARGET_DATE,
    generatedAt: "2026-07-31T12:00:00.000Z",
    profile,
    category: cat,
    categoryStatus: "resolved",
    seniority,
    senioritySource: "effective_date",
    effectiveSeniorityDate: "2014-04-21",
    concepts: new Map([
      ["002", concept("002", cat.biweeklyBaseSalary)],
      ["011", concept("011", 200)],
      ["020", concept("020", 150)],
      ["022", concept("022", 700)],
      ["050", concept("050", 100)],
      ["054", concept("054", 300)],
    ]),
    recurringEvidence: [],
    ...overrides,
  }
}

function withConcepts(ctx: CalculatorPrefillBuildContext, overrides: Record<string, CalculatedPayrollConcept>): CalculatorPrefillBuildContext {
  return { ...ctx, concepts: new Map([...ctx.concepts, ...Object.entries(overrides)]) }
}

describe("Prerrelleno normativo - política por calculadora", () => {
  it("aguinaldo entrega 002 y 011 pero nunca el 022", () => {
    const res = buildCalculatorPrefillResponse(makeContext())
    expect(res.categoryResolved).toBe(true)
    expect(res.categoryResolutionStatus).toBe("resolved")
    expect(res.fields.concepto002?.value).toBe(category().biweeklyBaseSalary)
    expect(res.fields.concepto002?.source).toBe("salary_table")
    expect(res.fields.concepto011?.value).toBe(200)
    expect(res.fields.concepto022).toBeUndefined()
    expect(CALCULATOR_POLICIES.aguinaldo.allowedConceptCodes).not.toContain("022")
  })

  it("clausula-97 muestra el 022 solo como información independiente", () => {
    const res = buildCalculatorPrefillResponse(makeContext({ calculatorId: "clausula-97" }))
    expect(res.fields.concepto022?.value).toBe(700)
    expect(res.fields.concepto022?.warning).toContain("NO se integra")
  })

  it("clausula-97 entrega antigüedad y fecha efectiva", () => {
    const res = buildCalculatorPrefillResponse(makeContext({ calculatorId: "clausula-97" }))
    expect(res.fields.seniorityYears?.value).toBe(12)
    expect(res.fields.effectiveSeniorityDate?.value).toBe("2014-04-21")
    expect(res.fields.effectiveSeniorityDate?.source).toBe("profile")
  })

  it("clausula-97 con antigüedad solo textual no inventa fecha efectiva", () => {
    const res = buildCalculatorPrefillResponse(makeContext({
      calculatorId: "clausula-97",
      senioritySource: "parsed_text",
      effectiveSeniorityDate: undefined,
    }))
    expect(res.fields.seniorityYears?.value).toBe(12)
    expect(res.fields.effectiveSeniorityDate).toBeUndefined()
  })

  it("prestamos entrega categoría y salario como referencia", () => {
    const res = buildCalculatorPrefillResponse(makeContext({ calculatorId: "prestamos" }))
    expect(res.fields.categoryName?.value).toBe(category().categoryName)
    expect(res.fields.concepto002?.value).toBe(category().biweeklyBaseSalary)
  })

  it("segunda-julio no introduce el 022", () => {
    const res = buildCalculatorPrefillResponse(makeContext({ calculatorId: "segunda-julio" }))
    expect(res.fields.concepto022).toBeUndefined()
  })
})

describe("Prerrelleno normativo - tiempo extra", () => {
  it("nunca integra el 022 en la base (regresión requisito 15)", () => {
    const res = buildCalculatorPrefillResponse(makeContext({ calculatorId: "tiempo-extra" }))
    expect(res.fields.concepto022).toBeUndefined()
    expect(CALCULATOR_POLICIES["tiempo-extra"].includeConcept022AsInfo).toBe(false)
    expect(CALCULATOR_POLICIES["tiempo-extra"].allowedConceptCodes).not.toContain("022")
  })

  it("nunca prerrellena horas extra (regresión requisito 17)", () => {
    const res = buildCalculatorPrefillResponse(makeContext({ calculatorId: "tiempo-extra" }))
    expect(res.fields).not.toHaveProperty("horasExtra")
  })

  it("deriva la jornada de la categoría con fuente salary_table", () => {
    const res = buildCalculatorPrefillResponse(makeContext({ calculatorId: "tiempo-extra" }))
    expect(res.fields.workdayHours?.value).toBe(8)
    expect(res.fields.workdayHours?.source).toBe("salary_table")
  })

  it("no entrega workdayHours en calculadoras sin política de jornada", () => {
    const res = buildCalculatorPrefillResponse(makeContext({ calculatorId: "aguinaldo" }))
    expect(res.fields.workdayHours).toBeUndefined()
  })

  it("020 se entrega solo si está incluido y con monto positivo", () => {
    const res = buildCalculatorPrefillResponse(makeContext({ calculatorId: "tiempo-extra" }))
    expect(res.fields.concepto020?.value).toBe(150)

    const sinMonto = buildCalculatorPrefillResponse(withConcepts(makeContext({ calculatorId: "tiempo-extra" }), { "020": concept("020", 0) }))
    expect(sinMonto.fields.concepto020).toBeUndefined()

    const noIncluido = buildCalculatorPrefillResponse(withConcepts(makeContext({ calculatorId: "tiempo-extra" }), { "020": concept("020", 150, { included: false }) }))
    expect(noIncluido.fields.concepto020).toBeUndefined()
  })
})

describe("Prerrelleno normativo - conceptos con evidencia", () => {
  it("050 sin monto validado no se prerrellena y avisa", () => {
    const res = buildCalculatorPrefillResponse(withConcepts(makeContext({ calculatorId: "tiempo-extra" }), { "050": concept("050", 0) }))
    expect(res.fields.concepto050).toBeUndefined()
    expect(res.warnings.join(" ")).toContain("050")
  })

  it("050 con monto validado en tarjetón sí se prerrellena", () => {
    const evidence: RecurringEvidenceEntry[] = [
      { conceptCode: "050", amount: 555.5, source: "last_payslip", confirmed: true },
    ]
    const res = buildCalculatorPrefillResponse(makeContext({ calculatorId: "tiempo-extra", recurringEvidence: evidence }))
    expect(res.fields.concepto050?.value).toBe(555.5)
    expect(res.fields.concepto050?.source).toBe("last_payslip")
  })

  it("054 sin evidencia de exposición no se prerrellena", () => {
    const res = buildCalculatorPrefillResponse(withConcepts(makeContext({ calculatorId: "tiempo-extra" }), { "054": concept("054", 300, { included: false }) }))
    expect(res.fields.concepto054).toBeUndefined()
    expect(res.missingFacts.join(" ")).toContain("radiactivas")
  })

  it("054 incluido y con monto se prerrellena", () => {
    const res = buildCalculatorPrefillResponse(withConcepts(makeContext({ calculatorId: "tiempo-extra" }), { "054": concept("054", 300, { confidence: "requires_confirmation" }) }))
    expect(res.fields.concepto054?.value).toBe(300)
  })

  it("023/063 solo con evidencia confirmada en tarjetón", () => {
    const base = makeContext({ calculatorId: "tiempo-extra" })
    expect(buildCalculatorPrefillResponse(base).fields.concepto023).toBeUndefined()
    expect(buildCalculatorPrefillResponse(base).fields.concepto063).toBeUndefined()

    const sinConfirmar: RecurringEvidenceEntry[] = [
      { conceptCode: "023", amount: 88, source: "last_payslip", confirmed: false },
    ]
    expect(buildCalculatorPrefillResponse({ ...base, recurringEvidence: sinConfirmar }).fields.concepto023).toBeUndefined()

    const confirmado: RecurringEvidenceEntry[] = [
      { conceptCode: "023", amount: 88, source: "multiple_payslips", confirmed: true },
      { conceptCode: "063", amount: 44, source: "last_payslip", confirmed: true },
    ]
    const res = buildCalculatorPrefillResponse({ ...base, recurringEvidence: confirmado })
    expect(res.fields.concepto023?.value).toBe(88)
    expect(res.fields.concepto023?.source).toBe("multiple_payslips")
    expect(res.fields.concepto023?.confidence).toBe("requires_confirmation")
    expect(res.fields.concepto063?.value).toBe(44)
  })
})

describe("Prerrelleno normativo - resolución de categoría", () => {
  it("categoría ambigua no entrega valores salariales", () => {
    const res = buildCalculatorPrefillResponse(makeContext({ categoryStatus: "ambiguous", category: null }))
    expect(res.fields.concepto002).toBeUndefined()
    expect(res.fields.categoryName).toBeUndefined()
    expect(res.warnings.join(" ")).toContain("forma única")
  })

  it("categoría inexistente reporta el hecho faltante", () => {
    const res = buildCalculatorPrefillResponse(makeContext({ categoryStatus: "not_found", category: null }))
    expect(res.missingFacts.join(" ")).toContain("categoría")
  })

  it("perfil ausente reporta categoría y antigüedad faltantes", () => {
    const res = buildCalculatorPrefillResponse(makeContext({
      categoryStatus: "missing_profile",
      category: null,
      profile: null,
      seniority: null,
      senioritySource: null,
    }))
    expect(res.missingFacts.join(" ")).toContain("categoría")
  })

  it("resuelve identificadores numéricos de la versión anterior (legacy)", () => {
    let tested = 0
    for (const [legacyId, stableId] of LEGACY_CATEGORY_ID_MAP) {
      const r = resolveCategory(legacyId, TARGET_DATE, legacyId)
      if (r.resolved && r.category) {
        expect(r.category.categoryId).toBe(stableId)
        tested++
        break
      }
    }
    expect(tested).toBeGreaterThan(0)
  })
})

describe("Prerrelleno normativo - días laborados", () => {
  it("segunda-julio-proporcional solo entrega días con fuente verificable", () => {
    const base = makeContext({ calculatorId: "segunda-julio-proporcional" })
    const sinDias = buildCalculatorPrefillResponse(base)
    expect(sinDias.fields.daysWorkedInAnnualPeriod).toBeUndefined()
    expect(sinDias.missingFacts.join(" ")).toContain("días laborados")

    const conDias = buildCalculatorPrefillResponse({
      ...base,
      daysWorkedInAnnualPeriod: { value: 300, source: "calculated", note: "Del periodo anual vigente." },
    })
    expect(conDias.fields.daysWorkedInAnnualPeriod?.value).toBe(300)
    expect(conDias.fields.daysWorkedInAnnualPeriod?.confidence).toBe("requires_confirmation")
    expect(conDias.missingFacts.join(" ")).not.toContain("días laborados")
  })
})

describe("Prerrelleno normativo - contrato", () => {
  it("las advertencias previas del servicio se propagan a la respuesta", () => {
    const res = buildCalculatorPrefillResponse(makeContext({
      warnings: ["Los datos de tu tarjetón aún no se usan: para prellenar con ellos acepta el consentimiento de nómina."],
    }))
    expect(res.warnings.join(" ")).toContain("consentimiento")
  })
  it("las respuestas del builder pasan el validador del contrato", async () => {
    const { isCalculatorPrefillResponse } = await import("@/shared/contracts/calculator-prefill")
    const res = buildCalculatorPrefillResponse(makeContext({ calculatorId: "tiempo-extra" }))
    expect(isCalculatorPrefillResponse(res)).toBe(true)
  })

  it("los campos entregados están dentro de la lista cerrada del contrato", async () => {
    const { isCalculatorPrefillResponse } = await import("@/shared/contracts/calculator-prefill")
    for (const calculatorId of ["aguinaldo", "clausula-97", "prestamos", "segunda-julio", "segunda-julio-proporcional", "tiempo-extra"] as const) {
      const res = buildCalculatorPrefillResponse(makeContext({ calculatorId }))
      expect(isCalculatorPrefillResponse(res), calculatorId).toBe(true)
    }
  })
})
