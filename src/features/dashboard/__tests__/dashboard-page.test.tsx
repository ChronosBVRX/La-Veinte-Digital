// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"

const { fromMock, redirectMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  redirectMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({ redirect: redirectMock }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-A" } } }) },
    from: fromMock,
  }),
}))

vi.mock("@/shared/components/app/WelcomeCard", () => ({
  WelcomeCard: ({ fullName }: { fullName: string | null }) => (
    <div data-testid="welcome-full-name">{fullName ?? "__sin_nombre__"}</div>
  ),
}))

vi.mock("@/shared/components/app/OnboardingCard", () => ({
  OnboardingCard: (props: {
    hasAntiguedad: boolean | null
    hasTarjeton: boolean | null
    hasCategoria: boolean | null
  }) => (
    <div
      data-testid="onboarding"
      data-categoria={String(props.hasCategoria)}
      data-antiguedad={String(props.hasAntiguedad)}
      data-tarjeton={String(props.hasTarjeton)}
    />
  ),
}))

vi.mock("@/shared/components/app/HomeQuickActions", () => ({ HomeQuickActions: () => null }))
vi.mock("@/shared/components/app/DesktopQuickPills", () => ({ DesktopQuickPills: () => null }))
vi.mock("@/shared/components/app/CalendarioLaboral", () => ({ CalendarioLaboral: () => null }))
vi.mock("@/shared/components/app/AgendaCardWrapper", () => ({ AgendaCardWrapper: () => null }))
vi.mock("@/features/copy-service/components/CopyServiceHeroCard", () => ({ CopyServiceHeroCard: () => null }))
vi.mock("@/features/salary-estimate/components/SalaryIncreaseCard", () => ({ SalaryIncreaseCard: () => null }))
vi.mock("@/features/vacations/components/Vacation2027AnnouncementCard", () => ({
  Vacation2027AnnouncementCard: () => <div data-testid="vacation-2027-announcement" />,
}))

import DashboardPage from "@/app/(dashboard)/page"

type QueryResult = { data?: unknown; error?: unknown; count?: number | null; status?: number }
interface RecordedQuery {
  table: string
  ops: Array<[string, ...unknown[]]>
}

class FakeQuery implements PromiseLike<QueryResult> {
  private ops: Array<[string, ...unknown[]]> = []

  constructor(
    private table: string,
    private result: QueryResult,
    private record: (query: RecordedQuery) => void,
  ) {}

  select(...args: unknown[]) {
    this.ops.push(["select", ...args])
    return this
  }

  eq(...args: unknown[]) {
    this.ops.push(["eq", ...args])
    return this
  }

