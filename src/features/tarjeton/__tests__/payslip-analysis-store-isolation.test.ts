// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import {
  savePayslipAnalysis,
  getPayslipAnalysisByHash,
  getLatestPayslipAnalysis,
  CURRENT_PARSER_VERSION,
  type PayslipAnalysis,
} from "@/features/tarjeton/services/payslip-analysis-store"

const USER_A = "user-a-uuid"
const USER_B = "user-b-uuid"

function makeAnalysis(hash: string, documentId: string, netAmount: number): PayslipAnalysis {
  return {
    documentId,
    documentHash: hash,
    parserVersion: CURRENT_PARSER_VERSION,
    period: "1A-SEP-2026",
    periodRank: 1,
    perceptionsTotal: netAmount,
    deductionsTotal: 0,
    netAmount,
    concepts: [{ code: "002", description: "SUELDO", amount: netAmount, kind: "perception" }],
    status: "ready",
    analyzedAt: "2026-09-01T00:00:00Z",
    errorCode: null,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe("análisis de tarjetón aislado por usuario", () => {
  it("A y B pueden tener el mismo hash sin sobrescribirse", () => {
    savePayslipAnalysis(USER_A, makeAnalysis("same-hash", "doc-a", 111))
    savePayslipAnalysis(USER_B, makeAnalysis("same-hash", "doc-b", 222))

    expect(getPayslipAnalysisByHash(USER_A, "same-hash")?.netAmount).toBe(111)
    expect(getPayslipAnalysisByHash(USER_B, "same-hash")?.netAmount).toBe(222)
  })

  it("el más reciente nunca cruza de usuario", () => {
    savePayslipAnalysis(USER_A, makeAnalysis("hash-a", "doc-a", 111))
    savePayslipAnalysis(USER_B, makeAnalysis("hash-b", "doc-b", 222))

    expect(getLatestPayslipAnalysis(USER_A)?.documentId).toBe("doc-a")
    expect(getLatestPayslipAnalysis(USER_B)?.documentId).toBe("doc-b")
  })

  it("la clave global antigua no se lee", () => {
    localStorage.setItem(
      "la_veinte_payslip_analyses",
      JSON.stringify({ "legacy_hash_2026.09.v1": makeAnalysis("legacy_hash", "legacy", 999) }),
    )

    expect(getLatestPayslipAnalysis(USER_A)).toBeNull()
    expect(getPayslipAnalysisByHash(USER_A, "legacy_hash")).toBeNull()
    // En cuarentena: no se borra.
    expect(localStorage.getItem("la_veinte_payslip_analyses")).not.toBeNull()
  })
})
