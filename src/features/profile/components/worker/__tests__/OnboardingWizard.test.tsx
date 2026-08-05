import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  confirmPayslipProfile: vi.fn(async () => undefined),
  validateConfirmedUpdate: vi.fn(),
  chooseBasicMode: vi.fn(async () => undefined),
  confirmManualProfile: vi.fn(async () => undefined),
  grantConsent: vi.fn(async () => undefined),
  deleteWorkerData: vi.fn(async () => undefined),
  revalidatePath: vi.fn(),
}))

vi.mock("@/shared/server/worker-profile", () => ({
  WorkerProfileService: vi.fn(function () {
    return {
      chooseBasicMode: mocks.chooseBasicMode,
      confirmManualProfile: mocks.confirmManualProfile,
      confirmPayslipProfile: mocks.confirmPayslipProfile,
      grantConsent: mocks.grantConsent,
      deleteWorkerData: mocks.deleteWorkerData,
      validateConfirmedUpdate: mocks.validateConfirmedUpdate,
      getCurrentProfile: vi.fn(async () => ({ state: "unconfigured" as const })),
      getWorkerPreferences: vi.fn(async () => ({ onboardingState: "unconfigured", preferredWorkerMode: null, updatedAt: "2026-01-01" })),
      getProfileQuality: vi.fn(async () => ({ percent: 0, confidence: 0, confirmedCount: 0, manualCount: 0, inferredCount: 0, missingFields: [], recommendations: [], benefitedTools: [] })),
      getFieldRequirements: vi.fn(() => []),
      getEffectiveConsent: vi.fn(async () => null),
      listWorkerEvents: vi.fn(async () => []),
    }
  }),
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import {
  confirmPayslipProfileAction,
  confirmManualProfileAction,
  chooseBasicModeAction,
  grantWorkerConsentAction,
} from "@/features/profile/actions/worker-profile-actions"
import { buildConfirmedPayslipProfileUpdate } from "../build-payslip-update"
import type { ConfirmedWorkerProfileUpdate } from "@/shared/domain/worker"
import { WorkerProfileUnauthorizedError } from "@/shared/server/worker-profile/errors"

describe("confirmPayslipProfileAction metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const draft = {
    mode: "payslip" as const,
    identity: { categoria: "TECNICO" as string | null | undefined },
    situation: { workdayHours: 8 as const, effectiveSeniorityDate: "2020-01-01" as string | null | undefined },
    confirmedFields: ["categoria", "workdayHours", "effectiveSeniorityDate"] as Array<import("@/shared/domain/worker").WorkerFieldName>,
  }

  it("method llega al método del servicio cuando existe", async () => {
    const update = buildConfirmedPayslipProfileUpdate(draft, { method: "native_text" }, "1.0")
    await confirmPayslipProfileAction(update, "native_text", undefined, undefined)
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ extractionMethod: "native_text" }),
    )
  })

  it("confidence llega cuando existe", async () => {
    const update = buildConfirmedPayslipProfileUpdate(draft, { method: "ocr", confidence: 0.95 }, "1.0")
    await confirmPayslipProfileAction(update, "ocr", 0.95, undefined)
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ confidence: 0.95 }),
    )
  })

  it("period llega cuando existe", async () => {
    const update = buildConfirmedPayslipProfileUpdate(draft, { method: "native_text", period: "Q1 2026" }, "1.0")
    await confirmPayslipProfileAction(update, "native_text", undefined, "Q1 2026")
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ period: "Q1 2026" }),
    )
  })

  it("undefined/null cuando no existen", async () => {
    const update = buildConfirmedPayslipProfileUpdate(draft, { method: "native_text" }, "1.0")
    await confirmPayslipProfileAction(update, undefined, undefined, undefined)
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ extractionMethod: undefined, confidence: undefined, period: undefined }),
    )
  })

  it("confirmar llama una sola vez a confirmPayslipProfileAction", async () => {
    const update = buildConfirmedPayslipProfileUpdate(draft, { method: "ocr" }, "1.0")
    await confirmPayslipProfileAction(update, "ocr", undefined, undefined)
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledTimes(1)
    expect(mocks.grantConsent).not.toHaveBeenCalled()
    expect(mocks.confirmManualProfile).not.toHaveBeenCalled()
  })

  it("nunca llama grantWorkerConsentAction", async () => {
    const update = buildConfirmedPayslipProfileUpdate(draft, { method: "native_text" }, "1.0")
    await confirmPayslipProfileAction(update, "native_text", undefined, undefined)
    expect(mocks.grantConsent).not.toHaveBeenCalled()
  })

  it("error de la acción devuelve false y no avanza", async () => {
    mocks.confirmPayslipProfile.mockRejectedValue(new WorkerProfileUnauthorizedError())
    const update = buildConfirmedPayslipProfileUpdate(draft, { method: "native_text" }, "1.0")
    const result = await confirmPayslipProfileAction(update, "native_text", undefined, undefined)
    expect(result.ok).toBe(false)
  })

  it("ningún objeto sensible viaja en los argumentos", async () => {
    const update = buildConfirmedPayslipProfileUpdate(draft, { method: "native_text" }, "1.0")
    await confirmPayslipProfileAction(update, "native_text", 0.5, "Q1")
    const firstArg = mocks.confirmPayslipProfile.mock.calls.length > 0
      ? (mocks.confirmPayslipProfile.mock.calls[0] as unknown[])[0] as unknown as Record<string, unknown>
      : null
    if (firstArg) {
      expect(firstArg).not.toHaveProperty("file")
      expect(firstArg).not.toHaveProperty("pdf")
      expect(firstArg).not.toHaveProperty("base64")
      expect(firstArg).not.toHaveProperty("text")
      expect(firstArg).not.toHaveProperty("parsed")
      expect(firstArg).not.toHaveProperty("userId")
    }
  })
})

describe("buildConfirmedPayslipProfileUpdate — confirm integration", () => {
  it("campos seleccionados aparecen en identity/situation filtrados", () => {
    const d = {
      mode: "payslip" as const,
      identity: { matricula: "M1", categoria: "CAT", adscripcion: "A1" },
      situation: { workdayHours: 8, shift: "matutino" as const, employmentType: "base" as const, effectiveSeniorityDate: "2021-01-01" },
      confirmedFields: ["matricula", "categoria", "workdayHours"] as const,
    }
    const update = buildConfirmedPayslipProfileUpdate(d as unknown as import("@/shared/domain/worker").WorkerProfileDraft, { method: "native_text" }, "1.0")
    expect(update.identity).toEqual({ matricula: "M1", categoria: "CAT" })
    expect(update.identity).not.toHaveProperty("adscripcion")
    expect(update.situation).toEqual({ workdayHours: 8 })
    expect(update.sources).toEqual({ matricula: "payslip_confirmed", categoria: "payslip_confirmed", workdayHours: "payslip_confirmed" })
  })

  it("campo editado aparece corregido en el payload", () => {
    const d = {
      mode: "payslip" as const,
      identity: { categoria: "ORIGINAL", matricula: "M1" },
      situation: {},
      confirmedFields: ["categoria", "matricula"] as const,
    }
    // Simula que el usuario editó categoria
    d.identity.categoria = "CORREGIDO"
    const update = buildConfirmedPayslipProfileUpdate(d as unknown as import("@/shared/domain/worker").WorkerProfileDraft, { method: "ocr" }, "1.0")
    expect(update.identity?.categoria).toBe("CORREGIDO")
  })
})
