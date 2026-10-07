import { describe, it, expect } from "vitest"
import {
  diagnoseConceptDiscrepancy,
} from "../lib/concept-discrepancy-diagnostics"
import { compareQuincenas, describeChange } from "../lib/compare"
import type { GuidePayslip } from "../lib/types"

function makePayslip(over: Partial<GuidePayslip> = {}): GuidePayslip {
  return {
    id: "test-p1",
    source: "local",
    earnings: [],
    deductions: [],
    observations: [],
    ...over,
  }
}

describe("diagnoseConceptDiscrepancy", () => {
  describe("Estímulo de Asistencia (032)", () => {
    it("diagnostica la desaparición del estímulo 032 alertando de falta injustificada e indicando revisión", () => {
      const diag = diagnoseConceptDiscrepancy("032", "desaparecio")
      expect(diag.category).toBe("asistencia")
      expect(diag.severity).toBe("critical")
      expect(diag.headline.toLowerCase()).toContain("falta que conviene revisar")
      expect(diag.probableCause.toLowerCase()).toContain("falta injustificada")
      expect(diag.nature).toContain("Cláusula 38 CCT")
      expect(diag.recommendedAction.toLowerCase()).toContain("checadas")
      expect(diag.recommendedAction.toLowerCase()).toContain("delegado sindical")
    })

    it("diagnostica reducción en estímulo 032 si bajó de importe", () => {
      const diag = diagnoseConceptDiscrepancy("032", "bajo", { previousAmount: 600, amount: 400 })
      expect(diag.category).toBe("asistencia")
      expect(diag.severity).toBe("warning")
      expect(diag.headline.toLowerCase()).toContain("disminuyó")
    })
  })

  describe("Estímulo de Puntualidad (033)", () => {
    it("diagnostica la desaparición del estímulo 033 alertando de retardos o entradas fuera de tolerancia", () => {
      const diag = diagnoseConceptDiscrepancy("033", "desaparecio")
      expect(diag.category).toBe("puntualidad")
      expect(diag.severity).toBe("critical")
      expect(diag.headline.toLowerCase()).toContain("retardos")
      expect(diag.probableCause.toLowerCase()).toContain("5 minutos de tolerancia")
      expect(diag.recommendedAction.toLowerCase()).toContain("reloj checador")
    })

    it("diagnostica variación a la baja en puntualidad", () => {
      const diag = diagnoseConceptDiscrepancy("033", "bajo", { previousAmount: 400, amount: 200 })
      expect(diag.category).toBe("puntualidad")
      expect(diag.severity).toBe("warning")
    })
  })

  describe("Sueldo Base Tabular (002)", () => {
    it("alerta críticamente si el sueldo base no aparece o viene incompleto", () => {
      const diag = diagnoseConceptDiscrepancy("002", "desaparecio")
      expect(diag.category).toBe("sueldo")
      expect(diag.severity).toBe("critical")
      expect(diag.nature).toContain("Cláusulas 56 y 137 del CCT")
      expect(diag.recommendedAction.toLowerCase()).toContain("oficina de personal")
    })
  })

  describe("Ayuda de Renta (011 y 022)", () => {
    it("diagnostica variaciones en ayuda de renta (011)", () => {
      const diag = diagnoseConceptDiscrepancy("011", "bajo")
      expect(diag.category).toBe("renta")
      expect(diag.nature).toContain("Cláusula 63 Bis")
      expect(diag.probableCause.toLowerCase()).toContain("sueldo base")
    })

    it("diagnostica variaciones en ayuda de renta por antigüedad (022)", () => {
      const diag = diagnoseConceptDiscrepancy("022", "desaparecio")
      expect(diag.category).toBe("renta")
      expect(diag.probableCause.toLowerCase()).toContain("antigüedad")
    })
  })

  describe("Sobresueldo por Riesgo (023)", () => {
    it("diagnostica la suspensión o salida de infecto-riesgo", () => {
      const diag = diagnoseConceptDiscrepancy("023", "desaparecio")
      expect(diag.category).toBe("sobresueldo_riesgo")
      expect(diag.probableCause.toLowerCase()).toContain("riesgo")
      expect(diag.recommendedAction.toLowerCase()).toContain("ratificación de adscripción")
    })
  })

  describe("Ayuda para Despensa (050)", () => {
    it("diagnostica omisión en despensa", () => {
      const diag = diagnoseConceptDiscrepancy("050", "desaparecio")
      expect(diag.category).toBe("prevision_social")
      expect(diag.nature).toContain("Cláusula 142 Bis")
      expect(diag.laborContext.toLowerCase()).toContain("fondo de jubilación")
    })
  })

  describe("Deducciones Disciplinarias (172 y 174)", () => {
    it("alerta críticamente sobre nueva deducción por falta injustificada (172)", () => {
      const diag = diagnoseConceptDiscrepancy("172", "nuevo")
      expect(diag.category).toBe("deduccion_disciplinaria")
      expect(diag.severity).toBe("critical")
      expect(diag.headline.toLowerCase()).toContain("falta injustificada")
      expect(diag.laborContext.toLowerCase()).toContain("anulación inmediata")
      expect(diag.recommendedAction.toLowerCase()).toContain("reembolso")
    })

    it("diagnostica deducción por retardos (174)", () => {
      const diag = diagnoseConceptDiscrepancy("174", "nuevo")
      expect(diag.category).toBe("deduccion_disciplinaria")
      expect(diag.severity).toBe("warning")
      expect(diag.probableCause.toLowerCase()).toContain("minuto 6")
    })
  })

  describe("Conceptos Dinámicos No Mapeados Explícitamente", () => {
    it("infiere el contexto y naturaleza laboral a partir del catálogo educativo para conceptos adicionales", () => {
      const diag = diagnoseConceptDiscrepancy("013", "desaparecio")
      expect(diag.code).toBe("013")
      expect(diag.nature).toBeDefined()
      expect(diag.probableCause).toBeDefined()
      expect(diag.recommendedAction).toBeDefined()
    })
  })
})

