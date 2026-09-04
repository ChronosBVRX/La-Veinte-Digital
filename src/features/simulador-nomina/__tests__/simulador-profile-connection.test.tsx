// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, act, waitFor } from "@testing-library/react"
import { SimuladorNominaIndex, buildStateFromProfile } from "../components/SimuladorNominaIndex"
import { syncConfirmedPayslip } from "@/features/tarjeton/services/payslip-sync"
import { getProfile, saveProfile } from "@/shared/services/local-storage"
import type { EmployeePayrollProfile } from "@/features/nomina/lib/types"
import type { ConfirmTarjetonRequest, ConfirmTarjetonResponse } from "@/shared/contracts/tarjeton-import"

describe("Simulador de nómina: 4 escenarios independientes y persistencia canónica", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it("Escenario 1: Tarjetón importado — recargar/reabrir sin mostrar 'Sube tu tarjetón'", async () => {
    const payslipProfile: EmployeePayrollProfile = {
      id: "prof_tarjeton_imported",
      userId: "usr_tarjeton",
      consentGiven: true,
      employmentType: "base",
      occupationalConditions: [],
      siapConceptMarks: [],
      categoryName: "MEDICO NO FAMILIAR",
      categoryCode: "010800",
      workdayHours: 8,
      institutionalEntryDate: "2018-03-01",
      effectiveSeniorityDate: "2018-03-01",
      facts: [],
      recurringConcepts: [
        {
          conceptCode: "050",
          appearsNormally: true,
          lastAmount: 1500,
          confirmed: true,
          occurrenceType: "recurring",
          eligibilityPersistence: "persistent",
          source: "last_payslip",
        },
      ],
      createdAt: "2026-08-15T00:00:00Z",
      updatedAt: "2026-08-15T00:00:00Z",
    }

    // Persistir en el almacenamiento canónico
    saveProfile(payslipProfile)

    // Simular que el endpoint /api/worker-context devuelve los datos del tarjetón importado
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        employment: {
          categoryName: "MEDICO NO FAMILIAR",
          categoryCode: "010800",
          workdayHours: 8,
          institutionalEntryDate: "2018-03-01",
          effectiveSeniorityDate: "2018-03-01",
        },
        payroll: {
          recurringConcepts: payslipProfile.recurringConcepts,
          payrollFacts: [],
        },
      }),
    } as Response)

    render(<SimuladorNominaIndex />)

    // En ningún momento debe verse "Sube tu tarjetón para usar el simulador"
    expect(screen.queryByText(/Sube tu tarjetón para usar el simulador/i)).toBeNull()

    // Debe mostrar directamente el selector de simulación y opciones
    await waitFor(() => {
      expect(screen.getByText(/Cambio de categoría/i)).toBeDefined()
      expect(screen.getByText(/Más antigüedad/i)).toBeDefined()
    })

    // Comprobar que no existe el CTA de subida en la vista
    expect(screen.queryByText(/Sube tu tarjetón para usar el simulador/i)).toBeNull()
  })

  it("Escenario 2: Perfil manual completo — suficiente para simular sin tarjetón", () => {
    const manualProfile: EmployeePayrollProfile = {
      id: "prof_manual_full",
      userId: "usr_manual",
      consentGiven: true,
      employmentType: "base",
      occupationalConditions: [],
      siapConceptMarks: [],
      categoryName: "ENFERMERA GENERAL",
      categoryCode: "020800",
      workdayHours: 8,
      institutionalEntryDate: "2020-01-16",
      effectiveSeniorityDate: "2020-01-16",
      facts: [],
      recurringConcepts: [],
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    }

    const state = buildStateFromProfile(manualProfile)
    expect(state.step).toBe("select")
    expect(state.baseline).not.toBeNull()
    expect(state.baseline?.category.biweeklyBaseSalary).toBeGreaterThan(0)
    expect(state.baseline?.totalEarnings).toBeGreaterThan(0)
    expect(state.categories.length).toBeGreaterThan(0)
    expect(state.targetCategory).toBe("ENFERMERA GENERAL")
  })

  it("Escenario 3: Perfil vacío — muestra CTA amigable 'Subir mi tarjetón IMSS'", async () => {
    // API devuelve sin contexto
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ employment: null, payroll: null }),
    } as Response)

    render(<SimuladorNominaIndex />)

    // Debe mostrar el mensaje explicativo y el botón CTA
    await waitFor(() => {
      expect(screen.getByText(/Sube tu tarjetón para usar el simulador/i)).toBeDefined()
    })

    const cta = screen.getByRole("button", { name: /Subir mi tarjetón IMSS/i })
    expect(cta).toBeDefined()
  })

  it("Escenario 4: Estado de carga — esqueleto sin parpadeo del CTA", () => {
    // Mock diferido para verificar estado inicial inmediato de carga
    vi.spyOn(global, "fetch").mockReturnValue(new Promise(() => {}))

    render(<SimuladorNominaIndex />)

    // Debe mostrar indicador de carga
    expect(screen.getByText(/Cargando tu perfil.../i)).toBeDefined()

    // El CTA NUNCA debe estar en el DOM durante el estado de carga
    expect(screen.queryByText(/Sube tu tarjetón para usar el simulador/i)).toBeNull()
    expect(screen.queryByRole("button", { name: /Subir mi tarjetón IMSS/i })).toBeNull()
  })

  it("Demostración de lectura de persistencia canónica (getProfile y syncConfirmedPayslip)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ employment: null, payroll: null }),
    } as Response)

    render(<SimuladorNominaIndex />)

    await waitFor(() => {
      expect(screen.getByText(/Sube tu tarjetón para usar el simulador/i)).toBeDefined()
    })

    const confirmReq: ConfirmTarjetonRequest = {
      schemaVersion: "1.0",
      sourceHash: "hash_canonico_999",
      acknowledgeTotalDifference: false,
      authorizeServerStorage: true,
      parsed: {
        schemaVersion: "1.0",
        document: { type: "imss_payroll_receipt", pageCount: 1, periodRaw: "2026/16" },
        employee: {
          categoryName: "ENFERMERA GENERAL",
          categoryCode: "020800",
          workdayHours: 8,
          entryDate: "2019-05-01",
          seniority: { years: 7, days: 100, fortnights: 0, reconstructedEffectiveDate: "2019-05-01", raw: "07 100 00" },
        },
        attendance: {},
        vacations: {},
        payroll: {
          earnings: [{ lineIndex: 0, code: "002", description: "SUELDO", amount: 6000, kind: "earning", confidence: 0.95, confirmedByUser: true }],
          deductions: [],
          totalEarnings: 6000,
          totalDeductions: 0,
          netPay: 6000,
          observations: [],
        },
        extraction: {
          method: "native_text",
          globalConfidence: 0.95,
          warnings: [],
          validations: {
            templateDetected: true,
            earningsTotalMatches: true,
            deductionsTotalMatches: true,
            netPayMatches: true,
            employeeMatchesProfile: true,
            categoryResolved: true,
          },
        },
      },
      profileUpdates: { categoria: true, antiguedad: true },
    }

    const confirmRes: ConfirmTarjetonResponse = {
      schemaVersion: "1.0",
      id: "slip_canonico_1",
      duplicate: false,
      profileUpdated: true,
      payrollContextUpdated: true,
    }

    act(() => {
      syncConfirmedPayslip(confirmRes, confirmReq, "usr_canonico")
    })

    // Verificar que la persistencia canónica se actualizó
    const saved = getProfile()
    expect(saved).not.toBeNull()
    expect(saved?.categoryName).toBe("ENFERMERA GENERAL")

    // El simulador reacciona al evento canónico y renderiza la pantalla de simulación
    await waitFor(() => {
      expect(screen.getByText(/Cambio de categoría/i)).toBeDefined()
    })
  })
})
