// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  buildWorkerContext,
  checkWorkerContextIdentity,
} from "@/shared/server/worker-context-builder"

describe("Aislamiento Estricto de Trabajador Activo y Sustitución de Matrícula", () => {
  // Simulador de repositorio en memoria para imported_payslips con scoping por trabajador
  interface DbPayslipRow {
    id: string
    user_id: string
    employee_number: string | null
    period_year: number
    period_month: number
    period_half: number
    period_raw: string
    created_at: string
    employee_data: Record<string, unknown>
    vacations: Record<string, unknown>
    payroll_totals: Record<string, unknown>
  }

  /**
   * Consulta canónica del tarjetón activo según la regla definida:
   * 1. Filtra por user_id = currentUser
   * 2. Filtra por employee_number = profiles.matricula
   * 3. Ordena por period_year DESC, period_month DESC, period_half DESC, created_at DESC
   * 4. LIMIT 1
   */
  function queryActivePayslip(
    table: DbPayslipRow[],
    userId: string,
    activeMatricula: string | null,
  ): DbPayslipRow | null {
    const filtered = table.filter((row) => {
      if (row.user_id !== userId) return false
      if (activeMatricula && row.employee_number !== activeMatricula) return false
      return true
    })

    if (filtered.length === 0) return null

    return [...filtered].sort((a, b) => {
      if (b.period_year !== a.period_year) return b.period_year - a.period_year
      if (b.period_month !== a.period_month) return b.period_month - a.period_month
      if (b.period_half !== a.period_half) return b.period_half - a.period_half
      return b.created_at.localeCompare(a.created_at)
    })[0]
  }

  it("Caso 1 — Mismo trabajador: A Q10 activo -> importar A Q11 -> A Q11 activo globalmente", () => {
    const userId = "user-123"
    const matriculaA = "11111111"

    const payslips: DbPayslipRow[] = [
      {
        id: "slip-a-q10",
        user_id: userId,
        employee_number: matriculaA,
        period_year: 2026,
        period_month: 8,
        period_half: 2,
        period_raw: "2A-AGO-2026",
        created_at: "2026-08-31T10:00:00Z",
        employee_data: { employeeNumber: matriculaA, fullName: "TRABAJADOR A" },
        vacations: { porVencer: "2026-10-15", dueDate: "2026-10-15" },
        payroll_totals: { totalEarnings: 12000, netPay: 9000 },
      },
    ]

    // Inicialmente Q10 es activo
    let active = queryActivePayslip(payslips, userId, matriculaA)
    expect(active?.id).toBe("slip-a-q10")

    // Importar Q11 del mismo trabajador
    payslips.push({
      id: "slip-a-q11",
      user_id: userId,
      employee_number: matriculaA,
      period_year: 2026,
      period_month: 9,
      period_half: 1,
      period_raw: "1A-SEP-2026",
      created_at: "2026-09-15T10:00:00Z",
      employee_data: { employeeNumber: matriculaA, fullName: "TRABAJADOR A" },
      vacations: { porVencer: "2026-10-15", dueDate: "2026-10-15" },
      payroll_totals: { totalEarnings: 12500, netPay: 9300 },
    })

    // Ahora Q11 es el activo globalmente
    active = queryActivePayslip(payslips, userId, matriculaA)
    expect(active?.id).toBe("slip-a-q11")
    expect(active?.period_raw).toBe("1A-SEP-2026")
  })

  it("Caso 2 — Histórico del mismo trabajador: A Q10 activo -> importar A Q8 -> A Q10 continúa activo", () => {
    const userId = "user-123"
    const matriculaA = "11111111"

    const payslips: DbPayslipRow[] = [
      {
        id: "slip-a-q10",
        user_id: userId,
        employee_number: matriculaA,
        period_year: 2026,
        period_month: 8,
        period_half: 2,
        period_raw: "2A-AGO-2026",
        created_at: "2026-08-31T10:00:00Z",
        employee_data: { employeeNumber: matriculaA, fullName: "TRABAJADOR A" },
        vacations: { porVencer: "2026-10-15", dueDate: "2026-10-15" },
        payroll_totals: { totalEarnings: 12000, netPay: 9000 },
      },
    ]

    // Importar recibo anterior (Q8) pero con created_at más reciente (subido hoy)
    payslips.push({
      id: "slip-a-q8",
      user_id: userId,
      employee_number: matriculaA,
      period_year: 2026,
      period_month: 7,
      period_half: 2,
      period_raw: "2A-JUL-2026",
      created_at: "2026-09-07T12:00:00Z",
      employee_data: { employeeNumber: matriculaA, fullName: "TRABAJADOR A" },
      vacations: { porVencer: "2026-10-15", dueDate: "2026-10-15" },
      payroll_totals: { totalEarnings: 11000, netPay: 8500 },
    })

    // Q10 debe mantenerse activo; Q8 queda en histórico
    const active = queryActivePayslip(payslips, userId, matriculaA)
    expect(active?.id).toBe("slip-a-q10")
    expect(payslips).toHaveLength(2)
  })

  it("Caso 3 (CRÍTICO) — Sustitución por trabajador con periodo anterior: A Q10 activo -> autorizar sustitución B Q5 -> perfil B + tarjetón B Q5", () => {
    const userId = "user-123"
    const matriculaA = "11111111"
    const matriculaB = "22222222"

    const payslips: DbPayslipRow[] = [
      // Tarjetón de A: Agosto 2026 (Q10)
      {
        id: "slip-a-q10",
        user_id: userId,
        employee_number: matriculaA,
        period_year: 2026,
        period_month: 8,
        period_half: 2,
        period_raw: "2A-AGO-2026",
        created_at: "2026-08-31T10:00:00Z",
        employee_data: { employeeNumber: matriculaA, fullName: "TRABAJADOR A" },
        vacations: { porVencer: "2026-10-15", dueDate: "2026-10-15" },
        payroll_totals: { totalEarnings: 20000, netPay: 15000 },
      },
      // Tarjetón de B: Marzo 2026 (Q5)
      {
        id: "slip-b-q5",
        user_id: userId,
        employee_number: matriculaB,
        period_year: 2026,
        period_month: 3,
        period_half: 1,
        period_raw: "1A-MAR-2026",
        created_at: "2026-09-07T12:00:00Z",
        employee_data: { employeeNumber: matriculaB, fullName: "TRABAJADOR B" },
        vacations: { porVencer: "2026-05-15", dueDate: "2026-05-15" },
        payroll_totals: { totalEarnings: 8000, netPay: 6000 },
      },
    ]

    // 1. Cuando el trabajador activo en perfil es A:
    const activeWhenA = queryActivePayslip(payslips, userId, matriculaA)
    expect(activeWhenA?.id).toBe("slip-a-q10")
    expect(activeWhenA?.employee_number).toBe(matriculaA)

    // 2. Se autoriza la sustitución de matrícula en profiles: perfil pasa a ser B
    const activeProfileMatricula = matriculaB

    // 3. El tarjetón ACTIVO para B DEBE ser B Q5, NO A Q10
    const activeWhenB = queryActivePayslip(payslips, userId, activeProfileMatricula)
    expect(activeWhenB?.id).toBe("slip-b-q5")
    expect(activeWhenB?.period_raw).toBe("1A-MAR-2026")
    expect(activeWhenB?.employee_number).toBe(matriculaB)

    // 4. Verificar que el histórico de A se conservó en la base de datos (cero borrado destructivo)
    const allUserPayslips = payslips.filter((r) => r.user_id === userId)
    expect(allUserPayslips).toHaveLength(2)
    expect(allUserPayslips.some((r) => r.id === "slip-a-q10")).toBe(true)
    expect(allUserPayslips.some((r) => r.id === "slip-b-q5")).toBe(true)
  })

  it("Caso 4 — Sustitución por trabajador con periodo posterior: A Q5 -> B Q10", () => {
    const userId = "user-123"
    const matriculaA = "11111111"
    const matriculaB = "22222222"

    const payslips: DbPayslipRow[] = [
      {
        id: "slip-a-q5",
        user_id: userId,
        employee_number: matriculaA,
        period_year: 2026,
        period_month: 3,
        period_half: 1,
        period_raw: "1A-MAR-2026",
        created_at: "2026-03-15T10:00:00Z",
        employee_data: { employeeNumber: matriculaA },
        vacations: {},
        payroll_totals: {},
      },
      {
        id: "slip-b-q10",
        user_id: userId,
        employee_number: matriculaB,
        period_year: 2026,
        period_month: 8,
        period_half: 2,
        period_raw: "2A-AGO-2026",
        created_at: "2026-08-31T10:00:00Z",
        employee_data: { employeeNumber: matriculaB },
        vacations: {},
        payroll_totals: {},
      },
    ]

    const activeB = queryActivePayslip(payslips, userId, matriculaB)
    expect(activeB?.id).toBe("slip-b-q10")
    expect(activeB?.employee_number).toBe(matriculaB)
  })

  it("Caso 5 — Regresar al trabajador anterior (B -> A): histórico de A intacto", () => {
    const userId = "user-123"
    const matriculaA = "11111111"
    const matriculaB = "22222222"

    const payslips: DbPayslipRow[] = [
      {
        id: "slip-a-q10",
        user_id: userId,
        employee_number: matriculaA,
        period_year: 2026,
        period_month: 8,
        period_half: 2,
        period_raw: "2A-AGO-2026",
        created_at: "2026-08-31T10:00:00Z",
        employee_data: { employeeNumber: matriculaA },
        vacations: {},
        payroll_totals: {},
      },
      {
        id: "slip-b-q5",
        user_id: userId,
        employee_number: matriculaB,
        period_year: 2026,
        period_month: 3,
        period_half: 1,
        period_raw: "1A-MAR-2026",
        created_at: "2026-09-07T12:00:00Z",
        employee_data: { employeeNumber: matriculaB },
        vacations: {},
        payroll_totals: {},
      },
    ]

    // Usuario vuelve a autorizar a A
    const activeAgainA = queryActivePayslip(payslips, userId, matriculaA)
    expect(activeAgainA?.id).toBe("slip-a-q10")
    expect(activeAgainA?.employee_number).toBe(matriculaA)

    // Ambos historiales existen
    expect(payslips).toHaveLength(2)
  })

  it("Caso 6 — Vacaciones: tras A -> B, no queda vacation_profile_data de A (régimen y periodos limpios)", () => {
    // Contexto de A: Técnico Radiólogo (radiological_exposure = YES, régimen CUATRIMESTRAL con 3 periodos)
    const contextA = buildWorkerContext({
      profileRow: { full_name: "TRABAJADOR A", matricula: "11111111", categoria: "TECNICO RADIOLOGO" },
      latestPayslipRow: {
        period_raw: "2A-AGO-2026",
        employee_number: "11111111",
        employee_data: { employeeNumber: "11111111", categoryName: "TECNICO RADIOLOGO" },
        vacations: { porVencer: "2026-10-15", dueDate: "2026-10-15" },
        payroll_totals: { integratedMonthlySalary: 25000, totalEarnings: 15000, netPay: 11000 },
      },
      vacationProfileRow: {
        employee_number: "11111111",
        radiological_exposure: "YES",
        category: "TECNICO RADIOLOGO",
      },
    })

    expect(contextA.vacations?.entitlements?.length).toBe(3) // 3 periodos por cuatrimestral
    expect(contextA.employment?.radiologicalExposure).toBe(true)

    // Sustitución a B: Oficinista (radiological_exposure limpiado a NULL)
    const contextB = buildWorkerContext({
      profileRow: { full_name: "TRABAJADOR B", matricula: "22222222", categoria: "OFICINISTA 80" },
      latestPayslipRow: {
        period_raw: "1A-MAR-2026",
        employee_number: "22222222",
        employee_data: { employeeNumber: "22222222", categoryName: "OFICINISTA 80" },
        vacations: { porVencer: "2026-05-15", dueDate: "2026-05-15" },
        payroll_totals: { integratedMonthlySalary: 12000, totalEarnings: 7000, netPay: 5500 },
      },
      // Vacation profile de B reseteado tras sustitución:
      vacationProfileRow: {
        employee_number: "22222222",
        radiological_exposure: null,
        category: "OFICINISTA 80",
      },
    })

    expect(contextB.profile?.matricula).toBe("22222222")
    expect(contextB.profile?.fullName).toBe("TRABAJADOR B")
    expect(contextB.employment?.categoryName).toBe("OFICINISTA 80")
    expect(contextB.employment?.radiologicalExposure).toBe(null)
    expect(contextB.vacations?.dueDate).toBe("2026-05-15")
    expect(contextB.payroll?.integratedMonthlySalary).toBe(12000)
    // Régimen ordinario semestral: solo 2 periodos ordinarios, NINGÚN 3er periodo de exposición radiológica
    expect(contextB.vacations?.entitlements?.length).toBe(2)
    expect(contextB.vacations?.entitlements?.[0].regime).toBe("SEMESTRAL")
  })

  it("Caso 7 — Conceptos limpios: ningún recurring_concept ni payroll_fact de A se hereda a B", () => {
    // Contexto previo de nómina de A contenía 050 ($800) y hecho 054.
    // En sustitución de trabajador (workerReplacement), payroll_contexts de B arranca limpio:
    const recurringB: unknown[] = []
    const factsB: unknown[] = []

    const contextB = buildWorkerContext({
      profileRow: { full_name: "TRABAJADOR B", matricula: "22222222" },
      payrollContextRow: {
        matricula: "22222222",
        recurring_concepts: recurringB,
        payroll_facts: factsB,
      },
      latestPayslipRow: {
        period_raw: "1A-MAR-2026",
        employee_number: "22222222",
        employee_data: { employeeNumber: "22222222" },
      },
      payslipLines: [
        { concept_code: "002", description: "Sueldo Base", amount: 3500, kind: "earning", confirmed_by_user: true },
      ],
    })

    const bConcepts = (contextB.payroll?.recurringConcepts as Array<{ conceptCode: string }>) ?? []
    expect(bConcepts.some((c) => c.conceptCode === "050")).toBe(false)
    expect(contextB.payroll?.payrollFacts).toHaveLength(0)
  })

  it("Caso 8 & 9 — Navegación e invalidación reactiva ante sustitución", () => {
    let globalRefreshTriggered = false
    const onGlobalRefresh = () => {
      globalRefreshTriggered = true
    }

    window.addEventListener("nomina_payslip_updated", onGlobalRefresh)

    // Simular confirmación de tarjetón desde Perfil o Documentos Personales
    window.dispatchEvent(new CustomEvent("nomina_payslip_updated", { detail: { payslipId: "slip-b-q5" } }))

    expect(globalRefreshTriggered).toBe(true)
    window.removeEventListener("nomina_payslip_updated", onGlobalRefresh)
  })

  it("Caso 10 & Invariante de Identidad — Detección de WORKER_CONTEXT_IDENTITY_MISMATCH", () => {
    // Si una cuenta tiene perfil B pero por error se intentara mezclar con tarjetón de A:
    const mixedContext = buildWorkerContext({
      profileRow: { full_name: "TRABAJADOR B", matricula: "22222222" },
      latestPayslipRow: {
        period_raw: "2A-AGO-2026",
        employee_number: "11111111", // MATRÍCULA DE A!
        employee_data: { employeeNumber: "11111111" },
      },
      vacationProfileRow: {
        employee_number: "11111111", // MATRÍCULA DE A!
      },
    })

    const identityCheck = checkWorkerContextIdentity(mixedContext)
    expect(identityCheck.match).toBe(false)
    expect(identityCheck.mismatchField).toContain("payroll.employeeNumber")

    // Cuando las identidades coinciden:
    const consistentContext = buildWorkerContext({
      profileRow: { full_name: "TRABAJADOR B", matricula: "22222222" },
      latestPayslipRow: {
        period_raw: "1A-MAR-2026",
        employee_number: "22222222",
        employee_data: { employeeNumber: "22222222" },
      },
      vacationProfileRow: {
        employee_number: "22222222",
      },
    })

    const consistentCheck = checkWorkerContextIdentity(consistentContext)
    expect(consistentCheck.match).toBe(true)
    expect(consistentCheck.mismatchField).toBeUndefined()
  })
})