  maybeSingle() {
    this.ops.push(["maybeSingle"])
    return this
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    this.record({ table: this.table, ops: this.ops })
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

function installSupabaseMock(queues: Record<string, QueryResult[]>): RecordedQuery[] {
  const records: RecordedQuery[] = []
  fromMock.mockImplementation((table: string) => {
    const queue = queues[table] ?? []
    const result =
      queue.length > 1 ? queue.shift()! : queue[0] ?? { data: null, error: null, count: null }
    return new FakeQuery(table, result, (query) => records.push(query))
  })
  return records
}

function eqFilters(record: RecordedQuery): Array<[unknown, unknown]> {
  return record.ops.filter(([op]) => op === "eq").map(([, column, value]) => [column, value])
}

function queriesFor(records: RecordedQuery[], table: string): RecordedQuery[] {
  return records.filter((r) => r.table === table)
}

function expectAllOnboarding(expected: {
  tarjeton: string
  categoria: string
  antiguedad: string
}) {
  const cards = screen.getAllByTestId("onboarding")
  expect(cards).toHaveLength(2)
  for (const card of cards) {
    expect(card.getAttribute("data-tarjeton")).toBe(expected.tarjeton)
    expect(card.getAttribute("data-categoria")).toBe(expected.categoria)
    expect(card.getAttribute("data-antiguedad")).toBe(expected.antiguedad)
  }
}

const profilePresent: QueryResult = {
  data: {
    full_name: "Ana López Ramírez",
    matricula: "81123456",
    categoria: "ENFERMERA GENERAL",
    antiguedad: "12 años",
  },
  error: null,
}

describe("DashboardPage — carga inicial", () => {
  beforeEach(() => {
    fromMock.mockReset()
    redirectMock.mockReset()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("perfil y tarjetón correctos: nombre real y sin falso onboarding", async () => {
    const records = installSupabaseMock({
      profiles: [profilePresent],
      imported_payslips: [{ data: null, error: null, count: 1, status: 200 }],
    })

    render(await DashboardPage())

    expect(screen.getByTestId("welcome-full-name").textContent).toBe("Ana López Ramírez")
    expectAllOnboarding({ tarjeton: "true", categoria: "true", antiguedad: "true" })
    expect(console.error).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()

    const profileQuery = queriesFor(records, "profiles")[0]
    const payslipQuery = queriesFor(records, "imported_payslips")[0]
    expect(eqFilters(profileQuery)).toEqual([["id", "user-A"]])
    expect(eqFilters(payslipQuery)).toEqual([
      ["user_id", "user-A"],
      ["employee_number", "81123456"],
    ])
  })

  it("perfil ausente real: fallback permitido y onboarding con datos ausentes", async () => {
    installSupabaseMock({
      profiles: [{ data: null, error: null, status: 200 }],
      imported_payslips: [{ data: null, error: null, count: 0, status: 200 }],
    })

    render(await DashboardPage())

    expect(screen.getByTestId("welcome-full-name").textContent).toBe("__sin_nombre__")
    expectAllOnboarding({ tarjeton: "false", categoria: "false", antiguedad: "false" })
  })

  it("error de perfil: no se trata como perfil inexistente y se registra", async () => {
    const records = installSupabaseMock({
      profiles: [
        { data: null, error: { code: "", message: "TypeError: fetch failed" }, status: 0 },
        { data: null, error: { code: "", message: "TypeError: fetch failed" }, status: 0 },
      ],
      imported_payslips: [{ data: null, error: null, count: 0, status: 200 }],
    })

    render(await DashboardPage())

    expectAllOnboarding({ tarjeton: "false", categoria: "null", antiguedad: "null" })

    expect(queriesFor(records, "profiles")).toHaveLength(2)
    expect(console.error).toHaveBeenCalledWith(
      "Failed to load dashboard profile",
      expect.objectContaining({
        userId: "user-A",
        attempts: 2,
        message: "TypeError: fetch failed",
      }),
    )
  })

  it("error de tarjetón: estado unknown, no onboarding falso", async () => {
    const records = installSupabaseMock({
      profiles: [profilePresent],
      imported_payslips: [
        { data: null, error: { code: "42501", message: "permission denied" }, status: 403 },
      ],
    })

    render(await DashboardPage())

    expectAllOnboarding({ tarjeton: "null", categoria: "true", antiguedad: "true" })
    expect(queriesFor(records, "imported_payslips")).toHaveLength(1)
    expect(eqFilters(queriesFor(records, "imported_payslips")[0])).toEqual([
      ["user_id", "user-A"],
      ["employee_number", "81123456"],
    ])
    expect(console.error).toHaveBeenCalledWith(
      "Failed to determine dashboard payslip state",
      expect.objectContaining({ userId: "user-A", attempts: 1, code: "42501" }),
    )
  })

  it("fallo transitorio de tarjetón: un reintento y estado confirmado", async () => {
    const records = installSupabaseMock({
      profiles: [profilePresent],
      imported_payslips: [
        { data: null, error: { code: "57P03" }, status: 503 },
        { data: null, error: null, count: 0, status: 200 },
      ],
    })

    render(await DashboardPage())

    expectAllOnboarding({ tarjeton: "false", categoria: "true", antiguedad: "true" })
    expect(queriesFor(records, "imported_payslips")).toHaveLength(2)
    expect(console.error).not.toHaveBeenCalled()
  })

  it("sin matrícula: la consulta de tarjetones sigue acotada al usuario", async () => {
    const records = installSupabaseMock({
      profiles: [{ data: { full_name: "Trabajador Nuevo" }, error: null }],
      imported_payslips: [{ data: null, error: null, count: 0, status: 200 }],
    })

    render(await DashboardPage())

    expect(eqFilters(queriesFor(records, "imported_payslips")[0])).toEqual([["user_id", "user-A"]])
    expectAllOnboarding({ tarjeton: "false", categoria: "false", antiguedad: "false" })
  })

  it("integra el anuncio de roles vacacionales 2027 una sola vez", async () => {
    installSupabaseMock({
      profiles: [profilePresent],
      imported_payslips: [{ data: null, error: null, count: 0, status: 200 }],
    })

    render(await DashboardPage())

    expect(screen.getAllByTestId("vacation-2027-announcement")).toHaveLength(1)
  })
})


