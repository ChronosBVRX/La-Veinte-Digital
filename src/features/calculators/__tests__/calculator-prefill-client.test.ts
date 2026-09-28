// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  clearCalculatorPrefillCache,
  fetchCalculatorPrefill,
} from "../services/calculator-prefill-client"
import type { CalculatorPrefillResponse } from "@/shared/contracts/calculator-prefill"

const MOCK_PREFILL_RESPONSE: CalculatorPrefillResponse = {
  schemaVersion: "1.0",
  calculatorId: "segunda-julio",
  targetDate: "2026-09-27",
  generatedAt: "2026-09-27T18:00:00.000Z",
  categoryResolved: true,
  categoryResolutionStatus: "resolved",
  fields: {
    concepto002: {
      value: 6200,
      source: "last_payslip",
      confidence: "high",
      effectiveAt: "2026-09-15",
      editable: true,
    },
    concepto011: {
      value: 2800,
      source: "last_payslip",
      confidence: "high",
      effectiveAt: "2026-09-15",
      editable: true,
    },
  },
  missingFacts: [],
  warnings: [],
}

describe("calculator-prefill-client SWR cache & invalidation", () => {
  beforeEach(() => {
    clearCalculatorPrefillCache()
    vi.restoreAllMocks()
  })

  it("caches response in memory within session and avoids duplicate network calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_PREFILL_RESPONSE,
    })
    vi.stubGlobal("fetch", fetchMock)

    const first = await fetchCalculatorPrefill("segunda-julio", "2026-09-27")
    const second = await fetchCalculatorPrefill("segunda-julio", "2026-09-27")

    expect(first).toEqual(MOCK_PREFILL_RESPONSE)
    expect(second).toEqual(MOCK_PREFILL_RESPONSE)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("immediately invalidates cache when nomina_payslip_updated is dispatched", async () => {
    const updatedResponse: CalculatorPrefillResponse = {
      ...MOCK_PREFILL_RESPONSE,
      fields: {
        ...MOCK_PREFILL_RESPONSE.fields,
        concepto002: {
          value: 7100,
          source: "last_payslip",
          confidence: "high",
          effectiveAt: "2026-09-27",
          editable: true,
        },
      },
    }

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_PREFILL_RESPONSE,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => updatedResponse,
      })
    vi.stubGlobal("fetch", fetchMock)

    const beforeEvent = await fetchCalculatorPrefill("segunda-julio", "2026-09-27")
    expect(beforeEvent?.fields.concepto002?.value).toBe(6200)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Al subir un nuevo tarjetón se emite nomina_payslip_updated -> invalida al instante
    window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))

    const afterEvent = await fetchCalculatorPrefill("segunda-julio", "2026-09-27")
    expect(afterEvent?.fields.concepto002?.value).toBe(7100)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
