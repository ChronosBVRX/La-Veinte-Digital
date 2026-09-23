// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { SalaryIncreaseCard } from "../components/SalaryIncreaseCard"

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

function mockWorkerContext(
  concepts: Array<{
    conceptCode: string
    lastAmount: number
    lastSeenAt?: string
    payslipId?: string
    confirmed?: boolean
    source?: string
  }>,
  userId = "test-user-id",
) {
  const context = {
    userId,
    meta: { userId, activePayslipId: "payslip-1", activePayslipPeriod: "2026-Q1", activeEmployeeNumber: "123456", selectionMode: "AUTO_LATEST", contextRevision: 1 },
    profile: { matricula: "123456" },
    payroll: {
      latestPeriod: "2026-Q1",
      recurringConcepts: concepts.map((c) => ({
        ...c,
        lastSeenAt: c.lastSeenAt ?? "2026-Q1",
        payslipId: c.payslipId ?? "payslip-1",
        source: c.source ?? "last_payslip",
        confirmed: c.confirmed ?? true,
      })),
    },
  }
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => context }) as Response))
}

function mockWorkerContextWithoutPayslip(userId = "test-user-id") {
  const context = {
    userId,
    meta: { userId, activePayslipId: null, activePayslipPeriod: null, activeEmployeeNumber: null, selectionMode: "AUTO_LATEST", contextRevision: null },
    profile: null,
    payroll: { latestPeriod: null, recurringConcepts: [] },
  }
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => context }) as Response))
}

beforeEach(() => {
  vi.unstubAllGlobals()
  authListeners = []
  mockCurrentUserId = "test-user-id"
})

