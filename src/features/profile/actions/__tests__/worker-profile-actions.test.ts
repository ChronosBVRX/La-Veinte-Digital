import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  chooseBasicModeAction,
  confirmManualProfileAction,
  deleteWorkerDataAction,
  grantWorkerConsentAction,
  revokeWorkerConsentAction,
} from "../worker-profile-actions"
import { WorkerProfileUnauthorizedError } from "@/shared/server/worker-profile/errors"

const mocks = vi.hoisted(() => ({
  chooseBasicMode: vi.fn(),
  confirmManualProfile: vi.fn(),
  grantConsent: vi.fn(),
  revokeConsent: vi.fn(),
  deleteWorkerData: vi.fn(),
  validateConfirmedUpdate: vi.fn(),
}))

vi.mock("@/shared/server/worker-profile", () => ({
  WorkerProfileService: vi.fn(function () {
    return {
      chooseBasicMode: mocks.chooseBasicMode,
      confirmManualProfile: mocks.confirmManualProfile,
      grantConsent: mocks.grantConsent,
      revokeConsent: mocks.revokeConsent,
      deleteWorkerData: mocks.deleteWorkerData,
      validateConfirmedUpdate: mocks.validateConfirmedUpdate,
    }
  }),
}))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

describe("worker profile server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chooseBasicMode.mockResolvedValue(undefined)
    mocks.confirmManualProfile.mockResolvedValue(undefined)
    mocks.grantConsent.mockResolvedValue(undefined)
    mocks.revokeConsent.mockResolvedValue(undefined)
    mocks.deleteWorkerData.mockResolvedValue(undefined)
    mocks.validateConfirmedUpdate.mockReturnValue(undefined as never)
  })

  it("confirmManualProfileAction llama una sola vez al servicio y no llama grantConsent por separado", async () => {
    const result = await confirmManualProfileAction({
      mode: "manual", sourceOfRequest: "manual",
      identity: { categoria: "X" },
      situation: {},
      sources: { categoria: "manual" },
      consentRef: { purpose: "use_worker_data", version: "1.0" },
    })
    expect(result.ok).toBe(true)
    expect(mocks.confirmManualProfile).toHaveBeenCalledTimes(1)
    expect(mocks.grantConsent).not.toHaveBeenCalled()
  })

  it("input no contiene userId", async () => {
    const update = {
      mode: "manual" as const, sourceOfRequest: "manual" as const,
      identity: {}, situation: {},
      sources: {},
      consentRef: { purpose: "use_worker_data" as const, version: "1.0" },
    }
    await confirmManualProfileAction(update)
    const called = mocks.confirmManualProfile.mock.calls[0][0]
    expect(called).not.toHaveProperty("userId")
  })

  it("deleteWorkerDataAction rechaza cualquier texto distinto de BORRAR", async () => {
    let result = await deleteWorkerDataAction("")
    if (result.ok) throw new Error("debió fallar")
    expect(result.message).toContain("BORRAR")

    result = await deleteWorkerDataAction("borrar")
    expect(result.ok).toBe(false)

    result = await deleteWorkerDataAction("BORRAR")
    expect(result.ok).toBe(true)
    expect(mocks.deleteWorkerData).toHaveBeenCalledTimes(1)
  })

  it("errores del servicio se convierten en mensajes funcionales", async () => {
    mocks.chooseBasicMode.mockRejectedValue(new Error("consent_required"))
    const result = await chooseBasicModeAction()
    if (result.ok) throw new Error("debió fallar")
    expect(result.message).toBeTruthy()
    expect(result.message).not.toContain("consent_required")
    expect(result.message).not.toContain("Error")
  })

  it("ningún mensaje devuelve SQL, UUID, policy o RLS", async () => {
    mocks.confirmManualProfile.mockRejectedValue(new Error("relation worker_preferences does not exist"))
    const result = await confirmManualProfileAction({
      mode: "manual", sourceOfRequest: "manual",
      identity: {}, situation: {}, sources: {},
      consentRef: { purpose: "use_worker_data", version: "1.0" },
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("debió fallar")
    expect(result.message).not.toContain("worker_preferences")
    expect(result.message).not.toContain("relation")
    expect(result.message).not.toContain("policy")
    expect(result.message).not.toContain("exist")
  })

  it("chooseBasicModeAction devuelve error funcional en fallo", async () => {
    mocks.chooseBasicMode.mockRejectedValue(new WorkerProfileUnauthorizedError())
    const result = await chooseBasicModeAction()
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error("debió fallar")
    expect(result.message).toBe("No autenticado.")
  })

  it("grantWorkerConsentAction no envía userId ni accepted_source", async () => {
    await grantWorkerConsentAction("use_worker_data", "1.0")
    expect(mocks.grantConsent).toHaveBeenCalledWith("use_worker_data", "1.0")
    const callArgs = mocks.grantConsent.mock.calls[0]
    expect(callArgs).not.toContain("accepted_source" as never)
    expect(callArgs).not.toContain("userId" as never)
  })

  it("revokeWorkerConsentAction llama revokeConsent purpose", async () => {
    await revokeWorkerConsentAction("use_worker_data")
    expect(mocks.revokeConsent).toHaveBeenCalledWith("use_worker_data")
  })
})
