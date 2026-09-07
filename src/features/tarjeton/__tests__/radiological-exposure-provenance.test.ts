import { describe, expect, it } from "vitest"
import {
  buildWorkerContext,
  resolveCurrentRadiologicalExposure,
  type PayslipLineRow,
} from "@/shared/server/worker-context-builder"
import { prefillVacationSimulator } from "@/features/vacations/domain/prefill"

describe("Separación Canónica: Evidencia Histórica vs Estado Actual de Exposición Radiológica (Concepto 054)", () => {
  const line054Active: PayslipLineRow = {
    concept_code: "054",
    description: "Emanaciones Radiactivas",
    amount: 1400,
    kind: "earning",
    confirmed_by_user: true,
  }

  const line002Base: PayslipLineRow = {
    concept_code: "002",
    description: "Sueldo Base",
    amount: 4500,
    kind: "earning",
    confirmed_by_user: true,
  }

  it("TEST 1 — El bug reportado: A tenía 054, sustitución a B sin 054 -> B radiologicalExposure = false y régimen SEMESTRAL", () => {
    // Tarjetón activo de B (Q11): NO contiene 054
    const contextB = buildWorkerContext({
      profileRow: {
        full_name: "TRABAJADOR B",
        matricula: "22222222",
        categoria: "AUXILIAR UNIVERSAL DE OFICINA",
      },
      latestPayslipRow: {
        employee_number: "22222222",
        period_raw: "1A-JUN-2026",
        payroll_totals: { integratedMonthlySalary: 12000 },
        vacations: { porVencer: "2026-08-15", dueDate: "2026-08-15" },
      },
      payslipLines: [line002Base], // Solo sueldo base, NINGÚN 054
      payrollContextRow: {
        matricula: "22222222",
        // El trabajador A anterior tenía un hecho 054 registrado en la BD o arrastrado históricamente
        payroll_facts: [
          { key: "concept_054_on_payslip", value: true, source: "payslip_import_worker_a" },
        ],
      },
      vacationProfileRow: {
        employee_number: "22222222",
        radiological_exposure: null,
        radiological_exposure_source: "ACTIVE_PAYSLIP",
      },
    })

    // La condición laboral actual del trabajador B DEBE ser false (no está expuesto)
    expect(contextB.employment?.radiologicalExposure).toBe(false)
    expect(contextB.employment?.radiologicalExposureSource).toBe("ACTIVE_PAYSLIP")

    // El régimen vacacional resuelto en WorkerContext DEBE ser SEMESTRAL (2 periodos ordinarios)
    expect(contextB.vacations?.entitlements?.length).toBe(2)
    expect(contextB.vacations?.entitlements?.[0].regime).toBe("SEMESTRAL")

    // El simulador de vacaciones prerrellenado DEBE recibir false y régimen SEMESTRAL
    const prefilled = prefillVacationSimulator(contextB)
    expect(prefilled.profile.radiologicalExposure).toBe(false)
    expect(prefilled.regime).toBe("SEMESTRAL")
  })

  it("TEST 2 — Mismo trabajador deja de tener 054: A Q10 tenía 054, A Q11 no tiene 054 -> radiologicalExposure = false", () => {
    // Mismo trabajador A (11111111) en su quincena más reciente Q11 ya no percibe 054
    const contextQ11 = buildWorkerContext({
      profileRow: {
        full_name: "TRABAJADOR A",
        matricula: "11111111",
      },
      latestPayslipRow: {
        employee_number: "11111111",
        period_raw: "2A-MAY-2026",
        payroll_totals: { integratedMonthlySalary: 15000 },
      },
      payslipLines: [line002Base], // Sin 054 en este periodo
      payrollContextRow: {
        matricula: "11111111",
        // En su historial de nómina existe el registro de que en Q10 vio 054
        payroll_facts: [
          { key: "concept_054_on_payslip", value: true, sourcePeriod: "1A-MAY-2026", recordedAt: "2026-05-15" },
        ],
      },
    })

    // El estado actual no debe consultar el tarjetón anterior ni el fact histórico
    expect(contextQ11.employment?.radiologicalExposure).toBe(false)
    expect(contextQ11.employment?.radiologicalExposureSource).toBe("ACTIVE_PAYSLIP")

    const prefilled = prefillVacationSimulator(contextQ11)
    expect(prefilled.profile.radiologicalExposure).toBe(false)
    expect(prefilled.regime).toBe("SEMESTRAL")
  })

  it("TEST 3 — Tarjetón activo sí contiene 054: radiologicalExposure = true y régimen CUATRIMESTRAL", () => {
    const contextWith054 = buildWorkerContext({
      profileRow: {
        full_name: "TECNICO RADIOLOGO",
        matricula: "33333333",
      },
      latestPayslipRow: {
        employee_number: "33333333",
        period_raw: "1A-JUN-2026",
        payroll_totals: { integratedMonthlySalary: 18000 },
        vacations: { porVencer: "2026-08-15", dueDate: "2026-08-15" },
      },
      payslipLines: [line002Base, line054Active], // Contiene 054 confirmado
    })

    expect(contextWith054.employment?.radiologicalExposure).toBe(true)
    expect(contextWith054.employment?.radiologicalExposureSource).toBe("ACTIVE_PAYSLIP")

    // Régimen CUATRIMESTRAL (3 periodos cuatrimestrales)
    expect(contextWith054.vacations?.entitlements?.length).toBe(3)
    expect(contextWith054.vacations?.entitlements?.[0].regime).toBe("CUATRIMESTRAL")

    const prefilled = prefillVacationSimulator(contextWith054)
    expect(prefilled.profile.radiologicalExposure).toBe(true)
    expect(prefilled.regime).toBe("CUATRIMESTRAL")
  })

  it("TEST 4 — Histórico existe en payroll_facts pero tarjetón activo no tiene 054: radiologicalExposure = false", () => {
    // Hecho histórico pegajoso: concept_054_on_payslip = true
    const exposure = resolveCurrentRadiologicalExposure({
      activeEmployeeNumber: "44444444",
      latestPayslip: {
        employee_number: "44444444",
        period_raw: "1A-JUL-2026",
      },
      payslipLines: [line002Base], // NO tiene 054
    })

    // Debe resolver false obligatoriamente (ignorar hechos históricos)
    expect(exposure.radiologicalExposure).toBe(false)
    expect(exposure.source).toBe("ACTIVE_PAYSLIP")
  })

  it("TEST 5 — Reimportación duplicada: A tenía 054, B sin 054 ya existía; reimportar exacto B reconcilia y da false", () => {
    // Simula la reconciliación activa ejecutada en el RPC confirm_imported_payslip_v1 tras duplicate:
    // B ya existía, pero el perfil fue cambiado de A a B. El tarjetón duplicado de B no tiene 054.
    const contextDuplicateB = buildWorkerContext({
      profileRow: {
        full_name: "TRABAJADOR B",
        matricula: "22222222",
      },
      latestPayslipRow: {
        employee_number: "22222222",
        period_raw: "1A-MAR-2026",
        vacations: { porVencer: "2026-08-15", dueDate: "2026-08-15" },
      },
      payslipLines: [line002Base], // Líneas del tarjetón duplicado B: sin 054
      payrollContextRow: {
        matricula: "22222222",
        payroll_facts: [], // Limpio tras reconciliación de workerReplacement
      },
      vacationProfileRow: {
        employee_number: "22222222",
        radiological_exposure: "NO",
        radiological_exposure_source: "ACTIVE_PAYSLIP",
      },
    })

    expect(contextDuplicateB.profile?.matricula).toBe("22222222")
    expect(contextDuplicateB.employment?.radiologicalExposure).toBe(false)
    expect(contextDuplicateB.vacations?.entitlements?.[0].regime).toBe("SEMESTRAL")
  })

  it("TEST 6 — Legacy vacation profile contaminado: employee_number = B con YES pero source = LEGACY -> radiologicalExposure = false", () => {
    // Registro que fue backfilled o arrastrado con YES antes de la trazabilidad de procedencia
    const contextContaminated = buildWorkerContext({
      profileRow: {
        full_name: "TRABAJADOR B",
        matricula: "22222222",
      },
      latestPayslipRow: {
        employee_number: "22222222",
        period_raw: "1A-JUL-2026",
        vacations: { porVencer: "2026-08-15", dueDate: "2026-08-15" },
      },
      payslipLines: [line002Base], // B en la realidad no tiene 054
      vacationProfileRow: {
        employee_number: "22222222",
        radiological_exposure: "YES", // Legacy contaminado de A
        radiological_exposure_source: "LEGACY", // Fuente NO confirmada por el usuario
      },
    })

    // NO aceptar YES legacy: el tarjetón activo de B (sin 054) manda
    expect(contextContaminated.employment?.radiologicalExposure).toBe(false)
    expect(contextContaminated.employment?.radiologicalExposureSource).toBe("ACTIVE_PAYSLIP")

    const prefilled = prefillVacationSimulator(contextContaminated)
    expect(prefilled.profile.radiologicalExposure).toBe(false)
    expect(prefilled.regime).toBe("SEMESTRAL")
  })

  it("TEST 7 — Manual explícito con USER_CONFIRMED: B confirma para su matrícula -> se respeta true", () => {
    // B confirma manualmente que trabaja en zona de radiación aunque su tarjetón actual no desglose 054
    const contextManualConfirmed = buildWorkerContext({
      profileRow: {
        full_name: "TRABAJADOR B",
        matricula: "22222222",
      },
      latestPayslipRow: {
        employee_number: "22222222",
        period_raw: "1A-JUL-2026",
        vacations: { porVencer: "2026-08-15", dueDate: "2026-08-15" },
      },
      payslipLines: [line002Base], // Tarjetón sin 054
      vacationProfileRow: {
        employee_number: "22222222",
        radiological_exposure: "YES",
        radiological_exposure_source: "USER_CONFIRMED", // Confirmación manual explícita
        radiological_exposure_updated_at: "2026-09-07T12:00:00Z",
      },
    })

    // Override manual permanente para la matrícula activa
    expect(contextManualConfirmed.employment?.radiologicalExposure).toBe(true)
    expect(contextManualConfirmed.employment?.radiologicalExposureSource).toBe("USER_CONFIRMED")
    expect(contextManualConfirmed.vacations?.entitlements?.[0].regime).toBe("CUATRIMESTRAL")

    const prefilled = prefillVacationSimulator(contextManualConfirmed)
    expect(prefilled.profile.radiologicalExposure).toBe(true)
    expect(prefilled.regime).toBe("CUATRIMESTRAL")
  })
})
