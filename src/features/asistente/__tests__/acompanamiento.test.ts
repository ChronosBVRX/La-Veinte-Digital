import { describe, it, expect } from "vitest"
import {
  classifyAcompañamiento,
  isContinuation,
} from "../lib/acompanamiento"
import { classifyRetrievalIntent } from "../lib/retrieval-sources"

describe("classifyAcompañamiento — casos semánticos (punto 12)", () => {
  it("hostigamiento/amenaza del jefe → SÍ recomienda representante", () => {
    const ac = classifyAcompañamiento("Mi jefe me amenaza.", "SPECIFIC_TOPIC")
    expect(ac.kind).toBe("conflicto")
    expect(ac.recomendarRepresentante).toBe(true)
    expect(ac.chips.length).toBeGreaterThan(0)
    expect(ac.chips.length).toBeLessThanOrEqual(4)
  })

  it("levantar un acta → acompañamiento + chips de sanción", () => {
    const ac = classifyAcompañamiento("Me quieren levantar un acta.", "SPECIFIC_TOPIC")
    expect(ac.recomendarRepresentante).toBe(true)
    expect(ac.chips.some((c) => /firmar el acta/i.test(c))).toBe(true)
  })

  it("actividades fuera de categoría → documentar + representante", () => {
    const ac = classifyAcompañamiento(
      "Me están poniendo actividades que no corresponden a mi categoría.",
      "SPECIFIC_TOPIC",
    )
    expect(ac.recomendarRepresentante).toBe(true)
    expect(ac.guidance).toMatch(/acompañamiento sindical/i)
    expect(ac.chips.some((c) => /pruebas debo guardar/i.test(c))).toBe(true)
  })

  it("vacaciones negadas → explicar + representante si conflicto", () => {
    const ac = classifyAcompañamiento("Me negaron las vacaciones.", "SPECIFIC_TOPIC")
    expect(ac.kind).toBe("conflicto")
    expect(ac.recomendarRepresentante).toBe(true)
  })

  it("pregunta simple de aguinaldo → NO recomendación de sindicato", () => {
    const ac = classifyAcompañamiento("¿Cuánto aguinaldo me corresponde?", classifyRetrievalIntent("¿Cuánto aguinaldo me corresponde?"))
    expect(ac.kind).toBe("informativo")
    expect(ac.recomendarRepresentante).toBe(false)
    expect(ac.chips).toEqual([])
  })

  it("referencia exacta cláusula 63 Bis → NO acompañamiento", () => {
    const ac = classifyAcompañamiento("¿Qué dice la cláusula 63 Bis?", classifyRetrievalIntent("¿Qué dice la cláusula 63 Bis?"))
    expect(ac.recomendarRepresentante).toBe(false)
    expect(ac.kind).toBe("informativo")
  })

  it("consultas informativas de días/prestaciones no disparan representante", () => {
    for (const q of ["¿Cuántos días de vacaciones me corresponden?", "¿Qué es el concepto 37?", "¿Cuándo me toca el tabulador?"]) {
      expect(classifyAcompañamiento(q, classifyRetrievalIntent(q)).recomendarRepresentante).toBe(false)
    }
  })

  it("agresión física / riesgo → SEGURIDAD primero", () => {
    const ac = classifyAcompañamiento("Mi jefe me agredió físicamente.", "SPECIFIC_TOPIC")
    expect(ac.kind).toBe("seguridad")
    expect(ac.recomendarRepresentante).toBe(true)
    expect(ac.guidance).toMatch(/SEGURIDAD PRIMERO/i)
  })

  it("caso real del test #9: agrede y hostiga → conflicto + acompañamiento", () => {
    const q = "Si un jefe me agrede y hostiga como puedo comprobarlo y evidenciarlo?"
    const ac = classifyAcompañamiento(q, classifyRetrievalIntent(q))
    expect(["conflicto", "seguridad"]).toContain(ac.kind)
    expect(ac.recomendarRepresentante).toBe(true)
    expect(ac.chips.length).toBeGreaterThan(0)
  })

  it("caso de seguridad fuerza agresión en curso", () => {
    const ac = classifyAcompañamiento("Hay una agresión en curso en mi área.", "SPECIFIC_TOPIC")
    expect(ac.kind).toBe("seguridad")
  })
})

describe("isContinuation — contexto conversacional (punto 11)", () => {
  it("'Ya tengo mensajes de WhatsApp' continua el caso previo", () => {
    expect(isContinuation("Ya tengo mensajes de WhatsApp.", true)).toBe(true)
  })

  it("'Eso puede ayudarte' NO es continuación (es respuesta)", () => {
    // Deíctico de caso previo pero sin historial laboral previo → no
    expect(isContinuation("¿y eso a quién le consta?", false)).toBe(false)
  })

  it("'Mi jefe me está hostigando' con contexto previo → continuación", () => {
    expect(isContinuation("Mi jefe me está hostigando.", true)).toBe(true)
  })

  it("pregunta nueva sin deíctico no es continuación", () => {
    expect(isContinuation("¿Cuánto aguinaldo me corresponde?", true)).toBe(false)
  })
})
