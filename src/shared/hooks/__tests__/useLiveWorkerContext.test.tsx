// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import {
  useLiveWorkerContext,
  useWorkerContextSync,
} from "../useLiveWorkerContext"
import type { WorkerContext } from "@/shared/server/worker-context-builder"

const readyContext: WorkerContext = {
  meta: {
    activePayslipId: "payslip-1",
    activePayslipPeriod: "2026-Q1",
    activeEmployeeNumber: "81123456",
    selectionMode: "AUTO_LATEST",
    contextRevision: "rev-1",
  },
  profile: {
    fullName: "Ana López",
    matricula: "81123456",
    categoria: "ENFERMERA",
    antiguedad: "12 años",
    adscripcion: null,
  },
  employment: null,
  payroll: {
    employeeNumber: "81123456",
    latestPeriod: "2026-Q1",
    totalEarnings: null,
    totalDeductions: null,
    netPay: null,
    integratedMonthlySalary: null,
    recurringConcepts: [],
    payrollFacts: [],
  },
  vacations: null,
  vacationProfile: null,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useWorkerContextSync", () => {
  it("expone loading y después ready con el contexto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => readyContext }) as Response),
    )

    const { result } = renderHook(() => useWorkerContextSync(null))

    expect(result.current.status).toBe("loading")
    expect(result.current.context).toBeNull()

    await waitFor(() => expect(result.current.status).toBe("ready"))
    expect(result.current.context?.meta?.activePayslipId).toBe("payslip-1")
  })

  it("un error de red expone status error, no ausencia de tarjetón", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down")
      }),
    )

    const { result } = renderHook(() => useWorkerContextSync(null))

    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(result.current.context).toBeNull()
  })

  it("una respuesta no-ok expone status error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => null }) as unknown as Response),
    )

    const { result } = renderHook(() => useWorkerContextSync(null))

    await waitFor(() => expect(result.current.status).toBe("error"))
  })

  it("con contexto inicial, un fallo de refresco conserva ready y el contexto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down")
      }),
    )

    const { result } = renderHook(() => useWorkerContextSync(readyContext))

    expect(result.current.status).toBe("ready")
    expect(result.current.context?.profile?.fullName).toBe("Ana López")

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())
    expect(result.current.status).toBe("ready")
  })
})

describe("useLiveWorkerContext (contrato existente)", () => {
  it("sigue devolviendo únicamente el contexto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => readyContext }) as Response),
    )

    const { result } = renderHook(() => useLiveWorkerContext(null))

    await waitFor(() => expect(result.current?.meta?.activePayslipId).toBe("payslip-1"))
  })

  it("devuelve un contexto válido con initialContext", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => readyContext }) as Response),
    )

    const { result } = renderHook(() => useLiveWorkerContext(readyContext))
    expect(result.current?.profile?.matricula).toBe("81123456")
  })
})
