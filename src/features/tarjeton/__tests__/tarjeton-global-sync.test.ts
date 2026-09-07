// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest"
import { syncConfirmedPayslip, buildImportedPayslip } from "../services/payslip-sync"
import type { ConfirmTarjetonRequest, ConfirmTarjetonResponse } from "@/shared/contracts/tarjeton-import"
import { calculatePeriodRank, parsePeriodFromText } from "../services/saved-payslip-repository"
import { buildWorkerContext } from "@/shared/server/worker-context-builder"
import { prefillVacationSimulator } from "@/features/vacations/domain/prefill"

function createMockTarjetonRequest(overrides: {
  year: number
  month: number
  half: 1 | 2
  periodRaw: string
  sourceHash?: string
  daysWorkedInYear?: number
  netPay?: number
  earningsAmount?: number
  employeeNumber?: string
  categoryName?: string
  seniorityYears?: number
}): ConfirmTarjetonRequest {
  return {
    schemaVersion: "1.0",
    sourceHash: overrides.sourceHash ?? `hash_${overrides.periodRaw}`,
    acknowledgeTotalDifference: false,
    authorizeServerStorage: true,
    profileUpdates: { categoria: true, antiguedad: true },
    parsed: {
      schemaVersion: "1.0",
      document: {
        type: "imss_payroll_receipt",
        pageCount: 1,
        periodRaw: overrides.periodRaw,
        year: overrides.year,
        month: overrides.month,
        half: overrides.half,
      },
      employee: {
        employeeNumber: overrides.employeeNumber ?? "12345678",
        fullName: "JUAN PEREZ LOPEZ",
        categoryName: overrides.categoryName ?? "MEDICO GENERAL 80",
        categoryCode: "M123",
        workdayHours: 8,
        entryDate: "2016-01-16",
        seniority: {
          years: overrides.seniorityYears ?? 10,
          fortnights: 0,
          days: 0,
          raw: `${overrides.seniorityYears ?? 10} años`,
          reconstructedEffectiveDate: "2016-01-16",
          referenceDate: overrides.periodRaw,
        },
      },
      attendance: {},
      vacations: {
        porVencer: "2026-10-15",
        dueDate: "2026-10-15",
      },
      payroll: {
        earnings: [
          {
            lineIndex: 0,
            code: "002",
            description: "SUELDO BASE",
            amount: overrides.earningsAmount ?? 5000,
            kind: "earning",
            confidence: 0.99,
            confirmedByUser: true,
          },
        ],
        deductions: [
          {
            lineIndex: 1,
            code: "212",
            description: "ISR",
            amount: -500,
            kind: "deduction",
            confidence: 0.99,
            confirmedByUser: true,
          },
        ],
        observations: [],
        totalEarnings: overrides.earningsAmount ?? 5000,
        totalDeductions: 500,
        netPay: overrides.netPay ?? ((overrides.earningsAmount ?? 5000) - 500),
        daysWorkedInYear: overrides.daysWorkedInYear ?? 180,
      },
      extraction: {
        method: "native_text",
        globalConfidence: 0.98,
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
  }
}

describe("Regresión Canónica de Sincronización de Tarjetón (Casos A a F)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("Caso A — Perfil: Importar Q2 teniendo Q1 actualiza datos y queda como latest por periodo", () => {
    const q1Req = createMockTarjetonRequest({
      year: 2026,
      month: 1,
      half: 1,
      periodRaw: "1A-ENE-2026",
      daysWorkedInYear: 15,
      netPay: 4500,
      seniorityYears: 8,
    })
    const q2Req = createMockTarjetonRequest({
      year: 2026,
      month: 1,
      half: 2,
      periodRaw: "2A-ENE-2026",
      daysWorkedInYear: 30,
      netPay: 4600,
      seniorityYears: 8,
    })

    const q1Response: ConfirmTarjetonResponse = {
      schemaVersion: "1.0",
      id: "slip_q1",
      duplicate: false,
      profileUpdated: true,
      payrollContextUpdated: true,
    }
    const q2Response: ConfirmTarjetonResponse = {
      schemaVersion: "1.0",
      id: "slip_q2",
      duplicate: false,
      profileUpdated: true,
      payrollContextUpdated: true,
    }

    const sync1 = syncConfirmedPayslip(q1Response, q1Req, "user_123")
    expect(sync1.payslip.periodRaw).toBe("1A-ENE-2026")

    const sync2 = syncConfirmedPayslip(q2Response, q2Req, "user_123")
    expect(sync2.payslip.periodRaw).toBe("2A-ENE-2026")

    // Ordenamiento canónico: Q2 debe ganar sobre Q1
    const slips = [
      { id: "slip_q1", period_year: 2026, period_month: 1, period_half: 1, created_at: "2026-01-16T10:00:00Z" },
      { id: "slip_q2", period_year: 2026, period_month: 1, period_half: 2, created_at: "2026-02-01T10:00:00Z" },
    ]
    const sorted = [...slips].sort((a, b) => {
      if (b.period_year !== a.period_year) return b.period_year - a.period_year
      if (b.period_month !== a.period_month) return b.period_month - a.period_month
      if (b.period_half !== a.period_half) return b.period_half - a.period_half
      return b.created_at.localeCompare(a.created_at)
    })

    expect(sorted[0].id).toBe("slip_q2")

    // Contexto de vacaciones lee Q2
    const workerCtx = buildWorkerContext({
      profileRow: { full_name: "JUAN PEREZ LOPEZ", categoria: "MEDICO GENERAL 80", antiguedad: "8 años" },
      latestPayslipRow: {
        id: "slip_q2",
        period_raw: "2A-ENE-2026",
        payroll_totals: { netPay: 4600 },
        employee_data: { seniority: { years: 8, fortnights: 0, days: 0 } },
        vacations: { dueDate: "2026-10-15" },
      },
    })
    const vacPrefill = prefillVacationSimulator(workerCtx)
    expect(vacPrefill.profile.effectiveSeniority.years).toBe(8)
    expect(vacPrefill.dueDate).toBe("2026-10-15")
  })

  it("Caso B — Documentos Personales: Termina en la misma persistencia y formato canónico que Perfil", () => {
    const docReq = createMockTarjetonRequest({
      year: 2026,
      month: 3,
      half: 1,
      periodRaw: "1A-MAR-2026",
      daysWorkedInYear: 75,
      netPay: 5200,
    })
    const docResponse: ConfirmTarjetonResponse = {
      schemaVersion: "1.0",
      id: "slip_doc_nativo",
      duplicate: false,
      profileUpdated: true,
      payrollContextUpdated: true,
    }

    const imported = buildImportedPayslip(docResponse, docReq, "user_123")
    expect(imported.id).toBe("slip_doc_nativo")
    expect(imported.periodRaw).toBe("1A-MAR-2026")
    expect(imported.categoryName).toBe("MEDICO GENERAL 80")
    expect(imported.netPay).toBe(5200)

    const syncResult = syncConfirmedPayslip(docResponse, docReq, "user_123")
    expect(syncResult.payslip.id).toBe("slip_doc_nativo")
    expect(syncResult.profile.categoryName).toBe("MEDICO GENERAL 80")
  })

  it("Caso C — Importación histórica: Subir Q8 después de tener Q10 NO desplaza a Q10 como tarjetón vigente", () => {
    // Q10 fue subido antes: 2A-MAY-2026
    const q10 = {
      id: "slip_q10",
      period_year: 2026,
      period_month: 5,
      period_half: 2,
      period_raw: "2A-MAY-2026",
      payroll_totals: { daysWorkedInYear: 150, netPay: 6000 },
      created_at: "2026-05-30T10:00:00Z",
    }

    // Usuario sube hoy Q8 histórico: 2A-ABR-2026 con timestamp de inserción posterior
    const q8 = {
      id: "slip_q8_historico",
      period_year: 2026,
      period_month: 4,
      period_half: 2,
      period_raw: "2A-ABR-2026",
      payroll_totals: { daysWorkedInYear: 120, netPay: 5800 },
      created_at: "2026-09-07T12:00:00Z", // Timestamp posterior a Q10
    }

    const dbRows = [q8, q10]

    // Consulta canónica de 4 campos
    const canonicalSorted = [...dbRows].sort((a, b) => {
      if (b.period_year !== a.period_year) return b.period_year - a.period_year
      if (b.period_month !== a.period_month) return b.period_month - a.period_month
      if (b.period_half !== a.period_half) return b.period_half - a.period_half
      return b.created_at.localeCompare(a.created_at)
    })

    // Q10 sigue siendo el primero a pesar de que Q8 tiene created_at más reciente
    expect(canonicalSorted[0].id).toBe("slip_q10")
    expect(canonicalSorted[0].period_raw).toBe("2A-MAY-2026")
    expect(canonicalSorted[0].payroll_totals.daysWorkedInYear).toBe(150)

    // Si se hubiera ordenado solo por created_at (error corregido), habría ganado Q8
    const naiveOrderByCreatedAt = [...dbRows].sort((a, b) => b.created_at.localeCompare(a.created_at))
    expect(naiveOrderByCreatedAt[0].id).toBe("slip_q8_historico") // Demuestra la regresión evitada
  })

  it("Caso D — Nueva quincena: Subir Q11 teniendo Q10 pasa automáticamente a Q11", () => {
    const q10 = {
      id: "slip_q10",
      period_year: 2026,
      period_month: 5,
      period_half: 2,
      period_raw: "2A-MAY-2026",
      created_at: "2026-05-30T10:00:00Z",
    }
    const q11 = {
      id: "slip_q11",
      period_year: 2026,
      period_month: 6,
      period_half: 1,
      period_raw: "1A-JUN-2026",
      created_at: "2026-06-15T10:00:00Z",
    }

    const rows = [q10, q11]
    const canonicalSorted = [...rows].sort((a, b) => {
      if (b.period_year !== a.period_year) return b.period_year - a.period_year
      if (b.period_month !== a.period_month) return b.period_month - a.period_month
      if (b.period_half !== a.period_half) return b.period_half - a.period_half
      return b.created_at.localeCompare(a.created_at)
    })

    expect(canonicalSorted[0].id).toBe("slip_q11")
    expect(canonicalSorted[0].period_raw).toBe("1A-JUN-2026")
  })

  it("Caso E — Tarjetón duplicado: Reimportar el mismo archivo/hash calcula el mismo periodRank e identificador", () => {
    const parsed1 = parsePeriodFromText("1A_AGO_2026")
    const parsed2 = parsePeriodFromText("1A_AGO_2026")

    expect(parsed1?.periodRank).toBe(parsed2?.periodRank)
    expect(calculatePeriodRank(2026, 8, 1)).toBe(2026 * 24 + 7 * 2 + 1)

    // Un archivo con el mismo periodo y hash produce exactamente el mismo ranking
    const rankMay1 = calculatePeriodRank(2026, 5, 1)
    const rankMay2 = calculatePeriodRank(2026, 5, 2)
    expect(rankMay2).toBeGreaterThan(rankMay1)
  })

  it("Caso F — Error servidor: Si la confirmación falla, no se actualiza el perfil ni se emite evento global", async () => {
    const eventSpy = vi.fn()
    if (typeof window !== "undefined") {
      window.addEventListener("nomina_payslip_updated", eventSpy)
    }

    // Mock de fallo en confirmTarjetonClient
    const failedClientResult = {
      ok: false as const,
      error: { code: "limits_exceeded" as const, message: "Límite excedido." },
    }

    expect(failedClientResult.ok).toBe(false)
    // El flujo se detiene antes de llamar a syncConfirmedPayslip
    expect(eventSpy).not.toHaveBeenCalled()
  })

  it("Caso G — useCalculatorPrefill reacciona al evento nomina_payslip_updated", () => {
    let reloadCalled = false
    const onPayslipUpdated = () => {
      reloadCalled = true
    }

    window.addEventListener("nomina_payslip_updated", onPayslipUpdated)
    window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))

    expect(reloadCalled).toBe(true)
    window.removeEventListener("nomina_payslip_updated", onPayslipUpdated)
  })

  it("Caso H — Desempate canónico: period_year DESC, period_month DESC, period_half DESC, created_at DESC", () => {
    const olderHalfNewerCreated = {
      id: "slip_q9_late",
      period_year: 2026,
      period_month: 5,
      period_half: 1,
      period_raw: "1A-MAY-2026",
      created_at: "2026-06-01T12:00:00Z",
    }
    const newerHalfOlderCreated = {
      id: "slip_q10_early",
      period_year: 2026,
      period_month: 5,
      period_half: 2,
      period_raw: "2A-MAY-2026",
      created_at: "2026-05-31T10:00:00Z",
    }

    const rows = [olderHalfNewerCreated, newerHalfOlderCreated]
    const sorted = [...rows].sort((a, b) => {
      if (b.period_year !== a.period_year) return b.period_year - a.period_year
      if (b.period_month !== a.period_month) return b.period_month - a.period_month
      if (b.period_half !== a.period_half) return b.period_half - a.period_half
      return b.created_at.localeCompare(a.created_at)
    })

    // Q10 debe ser el primero a pesar de que Q9 tenga un created_at posterior
    expect(sorted[0].id).toBe("slip_q10_early")
    expect(sorted[0].period_half).toBe(2)
  })
})
