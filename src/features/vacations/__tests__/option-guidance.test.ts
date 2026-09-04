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
})
