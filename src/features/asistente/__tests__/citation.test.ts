import { describe, it, expect } from "vitest"
import {
  finalizeCitation,
  validateCitations,
  type RetrievedSource,
} from "../lib/retrieval-sources"

function src(id: string): RetrievedSource {
  return {
    id,
    chunkId: `chunk-${id}`,
    documentId: "cct-imss-sntss",
    documento: "CCT IMSS-SNTSS 2025-2027",
    version: "v1",
    tipo: "clausula",
    numero: "63",
    paginaInicio: 1,
    paginaFin: 2,
    fragmento: "Cláusula 63 Bis del Contrato Colectivo vigente.",
    sourceUrl: null,
    validity: "CURRENT",
    pendingReview: false,
    score: 200,
  }
}

const SOURCES = [src("S1"), src("S2"), src("S3")]

describe("finalizeCitation — FAIL-CLOSED por validación (punto 18+.5)", () => {
  it("entrega cuando la primera pasada ya tiene cita válida", () => {
    const res = finalizeCitation("El derecho está en [S1].", SOURCES, null)
    expect(res.kind).toBe("deliver")
    if (res.kind === "deliver") {
      expect(res.citedIds).toEqual(["S1"])
      expect(res.respuesta).toContain("[S1]")
    }
  })

  it("limpia citas inválidas y entrega si queda al menos una válida", () => {
    const res = finalizeCitation("Dice [S1] y también [S9].", SOURCES, null)
    expect(res.kind).toBe("deliver")
    if (res.kind === "deliver") {
      expect(res.citedIds).toEqual(["S1"])
      expect(res.respuesta).not.toContain("[S9]")
    }
  })

  it("regenera una sola vez y entrega si la regen logra citar", () => {
    const res = finalizeCitation("No cita nada.", SOURCES, "Ahora sí: [S2].")
    expect(res.kind).toBe("deliver")
    if (res.kind === "deliver") expect(res.citedIds).toEqual(["S2"])
  })

  it("fail-closed si tras la regeneración sigue sin cita válida", () => {
    const res = finalizeCitation("Dice algo sin citar.", SOURCES, "Sigue sin citar.")
    expect(res.kind).toBe("fail_closed")
  })

  it("no entrega texto normativo sin fuente validada (nunca cite vacío)", () => {
    const res = finalizeCitation("Afirmo [S9] que no existe.", SOURCES, "[S9] otra vez.")
    expect(res.kind).toBe("fail_closed")
  })

  it("sin regeneración y sin cita válida → fail-closed (no third LLM)", () => {
    const res = finalizeCitation("Texto sin citas.", SOURCES, null)
    expect(res.kind).toBe("fail_closed")
  })

  it("sin evidencia normativa no hay fallo: deliver inmediato", () => {
    const res = finalizeCitation("Solo saludo.", [], null)
    expect(res.kind).toBe("deliver")
    if (res.kind === "deliver") expect(res.citedIds).toEqual([])
  })
})

describe("validateCitations — saneo de IDs inválidos", () => {
  it("elimina marcadores [S#] inválidos", () => {
    const r = validateCitations("Texto [S1] y [S7].", SOURCES)
    expect(r.respuesta).not.toContain("[S7]")
    expect(r.invalidIdsRemoved).toEqual(["S7"])
  })
})
