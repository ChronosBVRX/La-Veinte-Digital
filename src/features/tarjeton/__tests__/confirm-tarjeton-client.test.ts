import { describe, it, expect, vi, afterEach } from "vitest"
import { confirmTarjetonClient } from "../services/confirm-tarjeton-client"
import type { ConfirmTarjetonRequest } from "@/shared/contracts/tarjeton-import"

const mockRequest: ConfirmTarjetonRequest = {
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
      periodRaw: "2A-AGO-2026",
      year: 2026,
      month: 8,
      half: 2,
    },
    employee: {
      employeeNumber: "123456",
      fullName: "Trabajador Prueba",
      categoryName: "Auxiliar",
    },
    attendance: {},
    vacations: {},
    payroll: {
      earnings: [
        { lineIndex: 0, code: "002", description: "SUELDO BASE", amount: 4000, kind: "earning", confidence: 1, confirmedByUser: true },
      ],
      deductions: [],
      observations: [],
      totalEarnings: 4000,
      totalDeductions: 0,
      netPay: 4000,
    },
    extraction: {
      method: "native_text",
      globalConfidence: 1,
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
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("confirmTarjetonClient", () => {
  it("retorna ok: true con los datos cuando la respuesta es exitosa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          id: "payslip-new-id",
          duplicate: false,
          profileUpdated: true,
          payrollContextUpdated: true,
        }),
      }) as Response),
    )

    const result = await confirmTarjetonClient(mockRequest)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.id).toBe("payslip-new-id")
    }
  })

  it("normaliza error cuando el backend responde con { error, code } (ej. profile_init_failed)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({
          error: "No se pudo preparar tu perfil para guardar el tarjetón.",
          code: "profile_init_failed",
          requestId: "req-abc-123",
        }),
      }) as unknown as Response),
    )

    const result = await confirmTarjetonClient(mockRequest)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("profile_init_failed")
      expect(result.error.message).toBe("No se pudo preparar tu perfil para guardar el tarjetón.")
      expect((result.error as { requestId?: string }).requestId).toBe("req-abc-123")
    }
  })

  it("normaliza error cuando el backend responde con { message, code }", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 422,
        json: async () => ({
          code: "totals_mismatch",
          message: "Los totales no cuadran con las percepciones.",
        }),
      }) as unknown as Response),
    )

    const result = await confirmTarjetonClient(mockRequest)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("totals_mismatch")
      expect(result.error.message).toBe("Los totales no cuadran con las percepciones.")
    }
  })

  it("maneja fallo de red con mensaje claro y amigable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Network request failed")
      }),
    )

    const result = await confirmTarjetonClient(mockRequest)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("internal")
      expect(result.error.message).toContain("No hay conexión con el servidor")
    }
  })

  it("maneja status 401 cuando la sesión ha expirado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => {
          throw new Error("not json")
        },
      }) as unknown as Response),
    )

    const result = await confirmTarjetonClient(mockRequest)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized")
      expect(result.error.message).toContain("Tu sesión expiró")
    }
  })
})
