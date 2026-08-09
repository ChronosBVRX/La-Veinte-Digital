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
  it("acepta campos opcionales de extracción y antigüedad", async () => {
    const rpc = async (_fn: string, args: Record<string, unknown>) => {
      const parsed = args.p_parsed as ConfirmTarjetonRequest["parsed"]
      expect(parsed.extraction.criticalFieldConfidence).toBe(0.97)
      expect(parsed.extraction.autoConfirmable).toBe(false)
      expect(parsed.extraction.reviewMode).toBe("critical_fields")
      expect(parsed.employee.seniority?.referenceDate).toBe("2026-01-15")
      expect(parsed.employee.seniority?.reconstructedEffectiveDate).toBe("2016-01-01")
      return {
        data: { schemaVersion: "1.0", id: "abc", duplicate: false, profileUpdated: true, payrollContextUpdated: true },
        error: null,
      }
    }
    const request = makeRequest()
    request.parsed.extraction = {
      ...request.parsed.extraction,
      criticalFieldConfidence: 0.97,
      autoConfirmable: false,
      reviewMode: "critical_fields",
    }
    request.parsed.employee.seniority = {
      raw: "10 AÑOS 0 QNAS 0 DIAS",
      years: 10,
      fortnights: 0,
      days: 0,
      referenceDate: "2026-01-15",
      reconstructedEffectiveDate: "2016-01-01",
      status: "complete",
    }
    const result = await confirmTarjetonService({ userId: "u1", rpc }, request)
    expect(result.ok).toBe(true)
  })

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

  it("normaliza la respuesta del RPC desplegado sin versión de esquema", async () => {
    const rpc = async () => ({
      data: { id: "abc", duplicate: false, profileUpdated: false, payrollContextUpdated: true },
      error: null,
    })
    const result = await confirmTarjetonService({ userId: "u1", rpc }, makeRequest())
    expect(result).toMatchObject({ ok: true, data: { schemaVersion: "1.0", id: "abc" } })
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

  it("rechaza cualquier intento de actualizar adscripción", async () => {
    const rpc = async () => ({ data: null, error: null })
    const request = makeRequest()
    ;(request.profileUpdates as Record<string, boolean>).adscripcion = true
    ;(request.parsed.employee as Record<string, unknown>).assignmentName = "UNIDAD NO PERMITIDA"
    const result = await confirmTarjetonService({ userId: "u1", rpc }, request)
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_payload" } })
  })

  it("permite confirmar cuando un total no fue legible y no hay discrepancia comprobable", async () => {
    const request = makeRequest()
    delete request.parsed.payroll.netPay
    const rpc = async () => ({
      data: { id: "abc", duplicate: false, profileUpdated: false, payrollContextUpdated: true },
      error: null,
    })
    const result = await confirmTarjetonService({ userId: "u1", rpc }, request)
    expect(result.ok).toBe(true)
  })

  it("rechaza conceptos que el trabajador no confirmó", async () => {
    const request = makeRequest()
    request.parsed.payroll.earnings[0].confirmedByUser = false
    const rpc = async () => ({ data: null, error: null })
    const result = await confirmTarjetonService({ userId: "u1", rpc }, request)
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_payload" } })
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

  it("detecta confirmación duplicada como protección de concurrencia", async () => {
    let calls = 0
    const rpc = async () => {
      calls++
      if (calls === 1) {
        return {
          data: { id: "abc", duplicate: false, profileUpdated: true, payrollContextUpdated: true },
          error: null,
        }
      }
      return { data: null, error: { message: "duplicate key value violates unique constraint" } }
    }

    const request = makeRequest()
    const first = await confirmTarjetonService({ userId: "u1", rpc }, request)
    const second = await confirmTarjetonService({ userId: "u1", rpc }, request)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.error.code).toBe("duplicate")
  })
})

describe("validacion de contrato seniority (parsed/status)", () => {
  function makeRpc() {
    return async () => ({
      data: { schemaVersion: "1.0", id: "test-payslip-1", duplicate: false, profileUpdated: false, payrollContextUpdated: false },
      error: null,
    })
  }

  it("acepta seniority con parsed y status completos", async () => {
    const rpc = makeRpc()
    const request = makeRequest({
      parsed: {
        ...makeRequest().parsed,
        employee: {
          ...makeRequest().parsed.employee,
          seniority: {
            raw: "14 anos 3 qnas 1 dias",
            years: 14,
            fortnights: 3,
            days: 1,
            parsed: { years: 14, fortnights: 3, days: 1 },
            status: "complete",
          },
        },
        extraction: {
          ...makeRequest().parsed.extraction,
          validations: { ...makeRequest().parsed.extraction.validations, templateDetected: true },
        },
      },
    })

    const result = await confirmTarjetonService({ userId: "u1", rpc }, request)
    expect(result.ok).toBe(true)
  })

  it("rechaza campo desconocido en seniority", async () => {
    const rpc = makeRpc()
    const badSeniority = {
      raw: "1 a",
      years: 1, fortnights: 0, days: 0, parsed: { years: 1, fortnights: 0, days: 0 },
      status: "complete", desconocido: true,
    }
    const request = makeRequest({
      parsed: {
        ...makeRequest().parsed,
        employee: { ...makeRequest().parsed.employee, seniority: badSeniority as never },
        extraction: {
          ...makeRequest().parsed.extraction,
          validations: { ...makeRequest().parsed.extraction.validations, templateDetected: true },
        },
      },
    })

    const result = await confirmTarjetonService({ userId: "u1", rpc }, request)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("invalid_payload")
  })

  it("rechaza campo desconocido en seniority.parsed", async () => {
    const rpc = makeRpc()
    const request = makeRequest({
      parsed: {
        ...makeRequest().parsed,
        employee: {
          ...makeRequest().parsed.employee,
          seniority: {
            raw: "1 a", years: 1, fortnights: 0, days: 0,
            parsed: { years: 1, fortnights: 0, days: 0, meses: 12 } as never,
            status: "complete",
          },
        },
        extraction: {
          ...makeRequest().parsed.extraction,
          validations: { ...makeRequest().parsed.extraction.validations, templateDetected: true },
        },
      },
    })

    const result = await confirmTarjetonService({ userId: "u1", rpc }, request)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("invalid_payload")
  })

  it("rechaza status invalido", async () => {
    const rpc = makeRpc()
    const request = makeRequest({
      parsed: {
        ...makeRequest().parsed,
        employee: {
          ...makeRequest().parsed.employee,
          seniority: {
            raw: "1 a", years: 1, fortnights: 0, days: 0,
            parsed: { years: 1, fortnights: 0, days: 0 },
            status: "invalido" as never,
          },
        },
        extraction: {
          ...makeRequest().parsed.extraction,
          validations: { ...makeRequest().parsed.extraction.validations, templateDetected: true },
        },
      },
    })

    const result = await confirmTarjetonService({ userId: "u1", rpc }, request)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe("invalid_payload")
  })
})