describe("Integración con compareQuincenas y describeChange", () => {
  it("adjunta el diagnóstico contextual a cada cambio en compareQuincenas", () => {
    const current = makePayslip({
      earnings: [{ code: "002", description: "Sueldo base", amount: 8000, kind: "earning" }],
      deductions: [{ code: "172", description: "Falta injustificada", amount: 533, kind: "deduction" }],
    })
    const previous = makePayslip({
      earnings: [
        { code: "002", description: "Sueldo base", amount: 8000, kind: "earning" },
        { code: "032", description: "Estímulo por asistencia", amount: 600, kind: "earning" },
        { code: "033", description: "Estímulo por puntualidad", amount: 400, kind: "earning" },
      ],
      deductions: [],
    })

    const comparison = compareQuincenas(current, previous)

    // 032 desapareció
    const change032 = comparison.changes.find((c) => c.code === "032")
    expect(change032).toBeDefined()
    expect(change032?.diagnosis).toBeDefined()
    expect(change032?.diagnosis?.category).toBe("asistencia")
    expect(change032?.diagnosis?.headline).toContain("falta que conviene revisar")

    // 033 desapareció
    const change033 = comparison.changes.find((c) => c.code === "033")
    expect(change033).toBeDefined()
    expect(change033?.diagnosis?.category).toBe("puntualidad")
    expect(change033?.diagnosis?.headline).toContain("retardos")

    // 172 nuevo
    const change172 = comparison.changes.find((c) => c.code === "172")
    expect(change172).toBeDefined()
    expect(change172?.diagnosis?.category).toBe("deduccion_disciplinaria")
    expect(change172?.diagnosis?.severity).toBe("critical")
  })

  it("describeChange mantiene compatibilidad de texto e incluye la causa probable", () => {
    const change032 = {
      type: "desaparecio" as const,
      code: "032",
      label: "Estímulo por asistencia",
    }
    const description = describeChange(change032)
    expect(description).toContain("no aparece")
    expect(description).toContain("Causa probable")
    expect(description.toLowerCase()).toContain("falta injustificada")
  })
})
