import { describe, it, expect } from "vitest"
import { scoreTopicHeuristic } from "../services/radar-scoring"

describe("Radar Scoring Service (Heuristic)", () => {
  it("scores high and categorizes NOMINA for salary/concept 050 topics", () => {
    const title = "Dudas sobre el pago del Concepto 050 de asistencia en la próxima quincena"
    const snippet = "Muchos trabajadores del IMSS y agremiados del SNTSS reportan inconsistencias en su tarjetón con el estímulo de puntualidad y asistencia."

    const res = scoreTopicHeuristic(title, snippet)
    expect(res.category).toBe("NOMINA")
    expect(res.relevanceScore).toBeGreaterThanOrEqual(70)
    expect(res.isRealInterest).toBe(true)
    expect(res.relatedClause).toContain("Cláusula 91")
  })

  it("scores high and categorizes ESCALAFON for job board / cambio de rama", () => {
    const title = "Publican resultados de la convocatoria de bolsa de trabajo y cambio de rama"
    const snippet = "La comisión mixta de escalafón del SNTSS e IMSS liberó las listas de prelación de plazas disponibles."

    const res = scoreTopicHeuristic(title, snippet)
    expect(res.category).toBe("ESCALAFON")
    expect(res.relevanceScore).toBeGreaterThanOrEqual(70)
    expect(res.isRealInterest).toBe(true)
  })

  it("penalizes and discards patient complaints about wait times", () => {
    const title = "Derechohabiente denuncia fila de espera en urgencias del IMSS"
    const snippet = "Pacientes molestos se quejan de que no hay citas en la app y pasaron más de 8 horas esperando atención médica."

    const res = scoreTopicHeuristic(title, snippet)
    expect(res.isRealInterest).toBe(false)
    expect(res.relevanceScore).toBeLessThan(60)
  })
})
