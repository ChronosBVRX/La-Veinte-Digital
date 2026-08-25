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
  completePayslipOnboardingAction,
} from "@/features/profile/actions/worker-profile-actions"
import { WorkerProfileUnauthorizedError } from "@/shared/server/worker-profile/errors"

describe("completePayslipOnboardingAction — cierre unificado del flujo tarjetón", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const minimalUpdateShape = () => {
    const call = mocks.confirmPayslipProfile.mock.calls[0] as unknown[] | undefined
    return call?.[0] as Record<string, unknown> | undefined
  }

  it("registra consentimiento store_tarjeton y luego marca configured/payslip", async () => {
    await completePayslipOnboardingAction({ method: "native_text" })
    expect(mocks.grantConsent).toHaveBeenCalledTimes(1)
    expect(mocks.grantConsent).toHaveBeenCalledWith("store_tarjeton", expect.any(String))
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledTimes(1)
    // El update es mínimo: no reescribe campos (ya los guardó la confirmación canónica).
    const update = minimalUpdateShape()
    expect(update).toBeDefined()
    expect(update?.identity).toEqual({})
    expect(update?.situation).toEqual({})
    expect(update?.sources).toEqual({})
    expect(update?.mode).toBe("payslip")
  })

  it("metadata de extracción viaja al servicio cuando es válida", async () => {
    await completePayslipOnboardingAction({ method: "ocr", confidence: 0.95, period: "Q1 2026" })
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ extractionMethod: "ocr", confidence: 0.95, period: "Q1 2026" }),
    )
  })

  it("método inválido se descarta (la RPC solo acepta native_text|ocr|hybrid)", async () => {
    await completePayslipOnboardingAction({ method: "desconocido" as never })
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ extractionMethod: undefined }),
    )
  })

  it("confianza fuera de rango se descarta", async () => {
    await completePayslipOnboardingAction({ confidence: 1.5 })
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ confidence: undefined }),
    )
  })

  it("sin metadata no inventa valores", async () => {
    await completePayslipOnboardingAction()
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ extractionMethod: undefined, confidence: undefined, period: undefined }),
    )
  })

  it("fallo al marcar onboarding devuelve error sin ocultar la causa técnica", async () => {
    mocks.confirmPayslipProfile.mockRejectedValue(new WorkerProfileUnauthorizedError())
    const result = await completePayslipOnboardingAction({ method: "native_text" })
    expect(result.ok).toBe(false)
  })

  it("ningún objeto sensible viaja en los argumentos", async () => {
    await completePayslipOnboardingAction({ method: "native_text", confidence: 0.5, period: "Q1" })
    const firstArg = minimalUpdateShape()
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
