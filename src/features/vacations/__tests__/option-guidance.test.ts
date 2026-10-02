import { describe, it, expect } from "vitest"
import {
  getMarkGuidance,
  orderMarksByPriority,
  getIncompatibleReason,
} from "../domain/option-guidance"

describe("Orientación de Marcas en Lenguaje de Trabajador", () => {
  it("La descripción principal de la marca no contiene códigos técnicos de UPO ni tokens internos", () => {
    const marks = [0, 1, 2, 3, 4, 9]
    for (const m of marks) {
      const g = getMarkGuidance(m, "SEMESTRAL")
      expect(g.plainSummary).not.toMatch(/APPLY_INCLUSION_MARK|UPO|VALIDATE_ANTICIPATION|CCT_ANNUAL_DAYS/)
      expect(g.title).toContain(`Marca ${m}`)
    }
  })

  it("Marca 4 explica cobro de ayuda completa y Marca 1 explica cobro dividido", () => {
    const g4 = getMarkGuidance(4, "SEMESTRAL")
    expect(g4.plainSummary).toContain("Esta marca paga toda la ayuda en este periodo")
    expect(g4.paysFullHelpNow).toBe(true)

    const g1 = getMarkGuidance(1, "SEMESTRAL")
    expect(g1.plainSummary).toContain("Divides el periodo y también divides la ayuda")
    expect(g1.helpsSplitOrDeferred).toBe(true)

    const g2 = getMarkGuidance(2, "SEMESTRAL")
    expect(g2.plainSummary).toContain("Conservas un segundo periodo de descanso")
    expect(g2.paysNoHelp).toBe(true)
  })

  it("Ordena correctamente según la prioridad del trabajador", () => {
    const available = [1, 2, 4, 9]

    // MORE_NOW prefiere marca 4
    const orderNow = orderMarksByPriority(available, "MORE_NOW")
    expect(orderNow[0]).toBe(4)

    // SPLIT_PAY prefiere marca 1
    const orderSplit = orderMarksByPriority(available, "SPLIT_PAY")
    expect(orderSplit[0]).toBe(1)

    // MORE_REST prefiere marca 2
    const orderRest = orderMarksByPriority(available, "MORE_REST")
    expect(orderRest[0]).toBe(2)
  })

  it("Devuelve motivos claros para opciones incompatibles", () => {
    // Si la continuidad es 1, no permite marca 4
    const r1 = getIncompatibleReason(4, 1, "SEMESTRAL")
    expect(r1).toContain("Tienes abierta la primera fracción")

    // Si la continuidad es 4, no permite marca 1
    const r4 = getIncompatibleReason(1, 4, "SEMESTRAL")
    expect(r4).toContain("marca 9")
  })

  it("Orienta correctamente las opciones de V20 (marcas 0, 6, 7 y 8)", () => {
    const g0 = getMarkGuidance(0, "EXTRAORDINARIO_V20")
    expect(g0.title).toContain("Marca 0")
    expect(g0.plainSummary).toContain("10 días hábiles de descanso")
    expect(g0.paysFullHelpNow).toBe(true)

    const g6 = getMarkGuidance(6, "EXTRAORDINARIO_V20")
    expect(g6.title).toContain("Marca 6")
    expect(g6.plainSummary).toContain("15 días hábiles de descanso continuo")
    expect(g6.plainSummary).toContain("30 días de salario por concepto de ayuda cultural 048")
    expect(g6.paysFullHelpNow).toBe(true)

    const g7 = getMarkGuidance(7, "EXTRAORDINARIO_V20")
    expect(g7.title).toContain("Marca 7")
    expect(g7.plainSummary).toContain("30 días de salario")
    expect(g7.plainSummary).toContain("sin ausentarte")

    const g8 = getMarkGuidance(8, "EXTRAORDINARIO_V20")
    expect(g8.title).toContain("Marca 8")
    expect(g8.plainSummary).toContain("15 días de prima vacacional")
    expect(g8.plainSummary).toContain("jubilación")
    expect(g8.paysNoHelp).toBe(true)
  })

  it("Orienta correctamente la Modalidad B Cuatrimestral (Marcas 2 y 5)", () => {
    const g2 = getMarkGuidance(2, "CUATRIMESTRAL")
    expect(g2.title).toContain("Marca 2")
    expect(g2.plainSummary).toContain("hasta 15 días hábiles de descanso")
    expect(g2.paysNoHelp).toBe(true)

    const g5 = getMarkGuidance(5, "CUATRIMESTRAL")
    expect(g5.title).toContain("Marca 5")
    expect(g5.plainSummary).toContain("hasta 15 días hábiles")
    expect(g5.paysNoHelp).toBe(true)
  })
})
