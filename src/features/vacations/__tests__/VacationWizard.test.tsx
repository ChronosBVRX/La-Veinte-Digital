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

  it("Paso 3 y 4: Selección de prioridades y navegación a programación con título adaptable", async () => {
    render(<VacationWizard initialContext={mockContext} />)
    fireEvent.click(screen.getByText(/Comenzar simulación/i))
    fireEvent.click(screen.getByText(/Continuar a prioridades/i))

    expect(screen.getByText("¿Qué prefieres en tus vacaciones?")).toBeDefined()
    expect(screen.getByText(/Quiero cobrar más en el primer periodo/i)).toBeDefined()

    fireEvent.click(screen.getByText(/Continuar a programación/i))
    expect(screen.getByText(/Programa tu primer periodo/i)).toBeDefined()
    expect(screen.getByText(/Estás programando el periodo 1 de 2/i)).toBeDefined()
  })

  it("Paso 4: Muestra marcas en lenguaje claro de trabajador sin códigos UPO crudos", async () => {
    render(<VacationWizard initialContext={mockContext} />)
    fireEvent.click(screen.getByText(/Comenzar simulación/i))
    fireEvent.click(screen.getByText(/Continuar a prioridades/i))
    fireEvent.click(screen.getByText(/Continuar a programación/i))

    expect(screen.getByText(/Marca 4 — Sí puedes utilizarla/i)).toBeDefined()
    expect(screen.getByText(/Marca 1 — Sí puedes utilizarla/i)).toBeDefined()
    expect(screen.getByText(/Antes de elegir, entiende tus marcas/i)).toBeDefined()
    expect(screen.getByText(/La marca que traes/i)).toBeDefined()
    expect(screen.queryByText(/APPLY_INCLUSION_MARK/)).toBeNull()
  })

  it("Paso 4: Usa el calendario oficial 2027 y muestra términos según los días del periodo", async () => {
    render(<VacationWizard initialContext={mockContext} />)
    fireEvent.click(screen.getByText(/Comenzar simulación/i))
    fireEvent.click(screen.getByText(/Continuar a prioridades/i))
    fireEvent.click(screen.getByText(/Continuar a programación/i))

    expect(screen.queryByText(/Calendario preliminar 2027:/i)).toBeNull()
    expect(screen.getAllByText(/Observación A/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Término para 10 días:/i).length).toBeGreaterThan(0)

    const availableBadges = screen.getAllByText(/Disponible ✓/i)
    expect(availableBadges.length).toBeGreaterThan(0)

    const firstAvailableCard = availableBadges[0].closest("div[style*='cursor: pointer']")
    if (firstAvailableCard) {
      fireEvent.click(firstAvailableCard)
      expect(await screen.findByText(/Elegido ✓/i)).toBeDefined()
    }

    expect(screen.queryByText(/CALENDAR_DRAFT/)).toBeNull()
    expect(screen.queryByText(/MISSING_DUE_DATE/)).toBeNull()
    expect(screen.queryByText(/ROLE_ALLOWED/)).toBeNull()
  })

  it("Paso 4: Sin fecha de vencimiento muestra banner superior con botón a revisión de tarjetón", async () => {
    const contextWithoutDueDate: WorkerContext = {
      ...mockContext,
      vacations: {
        ...mockContext.vacations!,
        porVencer: null,
        dueDate: null,
        porVencerRaw: null,
        entitlements: [
          { id: "1", kind: "ORDINARY", periodNumber: 1, dueDate: null, confirmed: false },
          { id: "2", kind: "ORDINARY", periodNumber: 2, dueDate: null, confirmed: false },
        ],
      },
    }

    render(<VacationWizard initialContext={contextWithoutDueDate} />)
    fireEvent.click(screen.getByText(/Comenzar simulación/i))
    fireEvent.click(screen.getByText(/Continuar a prioridades/i))
    fireEvent.click(screen.getByText(/Continuar a programación/i))

    // Banner único superior
    expect(await screen.findByText(/No encontramos la fecha en la que generas este derecho/i)).toBeDefined()
    expect(screen.getByText(/Revisar datos del tarjetón/i)).toBeDefined()

    // Badges en las tarjetas de rol
    const missingDateBadges = await screen.findAllByText(/Falta tu fecha de vencimiento/i)
    expect(missingDateBadges.length).toBeGreaterThan(0)
  })

  it("Paso 5: Trabajador con continuidad 1 no puede elegir la opción 4->9 en el comparador", async () => {
    const contextContinuity1: WorkerContext = {
      ...mockContext,
      vacations: {
        ...mockContext.vacations!,
        continuityMark: 1,
      },
    }

    render(<VacationWizard initialContext={contextContinuity1} />)
    fireEvent.click(screen.getByText(/Comenzar simulación/i))
    fireEvent.click(screen.getByText(/Continuar a prioridades/i))
    fireEvent.click(screen.getByText(/Continuar a programación/i))

    // Ir a comparativa
    fireEvent.click(screen.getByText(/Comparar opciones/i))
    expect(screen.getByText("Comparativa de Opciones")).toBeDefined()

    // La opción 4->9 debe estar en el acordeón de modalidades no compatibles
    expect(screen.getByText(/Otras modalidades que existen, pero ahora no son compatibles/i)).toBeDefined()
    expect(screen.getByText(/Recibir la ayuda completa ahora \(Marca 4 → Marca 9\)/i)).toBeDefined()
    const lockedBadges = screen.getAllByText(/No disponible ✕/i)
    expect(lockedBadges.length).toBeGreaterThan(0)

    // Solo debe haber UN botón "Elegir esta opción" (para la opción disponible 1->1, NO para 4->9)
    const selectButtons = screen.getAllByRole("button", { name: /Elegir esta opción/i })
    expect(selectButtons).toHaveLength(1)
  })

  it("Paso 6: Un plan incompleto o inválido muestra aviso defensivo, oculta cifra hero y bloquea Guardar simulación", async () => {
    render(<VacationWizard initialContext={mockContext} />)
    fireEvent.click(screen.getByText(/Comenzar simulación/i))
    fireEvent.click(screen.getByText(/Continuar a prioridades/i))
    fireEvent.click(screen.getByText(/Continuar a programación/i))

    // Sin seleccionar rol ni marca, ir directo al resumen vía comparador o navegación
    // Si vamos al comparador y volvemos o avanzamos al resumen:
    fireEvent.click(screen.getByText(/Comparar opciones/i))
    fireEvent.click(screen.getByText(/Ver resumen del plan/i))

    expect(screen.getByText(/⚠️ Este plan todavía no es válido/i)).toBeDefined()
    expect(screen.getByText(/Importe no disponible por inconsistencias en el plan/i)).toBeDefined()
    expect(screen.getByText(/⚠️ Pendiente de corrección/i)).toBeDefined()

    // El botón Guardar simulación debe estar deshabilitado
    const saveButton = screen.getByRole("button", { name: /Guardar simulación/i })
    expect(saveButton).toBeDefined()
    expect((saveButton as HTMLButtonElement).disabled).toBe(true)

    // Debe mostrar botones para corregir los periodos con error
    expect(screen.getByText(/Corregir Periodo 1 →/i)).toBeDefined()
  })

  it("Paso 6: Muestra compatibilidad con datos actuales y aviso de autorización institucional", async () => {
    const fullyConfirmedContext: WorkerContext = {
      ...mockContext,
      vacations: {
        ...mockContext.vacations!,
        entitlements: [
          { id: "1", kind: "ORDINARY", periodNumber: 1, dueDate: "2026-10-14", confirmed: true, sourcePayslipPeriod: "2026-16" },
          { id: "2", kind: "ORDINARY", periodNumber: 2, dueDate: "2026-10-14", confirmed: true, sourcePayslipPeriod: "2026-16" },
        ],
      },
    }

    render(<VacationWizard initialContext={fullyConfirmedContext} />)
    fireEvent.click(screen.getByText(/Comenzar simulación/i))
    fireEvent.click(screen.getByText(/Continuar a prioridades/i))
    fireEvent.click(screen.getByText(/Continuar a programación/i))

    // Configurar periodo 1
    const availableBadgesP1 = screen.getAllByText(/Disponible ✓/i)
    const cardP1 = availableBadgesP1[0].closest("div[style*='cursor: pointer']")
    if (cardP1) fireEvent.click(cardP1)
    fireEvent.click(screen.getByText(/Elegir Marca 4/i))

    // Avanzar a periodo 2
    fireEvent.click(screen.getByText(/Siguiente periodo →/i))

    // Configurar periodo 2: rol no empalmado y marca
    const availableBadgesP2 = screen.getAllByText(/Disponible ✓/i)
    const cardP2 = availableBadgesP2[availableBadgesP2.length - 1].closest("div[style*='cursor: pointer']")
    if (cardP2) fireEvent.click(cardP2)

    const markCardP2 = screen.getByText(/Marca 9: Ayuda diferida/i).closest("div[style*='cursor: pointer']")
    if (markCardP2) fireEvent.click(markCardP2)

    // Avanzar a resumen
    fireEvent.click(screen.getByText(/Ver resumen del plan →/i))

    // Debe mostrar compatibilidad, NUNCA 'confirmada por el IMSS'
    expect(screen.getByText(/🟢 Plan compatible con tus datos actuales/i)).toBeDefined()
    expect(screen.getByText(/La programación definitiva está sujeta a validación y autorización institucional correspondiente/i)).toBeDefined()
    expect(screen.queryByText(/confirmado por el IMSS/i)).toBeNull()

    // Guardar simulación
    const saveButton = screen.getByRole("button", { name: /Guardar simulación/i })
    expect((saveButton as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(saveButton)
    expect(screen.getByText(/Simulación compatible guardada con éxito en tu cuenta/i)).toBeDefined()
  })

  it("Paso 6: Muestra simulación pendiente de confirmación cuando faltan datos por validar", async () => {
    // mockContext tiene el segundo periodo con confirmed: false
    render(<VacationWizard initialContext={mockContext} />)
    fireEvent.click(screen.getByText(/Comenzar simulación/i))
    fireEvent.click(screen.getByText(/Continuar a prioridades/i))
    fireEvent.click(screen.getByText(/Continuar a programación/i))

    // Configurar periodo 1
    const availableBadgesP1 = screen.getAllByText(/Disponible ✓/i)
    const cardP1 = availableBadgesP1[0].closest("div[style*='cursor: pointer']")
    if (cardP1) fireEvent.click(cardP1)
    fireEvent.click(screen.getByText(/Elegir Marca 4/i))

    // Avanzar a periodo 2
    fireEvent.click(screen.getByText(/Siguiente periodo →/i))

    // Configurar periodo 2: seleccionar rol no empalmado aunque requiera revisión
    const roleCardP2 = screen.getByText(/Rol #15\b/i).closest("div[style*='cursor: pointer']")
    if (roleCardP2) fireEvent.click(roleCardP2)

    const markCardP2 = screen.getByText(/Marca 9: Ayuda diferida/i).closest("div[style*='cursor: pointer']")
    if (markCardP2) fireEvent.click(markCardP2)

    // Avanzar a resumen
    fireEvent.click(screen.getByText(/Ver resumen del plan →/i))

    // Debe mostrar pendiente de confirmación con advertencia institucional
    expect(screen.getByText(/🟡 Simulación posible, pendiente de confirmación/i)).toBeDefined()
    expect(screen.getByText(/La programación definitiva está sujeta a validación y autorización institucional correspondiente/i)).toBeDefined()
    expect(screen.queryByText(/confirmado por el IMSS/i)).toBeNull()

    // Guardar como pendiente
    const saveButton = screen.getByRole("button", { name: /Guardar simulación/i })
    expect((saveButton as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(saveButton)
    expect(screen.getByText(/Simulación guardada en tu cuenta como simulación pendiente de confirmación oficial/i)).toBeDefined()
  })
})


