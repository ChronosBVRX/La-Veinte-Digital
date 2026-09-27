import { describe, it, expect } from "vitest"
import { buildExplainer, buildQuincenaSummary } from "../lib/explainer"
import { buildReviewChecklist, type ReviewItem } from "../lib/review"
import { parseFortnightIndex } from "../data/review-rules"
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

  it("detecta coherencia de régimen RJP (152 y 107 concurrentes para <2005)", () => {
    // Caso correcto pre-2005: 152 + 107
    const okPre2005 = buildReviewChecklist(
      payslip({
        deductions: [
          { code: "152", description: "Fondo jubilación 3%", amount: 300, kind: "deduction" },
          { code: "107", description: "Provisión jubilación 7%", amount: 700, kind: "deduction" },
        ],
      })
    )
    const rjpOk = okPre2005.find((i) => i.rule.id === "rjp-coherencia")
    expect(rjpOk).toBeDefined()
    expect(rjpOk?.state).toBe("normal")

    // Caso inconsistente: 152 sin 107
    const incPre2005 = buildReviewChecklist(
      payslip({
        deductions: [
          { code: "152", description: "Fondo jubilación 3%", amount: 300, kind: "deduction" },
        ],
      })
    )
    const rjpInc = incPre2005.find((i) => i.rule.id === "rjp-coherencia")
    expect(rjpInc?.state).toBe("review")
    expect(rjpInc?.message).toContain("107")

    // Caso régimen transición 2005-2008: 108 único
    const trans = buildReviewChecklist(
      payslip({
        deductions: [
          { code: "108", description: "Provisión RJP 10%", amount: 1000, kind: "deduction" },
        ],
      })
    )
    const rjpTrans = trans.find((i) => i.rule.id === "rjp-coherencia")
    expect(rjpTrans?.state).toBe("normal")

    // Caso generación AFORE Cl. 157: 111
    const afore = buildReviewChecklist(
      payslip({
        deductions: [
          { code: "111", description: "Aportación complementaria AFORE", amount: 200, kind: "deduction" },
        ],
      })
    )
    const rjpAfore = afore.find((i) => i.rule.id === "rjp-coherencia")
    expect(rjpAfore?.state).toBe("normal")
  })

  it("evalúa incidencias y tolerancias biométricas en estímulos 032 y 033", () => {
    // 032 presente con falta 172 -> review
    const faltaAsistencia = buildReviewChecklist(
      payslip({
        earnings: [{ code: "032", description: "Estímulo asistencia", amount: 600, kind: "earning" }],
        deductions: [{ code: "172", description: "Falta injustificada", amount: 500, kind: "deduction" }],
      })
    )
    const item032Falta = faltaAsistencia.find((i) => i.rule.id === "estimulo-asistencia")
    expect(item032Falta?.state).toBe("review")

    // 032 presente con pases de salida 173 -> info (pases autorizados)
    const pasesAsistencia = buildReviewChecklist(
      payslip({
        earnings: [{ code: "032", description: "Estímulo asistencia", amount: 600, kind: "earning" }],
        deductions: [{ code: "173", description: "Pases particulares", amount: 100, kind: "deduction" }],
      })
    )
    const item032Pases = pasesAsistencia.find((i) => i.rule.id === "estimulo-asistencia")
    expect(item032Pases?.state).toBe("info")

    // 033 presente con retardos 174 -> review
    const retardoPuntualidad = buildReviewChecklist(
      payslip({
        earnings: [{ code: "033", description: "Estímulo puntualidad", amount: 400, kind: "earning" }],
        deductions: [{ code: "174", description: "Retardos", amount: 80, kind: "deduction" }],
      })
    )
    const item033Retardos = retardoPuntualidad.find((i) => i.rule.id === "estimulo-puntualidad")
    expect(item033Retardos?.state).toBe("review")
  })

  it("audita vencimiento de préstamos y unidades en observaciones", () => {
    // Préstamo vencido (duePeriod anterior a quincena actual 2026-14)
    const vencido = buildReviewChecklist(
      payslip({
        periodRaw: "2ª QNA · JULIO 2026", // Qna 14 de 2026
        deductions: [{ code: "150", description: "Préstamo personal", amount: 850, kind: "deduction" }],
        observations: [
          { conceptCode: "150", amount: 850, duePeriod: "202612" }, // Venció en Qna 12
        ],
      })
    )
    const itemVencido = vencido.find((i) => i.rule.id === "prestamo-vencimiento")
    expect(itemVencido).toBeDefined()
    expect(itemVencido?.state).toBe("review")
    expect(itemVencido?.message).toContain("cumplida")

    // Préstamo con unidades en cero pero cobro activo
    const unidadesCero = buildReviewChecklist(
      payslip({
        periodRaw: "2ª QNA · JULIO 2026",
        deductions: [{ code: "150", description: "Préstamo personal", amount: 850, kind: "deduction" }],
        observations: [
          { conceptCode: "150", amount: 850, units: 0 },
        ],
      })
    )
    const itemCero = unidadesCero.find((i) => i.rule.id === "prestamo-vencimiento")
    expect(itemCero?.state).toBe("review")
    expect(itemCero?.message).toContain("cero")

    // Préstamo vigente regular
    const vigente = buildReviewChecklist(
      payslip({
        periodRaw: "2ª QNA · JULIO 2026", // Qna 14
        deductions: [{ code: "150", description: "Préstamo personal", amount: 850, kind: "deduction" }],
        observations: [
          { conceptCode: "150", amount: 850, duePeriod: "202620", units: 6 },
        ],
      })
    )
    const itemVigente = vigente.find((i) => i.rule.id === "prestamo-vencimiento")
    expect(itemVigente?.state).toBe("normal")
  })
})

describe("parseFortnightIndex", () => {
  it("interpreta formatos numéricos, inversos y textuales IMSS", () => {
    expect(parseFortnightIndex("2026-14")?.index).toBe(2026 * 24 + 14)
    expect(parseFortnightIndex("202614")?.index).toBe(2026 * 24 + 14)
    expect(parseFortnightIndex("14/2026")?.index).toBe(2026 * 24 + 14)
    expect(parseFortnightIndex("2ª QNA · JULIO 2026")?.index).toBe(2026 * 24 + 14)
    expect(parseFortnightIndex("1ª QNA · ENERO 2026")?.index).toBe(2026 * 24 + 1)
    expect(parseFortnightIndex("2A QNA DE DICIEMBRE DE 2025")?.index).toBe(2025 * 24 + 24)
    expect(parseFortnightIndex("invalido")).toBeNull()
  })
})
