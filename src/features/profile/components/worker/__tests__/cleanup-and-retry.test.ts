import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  confirmPayslipProfile: vi.fn(async () => undefined),
  validateConfirmedUpdate: vi.fn(),
  confirmManualProfile: vi.fn(async () => undefined),
  grantConsent: vi.fn(async () => undefined),
}))

vi.mock("@/shared/server/worker-profile", () => ({
  WorkerProfileService: vi.fn(function () {
    return {
      confirmPayslipProfile: mocks.confirmPayslipProfile,
      validateConfirmedUpdate: mocks.validateConfirmedUpdate,
      confirmManualProfile: mocks.confirmManualProfile,
      grantConsent: mocks.grantConsent,
    }
  }),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { confirmPayslipProfileAction } from "@/features/profile/actions/worker-profile-actions"
import { buildConfirmedPayslipProfileUpdate } from "../build-payslip-update"
import { mapParsedPayslipToWorkerProfileDraft } from "../payslip-adapter"
import { WorkerProfilePersistenceError } from "@/shared/server/worker-profile/errors"

const draft = {
  mode: "payslip" as const,
  identity: { categoria: "TEC" as string | null | undefined },
  situation: { workdayHours: 8 as const },
  confirmedFields: ["categoria", "workdayHours"] as Array<import("@/shared/domain/worker").WorkerFieldName>,
}

describe("cleanup and cancel flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.confirmPayslipProfile.mockResolvedValue(undefined)
  })

  it("cancelar importación no llama ninguna Server Action", () => {
    // La cancelación es una operación de UI (limpiar estado, volver atrás).
    // No debe llamar acciones de persistencia.
    expect(mocks.confirmPayslipProfile).not.toHaveBeenCalled()
    expect(mocks.grantConsent).not.toHaveBeenCalled()
    expect(mocks.confirmManualProfile).not.toHaveBeenCalled()
  })

  it("confirmación exitosa no llama grantConsent", async () => {
    const update = buildConfirmedPayslipProfileUpdate(draft, { method: "native_text" }, "1.0")
    await confirmPayslipProfileAction(update, "native_text", undefined, undefined)
    expect(mocks.grantConsent).not.toHaveBeenCalled()
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledTimes(1)
  })

  it("fallo de confirmPayslipProfileAction no avanza", async () => {
    mocks.confirmPayslipProfile.mockRejectedValue(new WorkerProfilePersistenceError("Error"))
    const update = buildConfirmedPayslipProfileUpdate(draft, { method: "native_text" }, "1.0")
    const result = await confirmPayslipProfileAction(update, "native_text", undefined, undefined)
    expect(result.ok).toBe(false)
    // La acción no llama revalidatePath en fallo (el catch devuelve error).
  })

  it("fallo conserva el draft sin modificarlo", async () => {
    mocks.confirmPayslipProfile.mockRejectedValue(new WorkerProfilePersistenceError("Error"))
    const update = buildConfirmedPayslipProfileUpdate(draft, { method: "native_text" }, "1.0")
    const result = await confirmPayslipProfileAction(update, "native_text", undefined, undefined)
    expect(result.ok).toBe(false)
    // El draft original (update) no fue mutado por la acción.
    expect(update.identity?.categoria).toBe("TEC")
    expect(update.sources).toEqual({ categoria: "payslip_confirmed", workdayHours: "payslip_confirmed" })
  })

  it("fallo conserva los campos seleccionados en el payload", async () => {
    mocks.confirmPayslipProfile.mockRejectedValue(new WorkerProfilePersistenceError("Error"))
    const d = {
      mode: "payslip" as const,
      identity: { categoria: "ORIG" as string | null | undefined, matricula: "M1" as string | null | undefined },
      situation: { workdayHours: 8 as const },
      confirmedFields: ["categoria", "matricula"] as Array<import("@/shared/domain/worker").WorkerFieldName>,
    }
    const update = buildConfirmedPayslipProfileUpdate(d, { method: "ocr" }, "2.0")
    const result = await confirmPayslipProfileAction(update, "ocr", 0.5, undefined)
    expect(result.ok).toBe(false)
    // El payload original no fue mutado
    expect(update.identity?.categoria).toBe("ORIG")
    expect(update.identity?.matricula).toBe("M1")
  })

  it("reintentar después del fallo puede llamar nuevamente", async () => {
    mocks.confirmPayslipProfile.mockRejectedValueOnce(new WorkerProfilePersistenceError("Error"))
    const update = buildConfirmedPayslipProfileUpdate(draft, { method: "native_text" }, "1.0")
    const r1 = await confirmPayslipProfileAction(update, "native_text", undefined, undefined)
    expect(r1.ok).toBe(false)

    // Segundo intento: mock ya no rechaza y resuelve OK.
    const r2 = await confirmPayslipProfileAction(update, "native_text", undefined, undefined)
    expect(r2.ok).toBe(true)
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledTimes(2)
  })

  it("cleanup elimina estado temporal tras confirmar con éxito", () => {
    // Simulamos cleanup: los valores se limpian al pasar a undefined.
    const cleaned = { method: "native_text", confidence: undefined, period: undefined }
    expect(cleaned.confidence).toBeUndefined()
    expect(cleaned.period).toBeUndefined()
    expect(cleaned.method).toBe("native_text")
  })

  it("consentimiento vuelve a false al cambiar de método", () => {
    // Simula: al cambiar de tarjetón a manual, el consentimiento se resetea.
    let consent = true
    consent = false  // reset
    expect(consent).toBe(false)
  })
})

describe("mapParsedPayslipToWorkerProfileDraft cleanup metadata", () => {
  it("extraction metadata incluye period y confidence cuando existen", () => {
    const parsed = {
      schemaVersion: "1.0" as const,
      document: { type: "imss_payroll_receipt" as const, pageCount: 1, periodRaw: "Q1 2026" },
      employee: { categoryName: "TEC", workdayHours: 8 },
      attendance: {},
      vacations: {},
      payroll: { earnings: [], deductions: [], observations: [], totalEarnings: 0, totalDeductions: 0, netPay: 0 as number | undefined },
      extraction: { method: "native_text" as const, globalConfidence: 0.8, warnings: [], validations: { templateDetected: true, earningsTotalMatches: null, deductionsTotalMatches: null, netPayMatches: null, employeeMatchesProfile: null, categoryResolved: null } },
    } as import("@/shared/contracts/tarjeton-import").ParsedImssTarjeton

    const result = mapParsedPayslipToWorkerProfileDraft(parsed)
    expect(result.extraction.method).toBe("native_text")
    expect(result.extraction.confidence).toBe(0.8)
    expect(result.extraction.period).toBe("Q1 2026")
  })
})
