// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  buildOfflineWorkerSnapshot,
  syncOfflineSnapshotToNative,
} from "../offline-snapshot-sync"

describe("offline-snapshot-sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp
    delete (window as unknown as { laVeintePdfBridge?: unknown }).laVeintePdfBridge
  })

  afterEach(() => {
    delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp
    delete (window as unknown as { laVeintePdfBridge?: unknown }).laVeintePdfBridge
  })

  it("builds a complete offline snapshot integrating Concept 002 + Concept 011", () => {
    const snapshot = buildOfflineWorkerSnapshot({
      ownerId: "user-abc-123",
      nowMs: 1727480000000,
      workerContext: {
        meta: {
          contextRevision: "rev-9",
          activePayslipPeriod: "2026-Q18",
        },
        profile: {
          fullName: "Juan Pérez",
          matricula: "99887766",
          categoria: "Enfermero General",
          antiguedad: "10 años",
          adscripcion: "UMF 31",
        },
        employment: {
          workdayHours: 8,
          shift: "Matutino",
        },
        payroll: {
          latestPeriod: "2026-Q18",
          totalEarnings: 14500.5,
          totalDeductions: 2500.25,
          netPay: 12000.25,
          integratedMonthlySalary: null,
          recurringConcepts: [
            { conceptCode: "2", conceptName: "Sueldo Base Tabular", lastAmount: 6000 },
            { conceptCode: "011", conceptName: "Ayuda Renta", lastAmount: 2700 },
          ],
        },
        vacations: {
          dueDate: "2026-12-01",
        },
      },
      commitments: [
        {
          id: "c-1",
          title: "Guardia festiva",
          type: "guard_coverage",
          startAt: "2026-10-12T08:00:00Z",
          status: "pending",
          notes: "Urgencias",
        },
      ],
    })

    expect(snapshot).not.toBeNull()
    expect(snapshot!.ownerId).toBe("user-abc-123")
    expect(snapshot!.profile.fullName).toBe("Juan Pérez")
    expect(snapshot!.latestPayslip?.periodLabel).toBe("2026-Q18")
    expect(snapshot!.latestPayslip?.vacationDueDate).toBe("2026-12-01")
    expect(snapshot!.calculatorBase.sueldoBaseQuincenal002).toBe(6000)
    expect(snapshot!.calculatorBase.ayudaRentaQuincenal011).toBe(2700)
    expect(snapshot!.calculatorBase.sueldoMensualIntegrado).toBe(17400)
    expect(snapshot!.commitments).toHaveLength(1)
    expect(snapshot!.commitments[0].typeLabel).toBe("Guardia / Cobertura")
  })

  it("rejects invalid ownerId with path traversal", () => {
    expect(buildOfflineWorkerSnapshot({ ownerId: "" })).toBeNull()
    expect(buildOfflineWorkerSnapshot({ ownerId: "../escape" })).toBeNull()
  })

  it("posts syncOfflineSnapshot message when native bridge is available and no-ops on web", () => {
    const snapshot = buildOfflineWorkerSnapshot({
      ownerId: "user-abc-123",
      nowMs: 1727480000000,
    })

    // En navegador web normal -> false
    expect(syncOfflineSnapshotToNative(snapshot)).toBe(false)

    // En WebView nativo de Android -> true y envía JSON
    const postSpy = vi.fn()
    window.LaVeinteApp = {
      isNativeApp: () => true,
    } as unknown as typeof window.LaVeinteApp
    window.laVeintePdfBridge = {
      postMessage: postSpy,
    }

    expect(syncOfflineSnapshotToNative(snapshot)).toBe(true)
    expect(postSpy).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(postSpy.mock.calls[0][0] as string) as Record<string, unknown>
    expect(payload.action).toBe("syncOfflineSnapshot")
    expect(payload.userId).toBe("user-abc-123")
  })
})
