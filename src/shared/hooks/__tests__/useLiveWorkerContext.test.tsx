// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import {
  useLiveWorkerContext,
  useWorkerContextSync,
} from "../useLiveWorkerContext"
import type { WorkerContext } from "@/shared/server/worker-context-builder"

let mockCurrentUserId: string | null = "test-user-id"
type AuthListener = (event: string, session: { user: { id: string } } | null) => void
let authListeners: AuthListener[] = []

export function setCoherentAuthSession(
  userId: string | null,
  event: "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" = "SIGNED_IN",
) {
  mockCurrentUserId = userId
  const session = userId ? { user: { id: userId } } : null
  for (const listener of [...authListeners]) {
    listener(event, session)
  }
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (cb: AuthListener) => {
        authListeners.push(cb)
        const session = mockCurrentUserId ? { user: { id: mockCurrentUserId } } : null
        cb("INITIAL_SESSION", session)
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authListeners = authListeners.filter((l) => l !== cb)
              },
            },
          },
        }
      },
      getUser: async () => ({
        data: { user: mockCurrentUserId ? { id: mockCurrentUserId } : null },
        error: null,
      }),
      getSession: async () => ({
        data: { session: mockCurrentUserId ? { user: { id: mockCurrentUserId } } : null },
        error: null,
      }),
    },
  }),
}))

const readyContext: WorkerContext = {
  userId: "test-user-id",
  meta: {
    userId: "test-user-id",
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
  authListeners = []
  mockCurrentUserId = "test-user-id"
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

  it("al cambiar de usuario A -> B con respuesta tardía de A, la respuesta de A no sobreescribe el contexto de B", async () => {
    let resolveA: (value: Response) => void
    const promiseA = new Promise<Response>((resolve) => {
      resolveA = resolve
    })

    const contextUserA: WorkerContext = {
      ...readyContext,
      userId: "user-a",
      meta: { ...readyContext.meta!, userId: "user-a", activePayslipId: "payslip-a", contextRevision: "rev-5" },
      profile: { ...readyContext.profile!, fullName: "Usuario A", matricula: "mat-a" },
    }

    const contextUserB: WorkerContext = {
      ...readyContext,
      userId: "user-b",
      meta: { ...readyContext.meta!, userId: "user-b", activePayslipId: "payslip-b", contextRevision: "rev-1" },
      profile: { ...readyContext.profile!, fullName: "Usuario B", matricula: "mat-b" },
    }

    const fetchMock = vi.fn()
      .mockImplementationOnce(() => promiseA)
      .mockImplementationOnce(async () => ({ ok: true, status: 200, json: async () => contextUserB }) as Response)

    vi.stubGlobal("fetch", fetchMock)

    // Monta con usuario A
    setCoherentAuthSession("user-a")
    const { result, rerender } = renderHook(({ ctx }) => useWorkerContextSync(ctx), {
      initialProps: { ctx: contextUserA as WorkerContext | null },
    })

    expect(result.current.context?.userId).toBe("user-a")

    // Cambia a usuario B (initialContext de B)
    setCoherentAuthSession("user-b", "SIGNED_IN")
    rerender({ ctx: contextUserB })

    // El contexto de A se purga de inmediato y se pone el de B
    expect(result.current.context?.userId).toBe("user-b")

    // Ahora la petición retardada de A finalmente responde
    resolveA!({ ok: true, status: 200, json: async () => contextUserA } as Response)

    // Se asegura de que no sobreescriba B
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(result.current.context?.userId).toBe("user-b")
    expect(result.current.context?.meta?.activePayslipId).toBe("payslip-b")
  })

  it("al cambiar de usuario A -> B con error de red en B, el contexto de A NO se preserva", async () => {
    const contextUserA: WorkerContext = {
      ...readyContext,
      userId: "user-a",
      meta: { ...readyContext.meta!, userId: "user-a", activePayslipId: "payslip-a" },
      profile: { ...readyContext.profile!, fullName: "Usuario A", matricula: "mat-a" },
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => contextUserA }) as Response),
    )

    setCoherentAuthSession("user-a")
    const { result, rerender } = renderHook(({ ctx }) => useWorkerContextSync(ctx), {
      initialProps: { ctx: contextUserA as WorkerContext | null },
    })

    expect(result.current.context?.userId).toBe("user-a")

    // Cambia a usuario B pero el servidor responde con error de red
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down")
      }),
    )

    // Cierra sesión o cambia a cuenta B sin contexto previo
    setCoherentAuthSession(null, "SIGNED_OUT")
    rerender({ ctx: null })

    // Contexto debe estar en null y status en error, NUNCA preservando los datos de A
    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(result.current.context).toBeNull()
  })

  it("al cambiar de usuario A -> B con la misma matrícula pero distinto userId, el contexto de A se purga de inmediato", async () => {
    const contextUserA: WorkerContext = {
      ...readyContext,
      userId: "user-a-111",
      meta: { ...readyContext.meta!, userId: "user-a-111", activePayslipId: "payslip-a" },
      profile: { ...readyContext.profile!, fullName: "Cuenta A", matricula: "81123456" },
    }

    const contextUserB: WorkerContext = {
      ...readyContext,
      userId: "user-b-222",
      meta: { ...readyContext.meta!, userId: "user-b-222", activePayslipId: "payslip-b" },
      profile: { ...readyContext.profile!, fullName: "Cuenta B", matricula: "81123456" },
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => contextUserB }) as Response),
    )

    setCoherentAuthSession("user-a-111")
    const { result, rerender } = renderHook(({ ctx }) => useWorkerContextSync(ctx), {
      initialProps: { ctx: contextUserA as WorkerContext | null },
    })

    expect(result.current.context?.userId).toBe("user-a-111")

    // Rerender con usuario B (misma matrícula "81123456" pero distinto userId)
    setCoherentAuthSession("user-b-222", "SIGNED_IN")
    rerender({ ctx: contextUserB })

    expect(result.current.context?.userId).toBe("user-b-222")
    expect(result.current.context?.meta?.activePayslipId).toBe("payslip-b")
  })

  it("al cambiar de usuario A -> B con revisión de B anterior a la de A, no se descarta como obsoleta", async () => {
    const contextUserA: WorkerContext = {
      ...readyContext,
      userId: "user-a",
      meta: { ...readyContext.meta!, userId: "user-a", contextRevision: "rev-9" },
    }

    const contextUserB: WorkerContext = {
      ...readyContext,
      userId: "user-b",
      meta: { ...readyContext.meta!, userId: "user-b", contextRevision: "rev-1" },
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => contextUserB }) as Response),
    )

    setCoherentAuthSession("user-a")
    const { result, rerender } = renderHook(({ ctx }) => useWorkerContextSync(ctx), {
      initialProps: { ctx: contextUserA as WorkerContext | null },
    })

    expect(result.current.context?.meta?.contextRevision).toBe("rev-9")

    // Cambia a B con rev-1 < rev-9
    setCoherentAuthSession("user-b", "SIGNED_IN")
    rerender({ ctx: contextUserB })

    // Se acepta rev-1 de B porque es un usuario distinto
    expect(result.current.context?.userId).toBe("user-b")
    expect(result.current.context?.meta?.contextRevision).toBe("rev-1")
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
