import { describe, it, expect } from "vitest"
import { buildExplainer, buildQuincenaSummary } from "../lib/explainer"
import { buildReviewChecklist, type ReviewItem } from "../lib/review"
import type { GuidePayslip } from "../lib/types"

function payslip(over: Partial<GuidePayslip> = {}): GuidePayslip {
  return {
    id: "p1",
    source: "local",
    periodRaw: "2ª QNA · JULIO 2026",
    earnings: [
      { code: "002", description: "Sueldo base", amount: 8500, kind: "earning" },
      { code: "033", description: "Estímulo por puntualidad", amount: 566, kind: "earning" },
    ],
    deductions: [{ code: "151", description: "ISR", amount: 997, kind: "deduction" }],
    observations: [],
    totalEarnings: 9066,
    totalDeductions: 997,
    netPay: 8069,
    ...over,
  }
}

describe("buildExplainer", () => {
  it("incluye el sueldo como primer paso", () => {
    const steps = buildExplainer(payslip())
    expect(steps[0].kind).toBe("sueldo" as const)
    expect(steps[0].line?.code).toBe("002")
  })

  it("incluye estímulos cuando existen", () => {
    const steps = buildExplainer(payslip())
    const estimulo = steps.find((s) => s.kind === "estimulo")
    expect(estimulo).toBeTruthy()
    expect(estimulo?.line?.code).toBe("033")
  })

  it("incluye el ISR como deducción", () => {
    const steps = buildExplainer(payslip())
    const isr = steps.find((s) => s.line?.code === "151")
    expect(isr).toBeTruthy()
    expect(isr?.kind).toBe("deduccion" as const)
  })

  it("cierra con el resumen", () => {
    const steps = buildExplainer(payslip())
    expect(steps[steps.length - 1].kind).toBe("resumen" as const)
  })

  it("no inventa pasos cuando no hay conceptos", () => {
    const steps = buildExplainer(payslip({ earnings: [], deductions: [] }))
    expect(steps.length).toBe(1) // solo el resumen
    expect(steps[0].kind).toBe("resumen" as const)
  })
})

describe("buildQuincenaSummary", () => {
  it("resume periodos y conteos", () => {
    const summary = buildQuincenaSummary(payslip())
    expect(summary.perceptions).toBe(2)
    expect(summary.deductions).toBe(1)
    expect(summary.netPay).toBe(8069)
    expect(summary.periodRaw).toBe("2ª QNA · JULIO 2026")
  })
})

describe("buildReviewChecklist", () => {
  it("evalúa reglas presentes y ausentes", () => {
    const items = buildReviewChecklist(payslip())
    const labels = items.map((i) => i.rule.code)
    expect(labels).toContain("002")
    expect(labels).toContain("151")
  })

  it("marca asuntos a revisar con confianza baja", () => {
    const items = buildReviewChecklist(
      payslip({ earnings: [{ code: "055", description: "Ayuda", amount: 100, kind: "earning", confidence: 0.6 }] })
    )
    const flagged = items.filter((i) => i.state === "review" as const)
    expect(flagged.length).toBeGreaterThan(0)
  })

  it("los mensajes son descriptivos, nunca acusatorios", () => {
    const items: ReviewItem[] = buildReviewChecklist(payslip())
    for (const item of items) {
      expect(item.message.toLowerCase()).not.toMatch(/error flagrante|fraude|mal pago|bug/i)
    }
  })
})