describe("SalaryIncreaseCard", () => {
  it("10. muestra el mensaje exacto con el aumento y nunca menciona 8.55% ni definitivo", async () => {
    mockWorkerContext([
      { conceptCode: "002", lastAmount: 10000 },
      { conceptCode: "011", lastAmount: 8215 },
    ])
    render(<SalaryIncreaseCard />)
    await screen.findByTestId("salary-estimate-card")
    expect(document.body.textContent).toMatch(
      /Con esta actualización salarial ganarías aproximadamente \$929\.55 más brutos por quincena\./,
    )
    expect(document.body.textContent).toContain("$929.55")
    expect(document.body.textContent).not.toContain("8.55%")
    expect(document.body.textContent).not.toContain("resultado es definitivo")
    expect(document.body.textContent).not.toContain("pago definitivo")
    expect(document.body.textContent).toContain("sujeta al convenio salarial definitivo")
  })

  it("11. sin tarjetón (ausencia confirmada) muestra invitación a importar y nunca $0.00", async () => {
    mockWorkerContextWithoutPayslip()
    render(<SalaryIncreaseCard />)
    const invite = await screen.findByText("Importa tu tarjetón más reciente para conocer tu aumento salarial estimado.")
    expect(invite).toBeTruthy()
    expect(document.body.textContent).not.toContain("$0.00")
    const link = document.querySelector('a[href="/profile/mi-informacion-laboral"]')
    expect(link).toBeTruthy()
  })

  it("11a. si la consulta falla NO invita a importar ni muestra $0.00", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down")
    }))
    render(<SalaryIncreaseCard />)
    await screen.findByTestId("salary-estimate-error")
    expect(document.body.textContent).not.toContain("Importa tu tarjetón")
    expect(document.body.textContent).not.toContain("$0.00")
    expect(document.querySelector('a[href="/profile/mi-informacion-laboral"]')).toBeNull()
  })

  it("11a2. respuesta no-ok del API se trata como desconocido, no como ausencia", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => null }) as unknown as Response))
    render(<SalaryIncreaseCard />)
    await screen.findByTestId("salary-estimate-error")
    expect(document.body.textContent).not.toContain("Importa tu tarjetón")
    expect(document.body.textContent).not.toContain("$0.00")
  })

  it("11a3. mientras se consulta muestra estado neutral sin invitación a importar", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})))
    render(<SalaryIncreaseCard />)
    expect(screen.getByTestId("salary-estimate-loading")).toBeTruthy()
    expect(document.body.textContent).not.toContain("Importa tu tarjetón")
    expect(document.body.textContent).not.toContain("$0.00")
  })

  it("11b. con tabular pero sin Concepto 11 pide revisar en lugar de calcular y NUNCA invita a importar", async () => {
    mockWorkerContext([{ conceptCode: "002", lastAmount: 10000 }])
    render(<SalaryIncreaseCard />)
    const notice = await screen.findByTestId("salary-estimate-missing-concepts")
    expect(notice.textContent).toContain("Tu tarjetón guardado no incluye ayuda para renta (concepto 011)")
    expect(notice.textContent).toContain("Revisar mi información laboral")
    // NUNCA debe invitar a importar cuando ya existe un tarjetón guardado
    expect(document.body.textContent).not.toContain("Importa tu tarjetón")
    expect(document.body.textContent).not.toContain("$0.00")
  })

  it("11c. cuando ya existe un contexto previo válido y una actualización posterior de red falla, conserva el contexto previo y muestra el aviso de actualización sin degradar a error destructivo", async () => {
    // 1. Carga inicial exitosa con datos de salario
    let shouldFail = false
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        if (shouldFail) {
          throw new Error("re-fetch network error")
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userId: "test-user-id",
            meta: { userId: "test-user-id", activePayslipId: "payslip-ok-1", activePayslipPeriod: "2026-08-31" },
            payroll: {
              latestPeriod: "2026-08-31",
              recurringConcepts: [
                { conceptCode: "002", lastAmount: 10000, lastSeenAt: "2026-08-31", payslipId: "payslip-ok-1", confirmed: true },
                { conceptCode: "011", lastAmount: 8215, lastSeenAt: "2026-08-31", payslipId: "payslip-ok-1", confirmed: true },
              ],
            },
          }),
        } as unknown as Response
      }),
    )

    render(<SalaryIncreaseCard />)
    await screen.findByTestId("salary-estimate-card")
    expect(document.body.textContent).toContain("$929.55")

    // 2. Ocurre una actualización en segundo plano que falla (red caída)
    shouldFail = true
    window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))

    // 3. El cálculo previo ($929.55) se conserva y aparece el aviso sutil con botón de reintento
    const statusNotice = await screen.findByRole("status")
    expect(statusNotice.textContent).toContain("Mostrando el último cálculo disponible")
    expect(statusNotice.textContent).toContain("Reintentar")
    expect(screen.getByTestId("salary-estimate-card")).toBeTruthy()
    expect(document.body.textContent).toContain("$929.55")
    expect(screen.queryByTestId("salary-estimate-error")).toBeNull()
  })

  it("11d. caso sintético sustitución: calcula estimación para sueldo sustituto 008 con cobertura quincenal trabajada sin promesa futura", async () => {
    const sustContext = {
      userId: "test-user-id",
      meta: {
        userId: "test-user-id",
        activePayslipId: "payslip-sust-synth-01",
        activePayslipPeriod: "2A-SEP-2026",
        activeEmployeeNumber: "mat-synth-sust-01",
      },
      profile: { matricula: "mat-synth-sust-01" },
      payroll: {
        latestPeriod: "2A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "008", lastAmount: 3200, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-sust-synth-01", confirmed: true },
          { conceptCode: "011", lastAmount: 2600, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-sust-synth-01", confirmed: true },
        ],
      },
    }
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => sustContext }) as Response))

    render(<SalaryIncreaseCard />)
    await screen.findByTestId("salary-estimate-card")

    // Aumento esperado: $326.25
    expect(document.body.textContent).toContain("$326.25")
    expect(document.body.textContent).toContain("Tu aumento estimado (Sustitución)")
    expect(document.body.textContent).toContain("Al no contar con desglose comprobado de días trabajados")
    expect(document.body.textContent).toContain("el concepto 008 no acredita días futuros ni tipo permanente de contratación")
    expect(document.body.textContent).toContain("Hipótesis de estimación preliminar")
    expect(document.body.textContent).toContain("86.05%")
    expect(document.body.textContent).toContain("82.15% contractual vigente según Cláusula 63 Bis")
    expect(document.body.textContent).not.toContain("Importa tu tarjetón")
  })

  it("11e. caso sintético ordinario: fallo inicial de red no degrada a 'no tienes tarjetón' y se recupera con reintento", async () => {
    const { fireEvent } = await import("@testing-library/react")

    let callCount = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++
        if (callCount === 1) {
          throw new Error("Failed to fetch initial context")
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userId: "test-user-id",
            meta: {
              userId: "test-user-id",
              activePayslipId: "payslip-base-synth-01",
              activePayslipPeriod: "1A-SEP-2026",
              activeEmployeeNumber: "mat-synth-ord-01",
            },
            profile: { matricula: "mat-synth-ord-01" },
            payroll: {
              latestPeriod: "1A-SEP-2026",
              recurringConcepts: [
                { conceptCode: "002", lastAmount: 4000, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-base-synth-01", confirmed: true },
                { conceptCode: "011", lastAmount: 3200, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-base-synth-01", confirmed: true },
              ],
            },
          }),
        } as unknown as Response
      }),
    )

    render(<SalaryIncreaseCard />)

    // 1. Estado de error inicial con botón de reintento
    const errorCapsule = await screen.findByTestId("salary-estimate-error")
    expect(errorCapsule.textContent).toContain("No pudimos consultar tu información laboral")
    expect(errorCapsule.textContent).not.toContain("Importa tu tarjetón")
    expect(errorCapsule.textContent).not.toContain("No tienes un tarjetón")

    const retryButton = screen.getByRole("button", { name: "Reintentar" })
    expect(retryButton).toBeTruthy()

    // 2. Clic en Reintentar
    fireEvent.click(retryButton)

    // 3. Recuperación exitosa: muestra tarjeta con aumento calculado ($457.82)
    await screen.findByTestId("salary-estimate-card")
    expect(document.body.textContent).toContain("$457.82")
    expect(document.body.textContent).toContain("sujeta al convenio salarial definitivo")
    expect(document.body.textContent).toContain("Hipótesis de estimación preliminar")
    expect(document.body.textContent).toContain("86.05%")
    expect(document.body.textContent).toContain("82.15% contractual vigente según Cláusula 63 Bis")
    expect(document.body.textContent).not.toContain("Importa tu tarjetón")
  })

  it("11e2. caso sintético de control: cálculo ordinario preciso con importes de prueba", async () => {
    mockWorkerContext([
      { conceptCode: "002", lastAmount: 3800, confirmed: true },
      { conceptCode: "011", lastAmount: 3100, confirmed: true },
    ])
    render(<SalaryIncreaseCard />)
    await screen.findByTestId("salary-estimate-card")
    expect(document.body.textContent).toContain("$374.93")
    expect(document.body.textContent).toContain("sujeta al convenio salarial definitivo")
    expect(document.body.textContent).toContain("86.05%")
    expect(document.body.textContent).toContain("82.15% contractual vigente según Cláusula 63 Bis")
  })

  it("11e3. cambio de sesión A→B con una revisión B más antigua: nunca debe quedar visible el contexto salarial de A", async () => {
    let currentUser: "A" | "B" = "A"
    setCoherentAuthSession("user-alpha-A")

    const contextA = {
      userId: "user-alpha-A",
      meta: {
        userId: "user-alpha-A",
        activePayslipId: "payslip-user-A",
        activePayslipPeriod: "1A-SEP-2026",
        activeEmployeeNumber: "mat-worker-A",
        selectionMode: "AUTO_LATEST",
        contextRevision: 5, // Revisión más alta
      },
      profile: { matricula: "mat-worker-A" },
      payroll: {
        latestPeriod: "1A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 10000, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-user-A", confirmed: true },
          { conceptCode: "011", lastAmount: 8215, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-user-A", confirmed: true },
        ],
      },
    }

    const contextB = {
      userId: "user-beta-B",
      meta: {
        userId: "user-beta-B",
        activePayslipId: "payslip-user-B",
        activePayslipPeriod: "1A-SEP-2026",
        activeEmployeeNumber: "mat-worker-B",
        selectionMode: "AUTO_LATEST",
        contextRevision: 1, // Revisión más antigua que la de A
      },
      profile: { matricula: "mat-worker-B" },
      payroll: {
        latestPeriod: "1A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 4000, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-user-B", confirmed: true },
          { conceptCode: "011", lastAmount: 3200, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-user-B", confirmed: true },
        ],
      },
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => (currentUser === "A" ? contextA : contextB),
      }) as Response),
    )

    render(<SalaryIncreaseCard />)

    // 1. Sesión inicial del usuario A: aumento calculado $929.55
    await screen.findByTestId("salary-estimate-card")
    expect(document.body.textContent).toContain("$929.55")

    // 2. Cambio de sesión: el usuario se autentica como B (con revisión 1 < 5)
    currentUser = "B"
    setCoherentAuthSession("user-beta-B", "SIGNED_IN")

    // 3. El contexto salarial de B ($457.82) se muestra y el de A ($929.55) desaparece por completo
    await screen.findByText("$457.82")
    expect(document.body.textContent).toContain("$457.82")
    expect(document.body.textContent).not.toContain("$929.55")
  })

  it("11c2. concepto 011 igual a cero muestra 'Estimación pendiente de comprobar' y nunca un incremento calculado desde cero", async () => {
    mockWorkerContext([
      { conceptCode: "002", lastAmount: 4000, confirmed: true },
      { conceptCode: "011", lastAmount: 0, confirmed: true },
    ])
    render(<SalaryIncreaseCard />)
    const notice = await screen.findByTestId("salary-estimate-unverified-base")
    expect(notice.textContent).toContain("Estimación pendiente de comprobar")
    expect(notice.textContent).toContain("Tu tarjetón registra ayuda para renta (concepto 011) en $0.00")
    expect(notice.textContent).toContain("Al no existir una base comparable acreditada")
    expect(notice.textContent).toContain("Revisar mi información laboral")
    expect(document.body.textContent).not.toContain("$3657.82")
    expect(document.body.textContent).not.toContain("más brutos por quincena")
  })

  it("11e4. cambio de sesión A→B con respuesta tardía de A: la respuesta tardía de A no sobreescribe la cuenta B", async () => {
    let resolveA: (value: Response) => void
    const promiseA = new Promise<Response>((resolve) => {
      resolveA = resolve
    })

    setCoherentAuthSession("user-alpha")

    const contextA = {
      userId: "user-alpha",
      meta: { userId: "user-alpha", activePayslipId: "payslip-A", activePayslipPeriod: "1A-SEP-2026", activeEmployeeNumber: "mat-A", contextRevision: "5" },
      profile: { matricula: "mat-A" },
      payroll: {
        latestPeriod: "1A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 10000, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-A", confirmed: true },
          { conceptCode: "011", lastAmount: 8215, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-A", confirmed: true },
        ],
      },
    }

    const contextB = {
      userId: "user-beta",
      meta: { userId: "user-beta", activePayslipId: "payslip-B", activePayslipPeriod: "1A-SEP-2026", activeEmployeeNumber: "mat-B", contextRevision: "1" },
      profile: { matricula: "mat-B" },
      payroll: {
        latestPeriod: "1A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 4000, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-B", confirmed: true },
          { conceptCode: "011", lastAmount: 3200, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-B", confirmed: true },
        ],
      },
    }

    let callCount = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        callCount++
        if (callCount === 1) {
          return promiseA
        }
        return { ok: true, status: 200, json: async () => contextB } as Response
      }),
    )

    render(<SalaryIncreaseCard />)
    expect(screen.getByTestId("salary-estimate-loading")).toBeTruthy()

    // 2. Antes de que A responda, ocurre actualización / cambio a cuenta B
    setCoherentAuthSession("user-beta", "SIGNED_IN")

    // 3. La consulta de B termina primero y muestra $457.82
    await screen.findByText("$457.82")
    expect(document.body.textContent).toContain("$457.82")

    // 4. Ahora resuelve la promesa tardía de A
    resolveA!({ ok: true, status: 200, json: async () => contextA } as Response)

    // 5. El contexto de B permanece inalterado y el de A nunca se monta
    await new Promise((r) => setTimeout(r, 50))
    expect(document.body.textContent).toContain("$457.82")
    expect(document.body.textContent).not.toContain("$929.55")
  })

  it("11e5. cambio de sesión A→B con error de red en B: nunca conserva el cálculo de A", async () => {
    let currentUser: "A" | "B" = "A"
    setCoherentAuthSession("user-A")

    const contextA = {
      userId: "user-A",
      meta: { userId: "user-A", activePayslipId: "payslip-A", activePayslipPeriod: "1A-SEP-2026", activeEmployeeNumber: "mat-A", contextRevision: "1" },
      profile: { matricula: "mat-A" },
      payroll: {
        latestPeriod: "1A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 10000, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-A", confirmed: true },
          { conceptCode: "011", lastAmount: 8215, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-A", confirmed: true },
        ],
      },
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        if (currentUser === "A") {
          return { ok: true, status: 200, json: async () => contextA } as Response
        }
        return { ok: false, status: 401, json: async () => ({ error: "unauthorized", code: "unauthorized" }) } as unknown as Response
      }),
    )

    render(<SalaryIncreaseCard />)
    await screen.findByTestId("salary-estimate-card")
    expect(document.body.textContent).toContain("$929.55")

    // Usuario cierra sesión o cambia a B (código 401 o cambio de cuenta)
    currentUser = "B"
    setCoherentAuthSession("user-B", "SIGNED_IN")

    await screen.findByTestId("salary-estimate-error")
    expect(document.body.textContent).not.toContain("$929.55")
    expect(document.body.textContent).toContain("Tu sesión ha expirado")
  })

  it("11e6. cambio de sesión A→B con la misma matrícula en dos cuentas distintas: purga el contexto previo", async () => {
    let currentUser: "A" | "B" = "A"
    setCoherentAuthSession("user-uuid-111")

    const contextA = {
      userId: "user-uuid-111",
      meta: { userId: "user-uuid-111", activePayslipId: "payslip-A", activePayslipPeriod: "1A-SEP-2026", activeEmployeeNumber: "same-mat-999", contextRevision: "3" },
      profile: { matricula: "same-mat-999" },
      payroll: {
        latestPeriod: "1A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 10000, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-A", confirmed: true },
          { conceptCode: "011", lastAmount: 8215, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-A", confirmed: true },
        ],
      },
    }

    const contextB = {
      userId: "user-uuid-222",
      meta: { userId: "user-uuid-222", activePayslipId: null, activePayslipPeriod: null, activeEmployeeNumber: "same-mat-999", contextRevision: "1" },
      profile: { matricula: "same-mat-999" },
      payroll: { latestPeriod: null, recurringConcepts: [] },
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => (currentUser === "A" ? contextA : contextB),
      }) as Response),
    )

    render(<SalaryIncreaseCard />)
    await screen.findByTestId("salary-estimate-card")
    expect(document.body.textContent).toContain("$929.55")

    // Cambia a cuenta B (misma matrícula, pero cuenta distinta sin tarjetón)
    currentUser = "B"
    setCoherentAuthSession("user-uuid-222", "SIGNED_IN")

    const invite = await screen.findByTestId("salary-estimate-empty")
    expect(invite.textContent).toContain("Importa tu tarjetón más reciente")
    expect(document.body.textContent).not.toContain("$929.55")
  })

  it("11e7. petición iniciada para B que recibe por error datos de A: rechaza el contexto, purga el cálculo y no clasifica la cuenta como confirmada", async () => {
    // Sesión coherente en cuenta B
    setCoherentAuthSession("user-B")

    // Contexto erróneo devuelto con datos de A
    const contextA = {
      userId: "user-A",
      meta: { userId: "user-A", activePayslipId: "payslip-A", activePayslipPeriod: "1A-SEP-2026", activeEmployeeNumber: "mat-A", contextRevision: "1" },
      profile: { matricula: "mat-A" },
      payroll: {
        latestPeriod: "1A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 10000, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-A", confirmed: true },
          { conceptCode: "011", lastAmount: 8215, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-A", confirmed: true },
        ],
      },
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => contextA,
      }) as Response),
    )

    render(<SalaryIncreaseCard />)

    // Al recibir por error datos de A para una sesión de B, el hook rechaza el
    // contexto, no lo confirma, purga cualquier dato anterior y muestra error sin
    // exponer jamás el aumento salarial de A.
    await screen.findByTestId("salary-estimate-error")
    expect(screen.queryByTestId("salary-estimate-card")).toBeNull()
    expect(document.body.textContent).not.toContain("$929.55")
    expect(document.body.textContent).not.toContain("Importa tu tarjetón")
  })

  it("11e8. carrera de INITIAL_SESSION: si /api/worker-context responde antes de confirmar sesión, la tarjeta se recupera y carga el aumento al resolverse INITIAL_SESSION", async () => {
    // 1. En el montaje inicial, no hay sesión resuelta aún (authUserIdRef = null)
    mockCurrentUserId = null
    authListeners = []

    const contextUser = {
      userId: "user-race-condition-resolved",
      meta: { userId: "user-race-condition-resolved", activePayslipId: "payslip-race", activePayslipPeriod: "1A-SEP-2026", activeEmployeeNumber: "mat-race", contextRevision: "1" },
      profile: { matricula: "mat-race" },
      payroll: {
        latestPeriod: "1A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 10000, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-race", confirmed: true },
          { conceptCode: "011", lastAmount: 8215, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-race", confirmed: true },
        ],
      },
    }

    // /api/worker-context responde de inmediato con 200 OK y los datos del usuario
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => contextUser,
      }) as Response),
    )

    render(<SalaryIncreaseCard />)

    // Antes de INITIAL_SESSION, la respuesta queda retenida como pendiente sin error destructivo
    expect(screen.queryByTestId("salary-estimate-error")).toBeNull()

    // 2. Supabase resuelve la sesión asíncronamente emitiendo INITIAL_SESSION para ese usuario
    act(() => {
      setCoherentAuthSession("user-race-condition-resolved", "INITIAL_SESSION")
    })

    // 3. La tarjeta se recupera de inmediato, confirma el contexto retenido y muestra el cálculo
    await screen.findByTestId("salary-estimate-card")
    expect(document.body.textContent).toContain("$929.55")
    expect(screen.queryByTestId("salary-estimate-error")).toBeNull()
  })

  it("11h. caso de Norma: tarjetón con 008 (sueldo sustitución) y 011 (ayuda renta) sin 002 calcula y muestra el aumento correctamente", async () => {
    setCoherentAuthSession("user-norma-case")
    const contextNorma = {
      userId: "user-norma-case",
      meta: { userId: "user-norma-case", activePayslipId: "payslip-norma", activePayslipPeriod: "2A-SEP-2026", activeEmployeeNumber: "mat-norma", contextRevision: "1" },
      profile: { matricula: "mat-norma" },
      payroll: {
        latestPeriod: "2A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "008", lastAmount: 5000, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-norma", confirmed: true },
          { conceptCode: "011", lastAmount: 4107.50, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-norma", confirmed: true },
        ],
      },
    }
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => contextNorma }) as Response))

    render(<SalaryIncreaseCard />)
    await screen.findByTestId("salary-estimate-card")
    expect(screen.getByTestId("salary-estimate-card")).not.toBeNull()
    expect(screen.queryByTestId("salary-estimate-empty")).toBeNull()
  })

  it("11f. coberturas ambiguas (002 y 008 simultáneos) muestran 'faltan datos para estimar' y no invitan a importar", async () => {
    const contextMixto = {
      userId: "test-user-id",
      meta: { userId: "test-user-id", activePayslipId: "p-mix", activePayslipPeriod: "2A-SEP-2026" },
      payroll: {
        latestPeriod: "2A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 4000, lastSeenAt: "2A-SEP-2026", payslipId: "p-mix", confirmed: true },
          { conceptCode: "008", lastAmount: 2000, lastSeenAt: "2A-SEP-2026", payslipId: "p-mix", confirmed: true },
          { conceptCode: "011", lastAmount: 3000, lastSeenAt: "2A-SEP-2026", payslipId: "p-mix", confirmed: true },
        ],
      },
    }
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => contextMixto }) as Response))

    render(<SalaryIncreaseCard />)
    const notice = await screen.findByTestId("salary-estimate-insufficient-data")
    expect(notice.textContent).toContain("Faltan datos para estimar el aumento")
    expect(notice.textContent).toContain("sin desglose de tramos acreditado")
    expect(notice.textContent).toContain("Revisar mi información laboral")
    expect(document.body.textContent).not.toContain("Importa tu tarjetón")
  })

  it("11g. tarjetón posterior al 16 de octubre muestra estado 'vigencia nueva; requiere comprobar importes' y no $0.00", async () => {
    const contextOct2 = {
      userId: "test-user-id",
      meta: { userId: "test-user-id", activePayslipId: "p-oct2", activePayslipPeriod: "2A-OCT-2026" },
      payroll: {
        latestPeriod: "2A-OCT-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 4500, lastSeenAt: "2A-OCT-2026", payslipId: "p-oct2", confirmed: true },
          { conceptCode: "011", lastAmount: 3500, lastSeenAt: "2A-OCT-2026", payslipId: "p-oct2", confirmed: true },
        ],
      },
    }
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => contextOct2 }) as Response))

    render(<SalaryIncreaseCard />)
    const notice = await screen.findByTestId("salary-estimate-new-schedule")
    expect(notice.textContent).toContain("Vigencia nueva: requiere comprobar importes")
    expect(notice.textContent).toContain("corresponde a la segunda quincena de octubre de 2026 o posterior")
    expect(notice.textContent).toContain("Es necesario comprobar si tus percepciones ya incorporan el tabulador 2026 o el anterior")
    expect(notice.textContent).toContain("Revisar mi información laboral")
    expect(document.body.textContent).not.toContain("Importa tu tarjetón")
    expect(document.body.textContent).not.toContain("$0.00")
  })

  it("12. no rompe el diseño móvil: sin anchos fijos ni overflow horizontal", async () => {
    window.innerWidth = 360
    mockWorkerContext([
      { conceptCode: "002", lastAmount: 10000 },
      { conceptCode: "011", lastAmount: 8215 },
    ])
    const { container } = render(<SalaryIncreaseCard />)
    await screen.findByTestId("salary-estimate-card")
    const elements = container.querySelectorAll("*")
    elements.forEach((el) => {
      const style = (el as HTMLElement).style
      if (style?.width?.endsWith("px")) {
        expect(parseInt(style.width, 10)).toBeLessThanOrEqual(360)
      }
    })
    const card = container.querySelector('[data-testid="salary-estimate-card"]') as HTMLElement | null
    expect(card?.style.maxWidth).toBe("100%")
  })
})
