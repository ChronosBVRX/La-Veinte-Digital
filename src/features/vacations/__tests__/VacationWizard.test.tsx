// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { VacationWizard } from "../components/VacationWizard"
import type { WorkerContext } from "@/shared/server/worker-context-builder"

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }),
  }),
}))

describe("VacationWizard (Asesor y Planificador Anual)", () => {
  const mockContext: WorkerContext = {
    profile: {
      fullName: "Trabajador IMSS",
      matricula: "99887766",
      categoria: "ENFERMERA GENERAL",
      antiguedad: "5 años 0 qnas 0 días",
      adscripcion: "HGR 1",
    },
    employment: {
      categoryName: "ENFERMERA GENERAL",
      categoryCode: "N39",
      workdayHours: 8,
      employmentType: "BASE",
      entryDate: "2021-01-16",
      effectiveSeniorityDate: "2021-01-16",
      seniorityRaw: "5 años",
      shift: "MATUTINO",
      adscripcion: "HGR 1",
      weeklyRestDays: [0, 6],
      radiologicalExposure: false,
      contractEndDate: null,
    },
    payroll: {
      latestPeriod: "2026-16",
      totalEarnings: 18000,
      totalDeductions: 3000,
      netPay: 15000,
      integratedMonthlySalary: 30000,
      integratedSalaryMeta: {
        sourcePeriod: "2026-16",
        origin: "EXTRACTED",
        isDirectlyExtracted: true,
        isReconstructed: false,
        isConfirmedByUser: true,
        amount: 30000,
      },
      recurringConcepts: [],
      payrollFacts: [],
    },
    vacations: {
      enjoyedDays: 0,
      daysInYear: 20,
      twentyYearsOrMoreDays: 0,
      expiredPeriods: 0,
      continuityMark: 0,
      periodNumberToEnjoy: 1,
      porVencer: "2026-10-14",
      porVencerRaw: "14102026",
      dueDate: "2026-10-14",
      entitlements: [
        { id: "1", kind: "ORDINARY", periodNumber: 1, dueDate: "2026-10-14", confirmed: true, sourcePayslipPeriod: "2026-16" },
        { id: "2", kind: "ORDINARY", periodNumber: 2, confirmed: false, sourcePayslipPeriod: "2026-16" },
      ],
    },
    vacationProfile: null,
  }

  it("Paso 1: Renderiza la bienvenida con lenguaje institucional amigable", () => {
    render(<VacationWizard initialContext={mockContext} />)
    expect(screen.getByText("Asesor y Planificador Vacacional IMSS")).toBeDefined()
    expect(screen.getByText(/Bienvenido a la simulación de tus vacaciones del siguiente año/i)).toBeDefined()
    expect(screen.getByText(/Comenzar simulación/i)).toBeDefined()
  })

  it("Paso 2: Muestra datos del tarjetón, SMI y cantidad de periodos a programar", async () => {
    render(<VacationWizard initialContext={mockContext} />)
    fireEvent.click(screen.getByText(/Comenzar simulación/i))

    expect(screen.getByText("Lo que encontramos en tu tarjetón")).toBeDefined()
    expect(screen.getAllByText(/\$30,000\.00/).length).toBeGreaterThan(0)
    expect(screen.getByText(/debes programar 2 periodos/i)).toBeDefined()
  })

  it("Paso 3 y 4: Selección de prioridades y navegación a programación paso a paso", async () => {
    render(<VacationWizard initialContext={mockContext} />)
    fireEvent.click(screen.getByText(/Comenzar simulación/i))
    fireEvent.click(screen.getByText(/Continuar a prioridades/i))

    expect(screen.getByText("¿Qué prefieres en tus vacaciones?")).toBeDefined()
    expect(screen.getByText(/Quiero cobrar más en el primer periodo/i)).toBeDefined()

    fireEvent.click(screen.getByText(/Continuar a programación/i))
    expect(screen.getByText(/Programando Periodo 1 de 2/i)).toBeDefined()
  })

  it("Paso 4: Muestra marcas en lenguaje claro de trabajador sin códigos UPO crudos", async () => {
    render(<VacationWizard initialContext={mockContext} />)
    fireEvent.click(screen.getByText(/Comenzar simulación/i))
    fireEvent.click(screen.getByText(/Continuar a prioridades/i))
    fireEvent.click(screen.getByText(/Continuar a programación/i))

    expect(screen.getByText(/Marca 4: Ayuda completa en este periodo/i)).toBeDefined()
    expect(screen.getByText(/Marca 1: Pago y descanso repartidos/i)).toBeDefined()
    expect(screen.queryByText(/APPLY_INCLUSION_MARK/)).toBeNull()
  })
})
