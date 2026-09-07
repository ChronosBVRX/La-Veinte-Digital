// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { VacationWizard } from "../components/VacationWizard"
import type { WorkerContext } from "@/shared/server/worker-context-builder"

const refreshMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

interface MockQueryChain {
  eq: () => MockQueryChain
  order: () => MockQueryChain
  limit: () => MockQueryChain
  single: () => Promise<{ data: null; error: null }>
  maybeSingle: () => Promise<{ data: null; error: null }>
}

const createChain = (): MockQueryChain => {
  const chain: MockQueryChain = {
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  }
  return chain
}

// Mock Supabase client para VacationWizard
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => createChain(),
    }),
  }),
}))

describe("Vacaciones: Invalidation y aislamiento de contexto al cambiar tarjetón/trabajador", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refreshMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const contextWorkerA: WorkerContext = {
    profile: {
      fullName: "Trabajador A",
      matricula: "11111111",
      categoria: "AUXILIAR DE ENFERMERIA",
      antiguedad: "5 años 0 qnas 0 días",
      adscripcion: "HGZ 1",
    },
    employment: {
      categoryName: "AUXILIAR DE ENFERMERIA",
      categoryCode: "N20",
      workdayHours: 8,
      employmentType: "BASE",
      entryDate: "2021-05-15",
      effectiveSeniorityDate: "2021-05-15",
      seniorityRaw: "5 años",
      shift: "MATUTINO",
      adscripcion: "HGZ 1",
      weeklyRestDays: [0, 6],
      radiologicalExposure: false,
      contractEndDate: null,
    },
    payroll: {
      latestPeriod: "2026-10",
      totalEarnings: 12000,
      totalDeductions: 2000,
      netPay: 10000,
      integratedMonthlySalary: 20000,
      integratedSalaryMeta: {
        sourcePeriod: "2026-10",
        origin: "EXTRACTED",
        isDirectlyExtracted: true,
        isReconstructed: false,
        isConfirmedByUser: true,
        amount: 20000,
      },
      recurringConcepts: [],
      payrollFacts: [],
    },
    vacations: {
      enjoyedDays: 0,
      daysInYear: 16,
      twentyYearsOrMoreDays: 0,
      expiredPeriods: 0,
      continuityMark: 1,
      periodNumberToEnjoy: 1,
      porVencer: "2026-05-15",
      porVencerRaw: "15052026",
      dueDate: "2026-05-15",
      entitlements: [
        { id: "1", kind: "ORDINARY", periodNumber: 1, dueDate: "2026-05-15", confirmed: true, sourcePayslipPeriod: "2026-10" },
        { id: "2", kind: "ORDINARY", periodNumber: 2, dueDate: "2026-11-15", confirmed: false, sourcePayslipPeriod: "2026-10" },
      ],
    },
    vacationProfile: null,
  }

  const contextWorkerB: WorkerContext = {
    profile: {
      fullName: "Trabajador B",
      matricula: "22222222",
      categoria: "MEDICO NO FAMILIAR",
      antiguedad: "22 años 0 qnas 0 días",
      adscripcion: "UMAE 25",
    },
    employment: {
      categoryName: "MEDICO NO FAMILIAR",
      categoryCode: "M40",
      workdayHours: 8,
      employmentType: "BASE",
      entryDate: "2004-08-20",
      effectiveSeniorityDate: "2004-08-20",
      seniorityRaw: "22 años",
      shift: "MATUTINO",
      adscripcion: "UMAE 25",
      weeklyRestDays: [0, 6],
      radiologicalExposure: false,
      contractEndDate: null,
    },
    payroll: {
      latestPeriod: "2026-16",
      totalEarnings: 25000,
      totalDeductions: 4000,
      netPay: 21000,
      integratedMonthlySalary: 42000,
      integratedSalaryMeta: {
        sourcePeriod: "2026-16",
        origin: "EXTRACTED",
        isDirectlyExtracted: true,
        isReconstructed: false,
        isConfirmedByUser: true,
        amount: 42000,
      },
      recurringConcepts: [],
      payrollFacts: [],
    },
    vacations: {
      enjoyedDays: 0,
      daysInYear: 20,
      twentyYearsOrMoreDays: 10,
      expiredPeriods: 0,
      continuityMark: 2,
      periodNumberToEnjoy: 1,
      porVencer: "2026-08-20",
      porVencerRaw: "20082026",
      dueDate: "2026-08-20",
      entitlements: [
        { id: "1", kind: "ORDINARY", periodNumber: 1, dueDate: "2026-08-20", confirmed: true, sourcePayslipPeriod: "2026-16" },
        { id: "2", kind: "ORDINARY", periodNumber: 2, dueDate: "2027-02-20", confirmed: false, sourcePayslipPeriod: "2026-16" },
        { id: "v20", kind: "V20", periodNumber: 3, dueDate: null, confirmed: true, sourcePayslipPeriod: "2026-16" },
      ],
    },
    vacationProfile: null,
  }

  it("al recibir nomina_payslip_updated, invoca router.refresh() para recargar getWorkerContext()", () => {
    render(<VacationWizard initialContext={contextWorkerA} />)

    act(() => {
      window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))
    })

    expect(refreshMock).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("reinicia el estado derivado interno (step, selecciones) al recibir un nuevo trabajador/tarjetón sin mezclar datos", async () => {
    const { rerender } = render(<VacationWizard initialContext={contextWorkerA} />)

    // Trabajador A: avanzar a paso 2
    fireEvent.click(screen.getByText(/Comenzar simulación/i))
    expect(screen.getByText("Lo que encontramos en tu tarjetón")).toBeDefined()
    expect(screen.getAllByText(/\$20,000\.00/).length).toBeGreaterThan(0)
    expect(screen.getByText(/debes programar 2 periodos/i)).toBeDefined()

    // Avanzar a paso 3
    act(() => {
      fireEvent.click(screen.getByText(/Continuar a prioridades/i))
    })
    expect(screen.getByText("¿Qué prefieres en tus vacaciones?")).toBeDefined()

    // Ahora simular que el Server Component se refresca con Trabajador B
    act(() => {
      rerender(<VacationWizard initialContext={contextWorkerB} />)
    })

    // El wizard debe haberse reiniciado a la bienvenida ("welcome")
    expect(screen.getByText("Asesor y Planificador Vacacional IMSS")).toBeDefined()
    expect(screen.getByText(/Comenzar simulación/i)).toBeDefined()

    // Avanzar de nuevo para verificar que los datos ahora son 100% de Trabajador B
    act(() => {
      fireEvent.click(screen.getByText(/Comenzar simulación/i))
    })
    expect(screen.getByText("Lo que encontramos en tu tarjetón")).toBeDefined()

    // Salario de B ($42,000.00), no de A ($20,000.00)
    expect(screen.getAllByText(/\$42,000\.00/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/\$20,000\.00/)).toBeNull()

    // B tiene 22 años de antigüedad (V20) -> 3 periodos
    expect(screen.getByText(/debes programar 3 periodos/i)).toBeDefined()
  })

  it("si el fingerprint no cambia, conserva el paso actual del wizard", () => {
    const { rerender } = render(<VacationWizard initialContext={contextWorkerA} />)

    act(() => {
      fireEvent.click(screen.getByText(/Comenzar simulación/i))
    })
    expect(screen.getByText("Lo que encontramos en tu tarjetón")).toBeDefined()

    // Rerender con el mismo contexto (mismo fingerprint)
    act(() => {
      rerender(<VacationWizard initialContext={{ ...contextWorkerA }} />)
    })

    // Debe seguir en el paso 2 sin resetearse a la bienvenida
    expect(screen.getByText("Lo que encontramos en tu tarjetón")).toBeDefined()
  })
})
