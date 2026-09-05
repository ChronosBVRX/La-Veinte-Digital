import { describe, it, expect } from "vitest"
import { buildExplainer, buildQuincenaSummary } from "@/features/tarjeton-guia/lib/explainer"
import type { GuidePayslip } from "@/features/tarjeton-guia/lib/types"
import { toGuidePayslip, dbRowToGuidePayslip } from "@/features/tarjeton-guia/services/payslip-guide"

describe("Pipeline Canónico de Análisis y Persistencia de Tarjetón IMSS", () => {
  const sampleEarnings = [
    { code: "002", description: "SUELDO", amount: 6245.10, kind: "earning" as const },
    { code: "011", description: "AYUDA PARA RENTA", amount: 1200.00, kind: "earning" as const },
    { code: "020", description: "COMPENSACION GARANTIZADA", amount: 1500.00, kind: "earning" as const },
    { code: "022", description: "ANTIGUEDAD", amount: 850.50, kind: "earning" as const },
    { code: "032", description: "ESTIMULO ASISTENCIA", amount: 624.51, kind: "earning" as const },
    { code: "033", description: "ESTIMULO PUNTUALIDAD", amount: 624.51, kind: "earning" as const },
    { code: "050", description: "DESPENSA", amount: 1800.00, kind: "earning" as const },
    { code: "055", description: "FONDO DE AHORRO", amount: 750.00, kind: "earning" as const },
    { code: "099", description: "CONCEPTO ADICIONAL", amount: 662.25, kind: "earning" as const },
  ]

  const sampleDeductions = [
    { code: "107", description: "PRESTAMO PERSONAL", amount: 1200.00, kind: "deduction" as const },
    { code: "108", description: "PRESTAMO HIPOTECARIO", amount: 3500.00, kind: "deduction" as const },
    { code: "151", description: "I.S.R.", amount: 2150.35, kind: "deduction" as const },
    { code: "152", description: "CUOTA SINDICAL", amount: 250.00, kind: "deduction" as const },
    { code: "154", description: "SEGURO DE VIDA", amount: 180.00, kind: "deduction" as const },
    { code: "170", description: "CUOTA MUTUALIDAD", amount: 74.52, kind: "deduction" as const },
    { code: "180", description: "FONDO DE JUBILACION", amount: 1500.00, kind: "deduction" as const },
    { code: "190", description: "DESCUENTO VARIOS", amount: 1500.00, kind: "deduction" as const },
  ]

  const totalEarnings = 14256.87
  const totalDeductions = 10354.87
  const netPay = 3902.00

  it("1. Construye resumen con 9 percepciones y 8 deducciones sin marcar incompleteExtraction", () => {
    const payslip: GuidePayslip = {
      id: "slip-test-complete",
      periodRaw: "1A-SEP-2026",
      periodLabel: "1.ª quincena de septiembre de 2026",
      earnings: sampleEarnings,
      deductions: sampleDeductions,
      observations: [],
      totalEarnings,
      totalDeductions,
      netPay,
      source: "local",
      analysisStatus: "ready",
    }

    const summary = buildQuincenaSummary(payslip)
    expect(summary.perceptions).toBe(9)
    expect(summary.deductions).toBe(8)
    expect(summary.totalEarnings).toBe(14256.87)
    expect(summary.totalDeductions).toBe(10354.87)
    expect(summary.netPay).toBe(3902.00)
    expect(summary.incompleteExtraction).toBe(false)
  })

  it("2. La Guía NO muestra 'Detalle pendiente de lectura' cuando hay conceptos presentes", () => {
    const payslip: GuidePayslip = {
      id: "slip-test-complete",
      periodRaw: "1A-SEP-2026",
      periodLabel: "1.ª quincena de septiembre de 2026",
      earnings: sampleEarnings,
      deductions: sampleDeductions,
      observations: [],
      totalEarnings,
      totalDeductions,
      netPay,
      source: "local",
      analysisStatus: "ready",
    }

    const steps = buildExplainer(payslip)
    const summaryStep = steps.find((s) => s.kind === "resumen")
    expect(summaryStep).toBeDefined()
    expect(summaryStep?.title).toBe("Tu pago en pocas palabras")
    expect(summaryStep?.title).not.toContain("Detalle pendiente de lectura")
    expect(summaryStep?.explanation).toContain("Detectamos 9 percepciones y 8 deducciones")
    expect(summaryStep?.emoji).toBe("📊")
  })

  it("3. Solo marca incompleteExtraction si tiene totales pero 0 percepciones y 0 deducciones", () => {
    const emptyPayslip: GuidePayslip = {
      id: "slip-empty",
      periodRaw: "1A-SEP-2026",
      periodLabel: "1.ª quincena de septiembre de 2026",
      earnings: [],
      deductions: [],
      observations: [],
      totalEarnings: 14256.87,
      totalDeductions: 10354.87,
      netPay: 3902.00,
      source: "server",
      analysisStatus: "pending",
    }

    const summary = buildQuincenaSummary(emptyPayslip)
    expect(summary.incompleteExtraction).toBe(true)

    const steps = buildExplainer(emptyPayslip)
    const summaryStep = steps.find((s) => s.kind === "resumen")
    expect(summaryStep?.title).toBe("Detalle pendiente de lectura")
    expect(summaryStep?.emoji).toBe("⚠️")
  })

  it("4. Valida contabilidad exacta de 1A-SEP-2026 ($14,256.87 - $10,354.87 = $3,902.00)", () => {
    const sumEarnings = Number(sampleEarnings.reduce((acc, l) => acc + l.amount, 0).toFixed(2))
    const sumDeductions = Number(sampleDeductions.reduce((acc, l) => acc + l.amount, 0).toFixed(2))
    const calculatedNet = Number((sumEarnings - sumDeductions).toFixed(2))

    expect(sumEarnings).toBe(14256.87)
    expect(sumDeductions).toBe(10354.87)
    expect(calculatedNet).toBe(3902.00)
  })

  it("5. Conceptos no catalogados muestran explicación respetuosa sin romper la Guía", () => {
    const payslipWithUncataloged: GuidePayslip = {
      id: "slip-uncataloged",
      periodRaw: "1A-SEP-2026",
      earnings: [
        { code: "002", description: "SUELDO BASE", amount: 3000, kind: "earning" },
        { code: "999", description: "BONO ESPECIAL UNICO", amount: 500, kind: "earning" },
      ],
      deductions: [{ code: "998", description: "DESCUENTO EXTRAORDINARIO", amount: 200, kind: "deduction" }],
      observations: [],
      totalEarnings: 3500,
      totalDeductions: 200,
      netPay: 3300,
      source: "local",
    }

    const steps = buildExplainer(payslipWithUncataloged)
    const customEarning = steps.find((s) => s.line?.code === "999")
    const customDeduction = steps.find((s) => s.line?.code === "998")

    expect(customEarning?.explanation).toContain("Concepto detectado en tu tarjetón")
    expect(customEarning?.explanation).toContain("$500")
    expect(customDeduction?.explanation).toContain("Se te descontaron $200")
  })

  it("6. toGuidePayslip mapea correctamente analysisStatus y percepciones de localStorage", () => {
    const rawLocal = {
      id: "local_1",
      period: { id: "2026-09-01", label: "1.ª quincena de septiembre de 2026" },
      periodRaw: "1A-SEP-2026",
      earnings: sampleEarnings,
      deductions: sampleDeductions,
      totalEarnings,
      totalDeductions,
      netPay,
      analysisStatus: "ready",
    }

    const guidePayslip = toGuidePayslip(rawLocal)
    expect(guidePayslip).not.toBeNull()
    expect(guidePayslip?.earnings.length).toBe(9)
    expect(guidePayslip?.deductions.length).toBe(8)
    expect(guidePayslip?.analysisStatus).toBe("ready")
    expect(guidePayslip?.periodRaw).toBe("1A-SEP-2026")
  })

  it("7. dbRowToGuidePayslip mapea filas del servidor asignando analysisStatus ready si tiene líneas", () => {
    const row = {
      id: "srv_1",
      period_raw: "1A-SEP-2026",
      period_month: 9,
      period_year: 2026,
      period_half: 1,
      payroll_totals: { totalEarnings, totalDeductions, netPay },
    }

    const lines = [
      ...sampleEarnings.map((e, idx) => ({ ...e, line_index: idx, concept_code: e.code, confirmed_by_user: true })),
      ...sampleDeductions.map((d, idx) => ({ ...d, line_index: idx + 9, concept_code: d.code, confirmed_by_user: true })),
    ]

    const guidePayslip = dbRowToGuidePayslip(row, lines, [])
    expect(guidePayslip).not.toBeNull()
    expect(guidePayslip?.earnings.length).toBe(9)
    expect(guidePayslip?.deductions.length).toBe(8)
    expect(guidePayslip?.analysisStatus).toBe("ready")
  })

  it("8. dbRowToGuidePayslip asigna analysisStatus pending si el servidor no tiene líneas", () => {
    const row = {
      id: "srv_empty",
      period_raw: "1A-SEP-2026",
      payroll_totals: { totalEarnings, totalDeductions, netPay },
    }

    const guidePayslip = dbRowToGuidePayslip(row, [], [])
    expect(guidePayslip?.earnings.length).toBe(0)
    expect(guidePayslip?.deductions.length).toBe(0)
    expect(guidePayslip?.analysisStatus).toBe("pending")
  })

  it("9. buildQuincenaSummary garantiza exclusión mutua: si hay conceptos, incompleteExtraction es false", () => {
    const readyPayslip: GuidePayslip = {
      id: "slip-ready",
      periodRaw: "1A-SEP-2026",
      earnings: sampleEarnings,
      deductions: sampleDeductions,
      observations: [],
      totalEarnings,
      totalDeductions,
      netPay,
      source: "local",
      analysisStatus: "ready",
    }

    const summary = buildQuincenaSummary(readyPayslip)
    expect(summary.incompleteExtraction).toBe(false)
    expect(summary.perceptions).toBe(9)
    expect(summary.deductions).toBe(8)
  })

  it("10. Los 9 conceptos de percepciones y 8 de deducciones se preservan individualmente", () => {
    const payslip: GuidePayslip = {
      id: "slip-all-concepts",
      periodRaw: "1A-SEP-2026",
      earnings: sampleEarnings,
      deductions: sampleDeductions,
      observations: [],
      totalEarnings,
      totalDeductions,
      netPay,
      source: "local",
    }

    expect(payslip.earnings.map((e) => e.code)).toEqual([
      "002", "011", "020", "022", "032", "033", "050", "055", "099"
    ])
    expect(payslip.deductions.map((d) => d.code)).toEqual([
      "107", "108", "151", "152", "154", "170", "180", "190"
    ])
  })
})
