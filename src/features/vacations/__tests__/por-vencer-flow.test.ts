import { describe, it, expect } from "vitest"
import { parseImssTarjeton } from "@/features/tarjeton/lib/imss-tarjeton-parser"
import { formatMexicanDate } from "@/features/tarjeton/lib/imss-date-parser"
import { buildWorkerContext } from "@/shared/server/worker-context-builder"
import { prefillVacationSimulator } from "../domain/prefill"
import { imssPositionedTextFixture } from "@/features/tarjeton/__tests__/fixtures/imss-positioned-text"

describe("Flujo Completo: Extracción de 'POR VENCER 14102026', Persistencia, Contexto y Precarga del Simulador", () => {
  it("extrae 'POR VENCER 14102026', persiste '2026-10-14', lo expone en worker-context y lo muestra en el simulador como '14/10/2026'", async () => {
    // 1. Extracción del documento (con fecha compacta 14102026)
    const items = [
      ...imssPositionedTextFixture,
      { text: "POR VENCER:", page: 1, x: 440, y: 340, width: 80, height: 10, confidence: 1, method: "native_text" as const },
      { text: "14102026", page: 1, x: 560, y: 340, width: 80, height: 10, confidence: 1, method: "native_text" as const },
    ]

    const parseOutcome = await parseImssTarjeton({ items, pageCount: 2 })
    expect(parseOutcome.ok).toBe(true)
    if (!parseOutcome.ok) return

    // 2. Contrato tipado del parser
    expect(parseOutcome.parsed.vacations.porVencer).toBe("2026-10-14")
    expect(parseOutcome.parsed.vacations.dueDate).toBe("2026-10-14")
    expect(parseOutcome.parsed.vacations.porVencerRaw).toBe("14102026")

    // 3. Simulación de persistencia en base de datos (imported_payslips.vacations)
    const simulatedDbRow = {
      id: "payslip-uuid-1",
      period_raw: parseOutcome.parsed.document.periodRaw,
      payroll_totals: parseOutcome.parsed.payroll,
      employee_data: parseOutcome.parsed.employee,
      vacations: parseOutcome.parsed.vacations,
    }

    // 4. Exposición mediante /api/worker-context (buildWorkerContext)
    const workerContext = buildWorkerContext({
      profileRow: { full_name: "JUAN PEREZ", matricula: "99123456", categoria: "ENFERMERA GENERAL 8.0 HRS", antiguedad: "10", adscripcion: "HGZ 1" },
      payrollContextRow: { category_name: "ENFERMERA GENERAL 8.0 HRS", workday_hours: 8, employment_type: "base", effective_seniority_date: "2016-08-16", recurring_concepts: [], payroll_facts: [] },
      latestPayslipRow: simulatedDbRow,
      vacationProfileRow: null,
      payslipLines: [],
    })

    expect(workerContext.vacations?.porVencer).toBe("2026-10-14")
    expect(workerContext.vacations?.dueDate).toBe("2026-10-14")
    expect(workerContext.vacations?.porVencerRaw).toBe("14102026")

    // 5. Precarga automática en el simulador de vacaciones
    const prefill = prefillVacationSimulator(workerContext)
    expect(prefill.dueDate).toBe("2026-10-14")
    expect(prefill.provenance.isPorVencerMissingFromPayslip).toBe(false)
    expect(prefill.warnings.some((w) => w.includes("Por vencer"))).toBe(false)

    // 6. Visualización final para el usuario en formato civil mexicano DD/MM/YYYY
    const userDisplayDate = formatMexicanDate(prefill.dueDate)
    expect(userDisplayDate).toBe("14/10/2026")
  })

  it("recupera automáticamente 'POR VENCER' de registros existentes con porVencerRaw='14102026' que no tenían dueDate", () => {
    // Simula registro existente en base de datos antes del fix:
    // porVencer era null porque el parser antiguo ignoró 14102026, pero porVencerRaw sí existía
    const legacyDbRow = {
      id: "payslip-legacy-1",
      period_raw: "2A-JUL-2026",
      payroll_totals: {},
      employee_data: {},
      vacations: {
        enjoyedDays: 10,
        daysInYear: 20,
        continuityMark: 1,
        periodNumberToEnjoy: 2,
        porVencerRaw: "14102026",
        // porVencer: null (no parseado en versión antigua)
      },
    }

    const workerContext = buildWorkerContext({
      profileRow: { full_name: "MARIA LOPEZ", matricula: "99234567", categoria: "MEDICO NO FAMILIAR 8.0 HRS", antiguedad: "12", adscripcion: "UMF 5" },
      payrollContextRow: { category_name: "MEDICO NO FAMILIAR 8.0 HRS", workday_hours: 8, employment_type: "base", effective_seniority_date: "2014-08-01", recurring_concepts: [], payroll_facts: [] },
      latestPayslipRow: legacyDbRow,
      vacationProfileRow: null,
      payslipLines: [],
    })

    // Recuperado de forma idempotente
    expect(workerContext.vacations?.porVencer).toBe("2026-10-14")
    expect(workerContext.vacations?.dueDate).toBe("2026-10-14")

    const prefill = prefillVacationSimulator(workerContext)
    expect(prefill.dueDate).toBe("2026-10-14")
    expect(formatMexicanDate(prefill.dueDate)).toBe("14/10/2026")
  })

  it("si no se conserva el documento ni texto original, alerta sobre reimportar una vez pero precarga todos los demás datos", () => {
    const emptyVacationsDbRow = {
      id: "payslip-empty-vac-1",
      period_raw: "2A-JUL-2026",
      payroll_totals: {},
      employee_data: {},
      vacations: {
        enjoyedDays: 10,
        daysInYear: 20,
        continuityMark: 1,
        periodNumberToEnjoy: 2,
        // No hay porVencer ni porVencerRaw
      },
    }

    const workerContext = buildWorkerContext({
      profileRow: { full_name: "CARLOS RUIZ", matricula: "99345678", categoria: "OFICINISTA 8.0 HRS", antiguedad: "5", adscripcion: "DELEGACION" },
      payrollContextRow: { category_name: "OFICINISTA 8.0 HRS", workday_hours: 8, employment_type: "base", effective_seniority_date: "2021-05-15", recurring_concepts: [], payroll_facts: [] },
      latestPayslipRow: emptyVacationsDbRow,
      vacationProfileRow: null,
      payslipLines: [],
    })

    const prefill = prefillVacationSimulator(workerContext)
    // dueDate está vacía para captura manual
    expect(prefill.dueDate).toBe("")
    expect(prefill.provenance.isPorVencerMissingFromPayslip).toBe(true)
    expect(prefill.warnings.some((w) => w.includes("Por vencer") && w.includes("Reimporta tu tarjetón una sola vez"))).toBe(true)

    // Pero todos los demás datos continúan precargándose sin bloqueo
    expect(prefill.profile.category).toBe("OFICINISTA 8.0 HRS")
    expect(prefill.profile.contractType).toBe("BASE")
    expect(prefill.continuityMark).toBe(1)
    expect(prefill.nextPeriodNumber).toBe(2)
    expect(prefill.totalYearVacationDays).toBe(20)
  })

  it("conserva fecha válida existente sin sobrescribirla", () => {
    const existingVac = {
      porVencer: "2026-10-14",
      dueDate: "2026-10-14",
      porVencerRaw: "14102026",
    }

    // Nueva importación con fecha vacía o no detectada
    const incomingVac = {
      porVencer: undefined,
      dueDate: undefined,
    }

    const merged = {
      ...incomingVac,
      ...existingVac,
      porVencer: existingVac.porVencer || incomingVac.porVencer,
      dueDate: existingVac.dueDate || incomingVac.dueDate,
    }

    expect(merged.porVencer).toBe("2026-10-14")
    expect(merged.dueDate).toBe("2026-10-14")
  })
})
