import { describe, expect, it } from "vitest"
import { confirmTarjetonService } from "../services/confirm-tarjeton"
import type { ConfirmTarjetonRequest } from "@/shared/contracts/tarjeton-import"

function makeRequest(overrides: Partial<ConfirmTarjetonRequest> = {}): ConfirmTarjetonRequest {
  return {
    schemaVersion: "1.0",
    sourceHash: "a".repeat(64),
    acknowledgeTotalDifference: false,
    authorizeServerStorage: true,
    profileUpdates: { matricula: false },
    parsed: {
      schemaVersion: "1.0",
      document: {
        type: "imss_payroll_receipt",
        pageCount: 1,
        periodRaw: "1A-ENE-2026",
        year: 2026,
        month: 1,
        half: 1,
      },
      employee: {
        employeeNumber: "123456",
        fullName: "MARIA JOSE GARCIA RUIZ",
        categoryName: "ENFERMERA GENERAL 80",
      },
      attendance: {},
      vacations: {},
      payroll: {
        earnings: [
          { lineIndex: 0, code: "002", description: "SUELDO BASE", amount: 3937.64, kind: "earning", confidence: 0.98, confirmedByUser: true },
          { lineIndex: 1, code: "011", description: "PRESTACIONES", amount: 3234.77, kind: "earning", confidence: 0.98, confirmedByUser: true },
        ],
        deductions: [
          { lineIndex: 2, code: "212", description: "ISR", amount: -1234.56, kind: "deduction", confidence: 0.98, confirmedByUser: true },
        ],
        observations: [],
        totalEarnings: 7172.41,
        totalDeductions: 1234.56,
        netPay: 5937.85,
      },
      extraction: {
        method: "native_text",
        globalConfidence: 0.98,
        warnings: [],
        validations: {
          templateDetected: true,
          earningsTotalMatches: null,
          deductionsTotalMatches: null,
          netPayMatches: null,
          employeeMatchesProfile: null,
          categoryResolved: null,
        },
      },
    },
    ...overrides,
  }
}

describe("confirm-tarjeton service", () => {
  it("acepta un tarjetón válido y devuelve la respuesta del RPC", async () => {
    const rpc = async (fn: string, args: Record<string, unknown>) => {
      expect(fn).toBe("confirm_imported_payslip")
      expect(args.p_source_hash).toBe("a".repeat(64))
      expect(args.p_acknowledge_total_difference).toBe(false)
      return {
        data: { schemaVersion: "1.0", id: "abc-123", duplicate: false, profileUpdated: true, payrollContextUpdated: true },
        error: null,
      }
    }

    const result = await confirmTarjetonService({ userId: "u1", rpc }, makeRequest())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toMatchObject({ id: "abc-123", duplicate: false, profileUpdated: true })
  })

  it("rechaza totales que no cuadran sin reconocimiento explícito", async () => {
    const rpc = async () => ({ data: null, error: null })
    const result = await confirmTarjetonService({ userId: "u1", rpc }, makeRequest({
      parsed: {
        ...makeRequest().parsed,
        payroll: {
          ...makeRequest().parsed.payroll,
          totalEarnings: 9999.99,
        },
      },
    }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("totals_mismatch")
  })

  it("permite totales que no cuadran si el trabajador lo reconoce", async () => {
    const rpc = async () => ({
      data: { schemaVersion: "1.0", id: "abc", duplicate: false, profileUpdated: false, payrollContextUpdated: true },
      error: null,
    })
    const result = await confirmTarjetonService({ userId: "u1", rpc }, makeRequest({
      acknowledgeTotalDifference: true,
      parsed: {
        ...makeRequest().parsed,
        payroll: {
          ...makeRequest().parsed.payroll,
          totalEarnings: 9999.99,
        },
      },
    }))
    expect(result.ok).toBe(true)
  })

  it("rechaza claves sensibles enviadas por error (whitelist estricta)", async () => {
    const rpc = async () => ({ data: null, error: null })

    const request = makeRequest()
    ;(request.parsed as unknown as Record<string, unknown>).rfc = "ROGA900101HX0"

    const result = await confirmTarjetonService({ userId: "u1", rpc }, request)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("invalid_payload")
  })

  it("rechaza claves extra en subobjetos del contrato", async () => {
    const rpc = async () => ({ data: null, error: null })

    const withEmployeeExtra = makeRequest()
    ;(withEmployeeExtra.parsed.employee as unknown as Record<string, unknown>).cuentaBancaria = "0123456789"
    expect(await confirmTarjetonService({ userId: "u1", rpc }, withEmployeeExtra)).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })

    const withDocExtra = makeRequest()
    ;(withDocExtra.parsed.document as unknown as Record<string, unknown>).codigoQR = "data:image/png;base64,..."
    expect(await confirmTarjetonService({ userId: "u1", rpc }, withDocExtra)).toMatchObject({
      ok: false,
      error: { code: "invalid_payload" },
    })
  })

  it("envía el consentimiento al RPC", async () => {
    let sentArgs: Record<string, unknown> | null = null
    const rpc = async (_fn: string, args: Record<string, unknown>) => {
      sentArgs = args
      return {
        data: { schemaVersion: "1.0", id: "abc", duplicate: false, profileUpdated: false, payrollContextUpdated: false },
        error: null,
      }
    }

    const result = await confirmTarjetonService({ userId: "u1", rpc }, makeRequest())
    expect(result.ok).toBe(true)
    expect(sentArgs).not.toBeNull()
    expect(sentArgs!.p_authorize_server_storage).toBe(true)
  })

  it("mapea consent_required del RPC al código del contrato", async () => {
    const rpc = async () => ({ data: null, error: { message: "consent_required" } })
    const result = await confirmTarjetonService({ userId: "u1", rpc }, makeRequest())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("consent_required")
  })

  it("rechaza cuerpos que no cumplen el contrato", async () => {
    const rpc = async () => ({ data: null, error: null })
    const result = await confirmTarjetonService({ userId: "u1", rpc }, { schemaVersion: "0.9" })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("invalid_payload")
  })

  it("mapea los errores del RPC a códigos del contrato", async () => {
    const rpc = async () => ({ data: null, error: { message: "matricula_mismatch" } })
    const result = await confirmTarjetonService({ userId: "u1", rpc }, makeRequest())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("matricula_mismatch")
  })
})
