import { describe, it, expect } from "vitest"
import { parseImssTarjeton } from "@/features/tarjeton/lib/imss-tarjeton-parser"
import { sanitizeTarjetonForPersistence } from "@/features/tarjeton/lib/safe-values"
import { buildWorkerContext } from "@/shared/server/worker-context-builder"
import { prefillVacationSimulator } from "../domain/prefill"
import { evaluateVacationRoleEligibility } from "../domain/role-eligibility"
import { formatMexicanDate } from "@/features/tarjeton/lib/imss-date-parser"
import { imssPositionedTextFixture } from "@/features/tarjeton/__tests__/fixtures/imss-positioned-text"

describe("Integración: Tarjetón 14102026 → Perfil → Recarga → Simulador Vacacional", () => {
  it("sube tarjetón con '14102026', guarda perfil, recarga y asegura que el simulador recibe '2026-10-14'", async () => {
    // 1. Simulación de subida de tarjetón con fecha sin separadores "14102026"
    const items = [
      ...imssPositionedTextFixture,
      { text: "POR VENCER:", page: 1, x: 440, y: 340, width: 80, height: 10, confidence: 1, method: "native_text" as const },
      { text: "14102026", page: 1, x: 560, y: 340, width: 80, height: 10, confidence: 1, method: "native_text" as const },
    ]

    const parseOutcome = await parseImssTarjeton({ items, pageCount: 2 })
    expect(parseOutcome.ok).toBe(true)
    if (!parseOutcome.ok) return

    // 2. Parser y sanitización previa a persistir
    const sanitizedResult = sanitizeTarjetonForPersistence(parseOutcome.parsed)
    expect(sanitizedResult.critical.length).toBe(0)
    expect(sanitizedResult.parsed.vacations.porVencer).toBe("2026-10-14")
    expect(sanitizedResult.parsed.vacations.dueDate).toBe("2026-10-14")
    expect(sanitizedResult.parsed.vacations.porVencerRaw).toBe("14102026")

    // 3. Persistencia en base de datos (simulando tabla imported_payslips)
    const savedPayslipRow = {
      id: "payslip-integration-uuid-1",
      period_raw: parseOutcome.parsed.document.periodRaw,
      payroll_totals: parseOutcome.parsed.payroll,
      employee_data: parseOutcome.parsed.employee,
      vacations: sanitizedResult.parsed.vacations,
    }

    // 4. Recarga de la aplicación: se reconstruye el contexto del trabajador
    const reloadedWorkerContext = buildWorkerContext({
      profileRow: {
        full_name: "MARIO LOPEZ",
        matricula: "99112233",
        categoria: "ENFERMERA GENERAL 8.0 HRS",
        antiguedad: "6 años 0 qnas 0 días",
        adscripcion: "HGR 1",
      },
      payrollContextRow: {
        category_name: "ENFERMERA GENERAL 8.0 HRS",
        workday_hours: 8,
        employment_type: "base",
        effective_seniority_date: "2020-08-16",
        recurring_concepts: [],
        payroll_facts: [],
      },
      latestPayslipRow: savedPayslipRow,
      vacationProfileRow: null,
      payslipLines: [],
    })

    // Asegurar que el contexto reconstruido recibe exactamente la fecha civil canónica 2026-10-14
    expect(reloadedWorkerContext.vacations?.porVencer).toBe("2026-10-14")
    expect(reloadedWorkerContext.vacations?.dueDate).toBe("2026-10-14")
    expect(reloadedWorkerContext.vacations?.entitlements?.[0]?.dueDate).toBe("2026-10-14")
    expect(reloadedWorkerContext.vacations?.entitlements?.[0]?.dueDateConfidence).toBe("CONFIRMED")
    expect(reloadedWorkerContext.vacations?.entitlements?.[0]?.dueDateSource).toBe("TARJETON")

    // El segundo periodo se proyecta exclusivamente para la simulación (+6 meses para semestral)
    expect(reloadedWorkerContext.vacations?.entitlements?.[1]?.dueDate).toBe("2027-04-14")
    expect(reloadedWorkerContext.vacations?.entitlements?.[1]?.dueDateConfidence).toBe("PROVISIONAL")
    expect(reloadedWorkerContext.vacations?.entitlements?.[1]?.dueDateSource).toBe("PROJECTED")

    // 5. Carga del simulador: prefillVacationSimulator recibe 2026-10-14 y formato civil 14/10/2026
    const simulatorInput = prefillVacationSimulator(reloadedWorkerContext)
    expect(simulatorInput.dueDate).toBe("2026-10-14")
    expect(formatMexicanDate(simulatorInput.dueDate)).toBe("14/10/2026")
    expect(simulatorInput.entitlements[0].dueDate).toBe("2026-10-14")
    expect(simulatorInput.entitlements[1].dueDate).toBe("2027-04-14")
  })

  it("permite seleccionar roles compatibles en calendario DRAFT para simulación sin presentarlos como autorización oficial", () => {
    // Rol que inicia el 2026-07-01 (dentro de los 120 días antes de 2026-10-14)
    const resDraft = evaluateVacationRoleEligibility({
      regime: "SEMESTRAL",
      entitlementKind: "ORDINARY",
      dueDate: "2026-10-14",
      dueDateConfidence: "CONFIRMED",
      roleStartDate: "2026-07-01",
      calendarYear: 2026,
      calendarStatus: "DRAFT",
    })

    // Separación limpia de evaluaciones:
    expect(resDraft.evaluation.dateEligibility).toBe("ELIGIBLE")
    expect(resDraft.evaluation.calendarCertainty).toBe("PRELIMINARY")
    expect(resDraft.evaluation.selectableForSimulation).toBe(true)
    expect(resDraft.evaluation.confirmableAsOfficial).toBe(false)

    // Mensajes para el trabajador
    expect(resDraft.status).toBe("REQUIRES_REVIEW")
    expect(resDraft.reasonCode).toBe("CALENDAR_DRAFT")
    expect(resDraft.workerMessage).toContain("Compatible con tus fechas")
    expect(resDraft.workerMessage).toContain("confirma el rol cuando se publique el calendario oficial")

    // Comparar con el mismo rol en calendario PUBLISHED oficial:
    const resOfficial = evaluateVacationRoleEligibility({
      regime: "SEMESTRAL",
      entitlementKind: "ORDINARY",
      dueDate: "2026-10-14",
      dueDateConfidence: "CONFIRMED",
      roleStartDate: "2026-07-01",
      calendarYear: 2026,
      calendarStatus: "PUBLISHED",
    })

    expect(resOfficial.evaluation.dateEligibility).toBe("ELIGIBLE")
    expect(resOfficial.evaluation.calendarCertainty).toBe("OFFICIAL")
    expect(resOfficial.evaluation.selectableForSimulation).toBe(true)
    expect(resOfficial.evaluation.confirmableAsOfficial).toBe(true)
    expect(resOfficial.status).toBe("ALLOWED")
    expect(resOfficial.reasonCode).toBe("ROLE_ALLOWED")
  })

  it("bloquea roles incompatibles por exceder anticipación tanto en DRAFT como en PUBLISHED", () => {
    // Rol que inicia el 2026-05-01 (166 días antes de 2026-10-14, excede 120 días)
    const resBlockedDraft = evaluateVacationRoleEligibility({
      regime: "SEMESTRAL",
      entitlementKind: "ORDINARY",
      dueDate: "2026-10-14",
      dueDateConfidence: "CONFIRMED",
      roleStartDate: "2026-05-01",
      calendarYear: 2026,
      calendarStatus: "DRAFT",
    })

    expect(resBlockedDraft.evaluation.dateEligibility).toBe("NOT_ELIGIBLE")
    expect(resBlockedDraft.evaluation.selectableForSimulation).toBe(false)
    expect(resBlockedDraft.evaluation.confirmableAsOfficial).toBe(false)
    expect(resBlockedDraft.status).toBe("BLOCKED")
    expect(resBlockedDraft.reasonCode).toBe("EXCEEDS_ANTICIPATION")
  })
})
