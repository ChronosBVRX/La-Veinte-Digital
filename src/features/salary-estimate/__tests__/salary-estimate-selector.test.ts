import { describe, it, expect } from "vitest"
import { selectSalaryEstimateInputs } from "../services/salary-estimate-selector"
import type { WorkerContext } from "@/shared/server/worker-context-builder"

describe("selectSalaryEstimateInputs", () => {
  it("retorna hasPayslip: false si el contexto es null o no tiene activePayslipId", () => {
    expect(selectSalaryEstimateInputs(null)).toEqual({
      hasPayslip: false,
      tabular: undefined,
      concept11: undefined,
    })
    expect(
      selectSalaryEstimateInputs({
        meta: { activePayslipId: null },
      } as unknown as WorkerContext),
    ).toEqual({
      hasPayslip: false,
      tabular: undefined,
      concept11: undefined,
    })
  })

  it("extrae conceptos 002 y 011 del tarjetón activo cuando coinciden en periodo", () => {
    const context = {
      meta: {
        activePayslipId: "payslip-123",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 4200,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-123",
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 3400,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-123",
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(context)
    expect(result.hasPayslip).toBe(true)
    expect(result.tabular).toBe(4200)
    expect(result.concept11).toBe(3400)
  })

  it("acepta un concepto 011 confirmado con importe 0", () => {
    const context = {
      meta: {
        activePayslipId: "payslip-123",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 4000,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-123",
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 0,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-123",
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(context)
    expect(result.hasPayslip).toBe(true)
    expect(result.tabular).toBe(4000)
    expect(result.concept11).toBe(0)
  })

  it("descarta concepto 011 si pertenece a un periodo anterior y no al activo", () => {
    const context = {
      meta: {
        activePayslipId: "payslip-new",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 4000,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-new",
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 2500,
            lastSeenAt: "2026-06-30", // Periodo viejo
            payslipId: "payslip-new",
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(context)
    expect(result.hasPayslip).toBe(true)
    expect(result.tabular).toBe(4000)
    expect(result.concept11).toBeUndefined()
  })

  it("retorna tabular: undefined si 002 está ausente del tarjetón", () => {
    const context = {
      meta: { activePayslipId: "p1", activePayslipPeriod: "2026-08-31" },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          { conceptCode: "011", lastAmount: 3000, lastSeenAt: "2026-08-31", payslipId: "p1", confirmed: true },
        ],
      },
    } as unknown as WorkerContext
    const res = selectSalaryEstimateInputs(context)
    expect(res.hasPayslip).toBe(true)
    expect(res.tabular).toBeUndefined()
    expect(res.concept11).toBe(3000)
  })

  it("retorna concept11: undefined si 011 está ausente del tarjetón", () => {
    const context = {
      meta: { activePayslipId: "p1", activePayslipPeriod: "2026-08-31" },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 5000, lastSeenAt: "2026-08-31", payslipId: "p1", confirmed: true },
        ],
      },
    } as unknown as WorkerContext
    const res = selectSalaryEstimateInputs(context)
    expect(res.hasPayslip).toBe(true)
    expect(res.tabular).toBe(5000)
    expect(res.concept11).toBeUndefined()
  })

  it("descarta 011 si 002 y 011 provienen de periodos distintos", () => {
    const context = {
      meta: { activePayslipId: "p1" },
      payroll: {
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 5000, lastSeenAt: "2026-08-31", payslipId: "p1", confirmed: true },
          { conceptCode: "011", lastAmount: 3000, lastSeenAt: "2026-07-31", payslipId: "p1", confirmed: true },
        ],
      },
    } as unknown as WorkerContext
    const res = selectSalaryEstimateInputs(context)
    expect(res.hasPayslip).toBe(true)
    expect(res.tabular).toBe(5000)
    expect(res.concept11).toBeUndefined()
  })

  it("descarta concepto 002 si pertenece a un periodo distinto al tarjetón activo", () => {
    const context = {
      meta: {
        activePayslipId: "payslip-active",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 4500, lastSeenAt: "2026-07-31", payslipId: "payslip-active", confirmed: true },
          { conceptCode: "011", lastAmount: 2000, lastSeenAt: "2026-08-31", payslipId: "payslip-active", confirmed: true },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(context)
    expect(result.hasPayslip).toBe(true)
    expect(result.tabular).toBeUndefined()
    expect(result.concept11).toBe(2000)
  })

  it("ignora conceptos no confirmados (confirmed === false)", () => {
    const context = {
      meta: {
        activePayslipId: "payslip-active",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 4500, lastSeenAt: "2026-08-31", payslipId: "payslip-active", confirmed: false },
          { conceptCode: "011", lastAmount: 2000, lastSeenAt: "2026-08-31", payslipId: "payslip-active", confirmed: true },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(context)
    expect(result.hasPayslip).toBe(true)
    expect(result.tabular).toBeUndefined()
    expect(result.concept11).toBe(2000)
  })

  it("maneja de forma segura recurringConcepts malformados o no array", () => {
    const context = {
      meta: {
        activePayslipId: "payslip-new",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        recurringConcepts: {} as unknown as unknown[],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(context)
    expect(result.hasPayslip).toBe(true)
    expect(result.tabular).toBeUndefined()
    expect(result.concept11).toBeUndefined()
  })

  it("descarta conceptos sin lastSeenAt cuando se requiere periodo del tarjetón activo", () => {
    const context = {
      meta: {
        activePayslipId: "payslip-active-1",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 5000,
            // sin lastSeenAt y sin payslipId
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 2500,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-active-1",
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(context)
    expect(result.hasPayslip).toBe(true)
    // 002 debe ser descartado porque no tiene lastSeenAt ni payslipId para verificar procedencia
    expect(result.tabular).toBeUndefined()
    expect(result.concept11).toBe(2500)

    // Caso inverso: 011 sin lastSeenAt ni payslipId
    const context2 = {
      meta: {
        activePayslipId: "payslip-active-1",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 5000,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-active-1",
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 2500,
            // sin lastSeenAt y sin payslipId
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result2 = selectSalaryEstimateInputs(context2)
    expect(result2.hasPayslip).toBe(true)
    expect(result2.tabular).toBe(5000)
    // 011 debe ser descartado
    expect(result2.concept11).toBeUndefined()
  })

  it("en presencia de dos tarjetones distintos del mismo periodo, exige que 002 y 011 provengan del tarjetón activo", () => {
    // Escenario: coexisten dos tarjetones del mismo periodo "2026-08-31":
    // "payslip-activo" (activo) y "payslip-otro" (inactivo / de otro régimen o sustituido).
    const context = {
      meta: {
        activePayslipId: "payslip-activo",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 6000,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-activo",
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 3500,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-otro", // Provino de un tarjetón distinto, aunque sea del mismo periodo
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(context)
    expect(result.hasPayslip).toBe(true)
    expect(result.tabular).toBe(6000)
    // 011 debe ser rechazado porque no proviene del tarjetón activo
    expect(result.concept11).toBeUndefined()

    // Caso donde ambos provienen del tarjetón activo:
    const contextValido = {
      meta: {
        activePayslipId: "payslip-activo",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 6000,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-activo",
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 3500,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-activo",
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const resultValido = selectSalaryEstimateInputs(contextValido)
    expect(resultValido.hasPayslip).toBe(true)
    expect(resultValido.tabular).toBe(6000)
    expect(resultValido.concept11).toBe(3500)
    // Confirmación estricta de que 002 y 011 tienen payslipId igual al tarjetón activo
    expect(resultValido.tabularPayslipId).toBe("payslip-activo")
    expect(resultValido.concept11PayslipId).toBe("payslip-activo")
    expect(resultValido.tabularPayslipId).toBe(contextValido.meta!.activePayslipId)
    expect(resultValido.concept11PayslipId).toBe(contextValido.meta!.activePayslipId)
  })

  it("acepta conceptos sin lastSeenAt SI tienen payslipId igual al tarjetón activo, garantizando procedencia", () => {
    // Escenario: 011 no tiene lastSeenAt registrado pero sí tiene payslipId igual al tarjetón activo
    const context = {
      meta: {
        activePayslipId: "payslip-activo-999",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 7000,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-activo-999",
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 4200,
            // sin lastSeenAt
            payslipId: "payslip-activo-999",
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(context)
    expect(result.hasPayslip).toBe(true)
    expect(result.tabular).toBe(7000)
    expect(result.concept11).toBe(4200)
    // Confirma que 002 y 011 tienen payslipId igual al tarjetón activo
    expect(result.tabularPayslipId).toBe("payslip-activo-999")
    expect(result.concept11PayslipId).toBe("payslip-activo-999")
    expect(result.tabularPayslipId).toBe(context.meta!.activePayslipId)
    expect(result.concept11PayslipId).toBe(context.meta!.activePayslipId)
  })

  it("rechaza conceptos sin payslipId aunque coincida el periodo con el tarjetón activo", () => {
    // Escenario: El concepto 002 coincide exactamente en periodo "2026-08-31" con el tarjetón activo,
    // pero no tiene payslipId registrado. Su procedencia no está comprobada, por lo que debe rechazarse.
    const context = {
      meta: {
        activePayslipId: "payslip-activo-exacto",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 6500,
            lastSeenAt: "2026-08-31", // Coincide el periodo pero falta payslipId
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 3200,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-activo-exacto",
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(context)
    expect(result.hasPayslip).toBe(true)
    // 002 debe ser rechazado por no tener comprobada su procedencia (sin payslipId)
    expect(result.tabular).toBeUndefined()
    expect(result.tabularPayslipId).toBeUndefined()
    // 011 sí tiene procedencia comprobada
    expect(result.concept11).toBe(3200)
    expect(result.concept11PayslipId).toBe("payslip-activo-exacto")

    // Caso inverso: 011 coincide en periodo pero no tiene payslipId
    const contextInverso = {
      meta: {
        activePayslipId: "payslip-activo-exacto",
        activePayslipPeriod: "2026-08-31",
      },
      payroll: {
        latestPeriod: "2026-08-31",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 6500,
            lastSeenAt: "2026-08-31",
            payslipId: "payslip-activo-exacto",
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 3200,
            lastSeenAt: "2026-08-31", // Coincide el periodo pero falta payslipId
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const resultInverso = selectSalaryEstimateInputs(contextInverso)
    expect(resultInverso.hasPayslip).toBe(true)
    expect(resultInverso.tabular).toBe(6500)
    expect(resultInverso.tabularPayslipId).toBe("payslip-activo-exacto")
    // 011 debe ser rechazado
    expect(resultInverso.concept11).toBeUndefined()
    expect(resultInverso.concept11PayslipId).toBeUndefined()
  })

  it("caso sintético sustitución: admite sueldo sustituto 008 con rama explícita sin renombrarlo 002", () => {
    const sustContext = {
      meta: {
        activePayslipId: "payslip-sust-synth-1",
        activePayslipPeriod: "2A-SEP-2026",
        activeEmployeeNumber: "mat-synth-001",
      },
      profile: {
        matricula: "mat-synth-001",
      },
      payroll: {
        latestPeriod: "2A-SEP-2026",
        recurringConcepts: [
          {
            conceptCode: "008",
            lastAmount: 3200.50,
            lastSeenAt: "2A-SEP-2026",
            payslipId: "payslip-sust-synth-1",
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 2600.25,
            lastSeenAt: "2A-SEP-2026",
            payslipId: "payslip-sust-synth-1",
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(sustContext)
    expect(result.hasPayslip).toBe(true)
    expect(result.salaryType).toBe("substitute")
    // Rama explícita: NO se renombra a 002
    expect(result.tabular).toBeUndefined()
    expect(result.substituteSalary).toBe(3200.50)
    expect(result.concept008Amount).toBe(3200.50)
    expect(result.concept11).toBe(2600.25)
    expect(result.substitutePayslipId).toBe("payslip-sust-synth-1")
    expect(result.concept11PayslipId).toBe("payslip-sust-synth-1")
    expect(result.isPostCutoff).toBe(false)
    // El concepto 008 por sí solo no confirma días ni tipo permanente
    expect(result.substituteCoverage).toBe("unknown")
    expect(result.daysPaid).toBeUndefined()
  })

  it("distingue cobertura parcial comprobada cuando existen días pagados explícitos en nómina", () => {
    const contextConDias = {
      meta: {
        activePayslipId: "payslip-dias-1",
        activePayslipPeriod: "2A-SEP-2026",
      },
      payroll: {
        latestPeriod: "2A-SEP-2026",
        daysPaidInFortnight: 10,
        recurringConcepts: [
          { conceptCode: "008", lastAmount: 2800, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-dias-1", confirmed: true },
          { conceptCode: "011", lastAmount: 2300, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-dias-1", confirmed: true },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(contextConDias)
    expect(result.hasPayslip).toBe(true)
    expect(result.salaryType).toBe("substitute")
    expect(result.substituteCoverage).toBe("partial_confirmed")
    expect(result.daysPaid).toBe(10)
  })

  it("caso sintético ordinario: selecciona sueldo tabular 002 y ayuda de renta 011 ordinario", () => {
    const ordContext = {
      meta: {
        activePayslipId: "payslip-ord-synth-1",
        activePayslipPeriod: "1A-SEP-2026",
        activeEmployeeNumber: "mat-synth-002",
      },
      profile: {
        matricula: "mat-synth-002",
      },
      payroll: {
        latestPeriod: "1A-SEP-2026",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 4100,
            lastSeenAt: "1A-SEP-2026",
            payslipId: "payslip-ord-synth-1",
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 3300,
            lastSeenAt: "1A-SEP-2026",
            payslipId: "payslip-ord-synth-1",
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(ordContext)
    expect(result.hasPayslip).toBe(true)
    expect(result.salaryType).toBe("base")
    expect(result.tabular).toBe(4100)
    expect(result.substituteSalary).toBeUndefined()
    expect(result.concept11).toBe(3300)
    expect(result.tabularPayslipId).toBe("payslip-ord-synth-1")
    expect(result.concept11PayslipId).toBe("payslip-ord-synth-1")
    expect(result.isPostCutoff).toBe(false)
  })

  it("caso sintético de control: selecciona correctamente ambos conceptos con importes de referencia", () => {
    const ordContextReporte = {
      meta: {
        activePayslipId: "payslip-ord-synth-ctrl",
        activePayslipPeriod: "1A-SEP-2026",
        activeEmployeeNumber: "mat-synth-002",
      },
      profile: {
        matricula: "mat-synth-002",
      },
      payroll: {
        latestPeriod: "1A-SEP-2026",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 3950,
            lastSeenAt: "1A-SEP-2026",
            payslipId: "payslip-ord-synth-ctrl",
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 3150,
            lastSeenAt: "1A-SEP-2026",
            payslipId: "payslip-ord-synth-ctrl",
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(ordContextReporte)
    expect(result.hasPayslip).toBe(true)
    expect(result.salaryType).toBe("base")
    expect(result.tabular).toBe(3950)
    expect(result.concept11).toBe(3150)
    expect(result.tabularPayslipId).toBe("payslip-ord-synth-ctrl")
    expect(result.concept11PayslipId).toBe("payslip-ord-synth-ctrl")
  })

  it("acumula múltiples líneas del concepto 008 del mismo tarjetón activo", () => {
    const contextDoble008 = {
      meta: {
        activePayslipId: "payslip-doble-008",
        activePayslipPeriod: "2A-SEP-2026",
        activeEmployeeNumber: "mat-synth-003",
      },
      profile: { matricula: "mat-synth-003" },
      payroll: {
        latestPeriod: "2A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "008", lastAmount: 1800.50, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-doble-008", confirmed: true },
          { conceptCode: "008", lastAmount: 1400.25, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-doble-008", confirmed: true },
          { conceptCode: "011", lastAmount: 2600.00, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-doble-008", confirmed: true },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(contextDoble008)
    expect(result.hasPayslip).toBe(true)
    expect(result.salaryType).toBe("substitute")
    expect(result.substituteSalary).toBe(3200.75)
    expect(result.concept008Amount).toBe(3200.75)
    expect(result.concept11).toBe(2600.00)
    expect(result.substitutePayslipId).toBe("payslip-doble-008")
    expect(result.concept11PayslipId).toBe("payslip-doble-008")
  })

  it("cobertura sustitución sin días de nómina asigna estrictamente unknown y daysPaid undefined", () => {
    const contextSinDias = {
      meta: {
        activePayslipId: "payslip-sin-dias",
        activePayslipPeriod: "2A-SEP-2026",
      },
      payroll: {
        latestPeriod: "2A-SEP-2026",
        daysPaidInFortnight: undefined,
        recurringConcepts: [
          { conceptCode: "008", lastAmount: 3000, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-sin-dias", confirmed: true },
          { conceptCode: "011", lastAmount: 2500, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-sin-dias", confirmed: true },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(contextSinDias)
    expect(result.hasPayslip).toBe(true)
    expect(result.substituteCoverage).toBe("unknown")
    expect(result.daysPaid).toBeUndefined()
  })

  it("concepto 011 igual a 0.00 se selecciona válidamente con valor 0 y no como undefined", () => {
    const contextCero = {
      meta: {
        activePayslipId: "payslip-cero-11",
        activePayslipPeriod: "1A-SEP-2026",
      },
      payroll: {
        latestPeriod: "1A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 4000, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-cero-11", confirmed: true },
          { conceptCode: "011", lastAmount: 0, lastSeenAt: "1A-SEP-2026", payslipId: "payslip-cero-11", confirmed: true },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(contextCero)
    expect(result.hasPayslip).toBe(true)
    expect(result.tabular).toBe(4000)
    expect(result.concept11).toBe(0)
    expect(result.concept11PayslipId).toBe("payslip-cero-11")
  })

  it("rechaza concepto 011 si no proviene del mismo tarjetón activo que la base", () => {
    const contextIncoherente = {
      meta: {
        activePayslipId: "payslip-activo-1",
        activePayslipPeriod: "2A-SEP-2026",
      },
      payroll: {
        latestPeriod: "2A-SEP-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 4500, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-activo-1", confirmed: true },
          { conceptCode: "011", lastAmount: 3500, lastSeenAt: "2A-SEP-2026", payslipId: "payslip-otro-2", confirmed: true },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(contextIncoherente)
    expect(result.hasPayslip).toBe(true)
    expect(result.tabular).toBe(4500)
    expect(result.tabularPayslipId).toBe("payslip-activo-1")
    // 011 de otro tarjetón es descartado
    expect(result.concept11).toBeUndefined()
    expect(result.concept11PayslipId).toBeUndefined()
  })

  it("rechaza conceptos históricos preservados en recurringConcepts que pertenecen a otro tarjetón", () => {
    const contextConHistoricos = {
      meta: {
        activePayslipId: "payslip-actual",
        activePayslipPeriod: "2A-SEP-2026",
      },
      payroll: {
        latestPeriod: "2A-SEP-2026",
        recurringConcepts: [
          // Concepto del tarjetón activo
          {
            conceptCode: "008",
            lastAmount: 3300,
            lastSeenAt: "2A-SEP-2026",
            payslipId: "payslip-actual",
            confirmed: true,
          },
          // Concepto histórico de otro tarjetón anterior preservado por worker-context-builder
          {
            conceptCode: "002",
            lastAmount: 5000,
            lastSeenAt: "1A-AGO-2026",
            payslipId: "payslip-historico-anterior",
            confirmed: true,
          },
          // Concepto 11 histórico de otro tarjetón anterior
          {
            conceptCode: "011",
            lastAmount: 4000,
            lastSeenAt: "1A-AGO-2026",
            payslipId: "payslip-historico-anterior",
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(contextConHistoricos)
    expect(result.hasPayslip).toBe(true)
    expect(result.salaryType).toBe("substitute")
    expect(result.substituteSalary).toBe(3300)
    // 002 histórico no debe filtrarse como activo
    expect(result.tabular).toBeUndefined()
    // 011 histórico no debe aceptarse porque no pertenece al tarjetón activo
    expect(result.concept11).toBeUndefined()
  })

  it("coexistencia de 002 y 008 sin tramos acreditados marca coberturas ambiguas (mixed)", () => {
    const contextMixto = {
      meta: {
        activePayslipId: "payslip-mixto",
        activePayslipPeriod: "2A-SEP-2026",
      },
      payroll: {
        latestPeriod: "2A-SEP-2026",
        recurringConcepts: [
          {
            conceptCode: "002",
            lastAmount: 4000,
            lastSeenAt: "2A-SEP-2026",
            payslipId: "payslip-mixto",
            confirmed: true,
          },
          {
            conceptCode: "008",
            lastAmount: 2000,
            lastSeenAt: "2A-SEP-2026",
            payslipId: "payslip-mixto",
            confirmed: true,
          },
          {
            conceptCode: "011",
            lastAmount: 3000,
            lastSeenAt: "2A-SEP-2026",
            payslipId: "payslip-mixto",
            confirmed: true,
          },
        ],
      },
    } as unknown as WorkerContext

    const result = selectSalaryEstimateInputs(contextMixto)
    expect(result.hasPayslip).toBe(true)
    expect(result.salaryType).toBe("mixed")
    expect(result.hasAmbiguousCoverages).toBe(true)
    expect(result.concept002Amount).toBe(4000)
    expect(result.concept008Amount).toBe(2000)
    expect(result.tabular).toBeUndefined()
    expect(result.substituteSalary).toBeUndefined()
  })

  it("identifica periodos posteriores al 16 de octubre de 2026 como post-cutoff", () => {
    // 2A-OCT-2026 es quincena 20 (inicio del nuevo tabulador 2026-2027)
    const contextOct2 = {
      meta: { activePayslipId: "p-oct2", activePayslipPeriod: "2A-OCT-2026" },
      payroll: {
        latestPeriod: "2A-OCT-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 4500, lastSeenAt: "2A-OCT-2026", payslipId: "p-oct2", confirmed: true },
          { conceptCode: "011", lastAmount: 3500, lastSeenAt: "2A-OCT-2026", payslipId: "p-oct2", confirmed: true },
        ],
      },
    } as unknown as WorkerContext
    expect(selectSalaryEstimateInputs(contextOct2).isPostCutoff).toBe(true)

    // 1A-OCT-2026 es quincena 19 (previo al corte del 16 de octubre)
    const contextOct1 = {
      meta: { activePayslipId: "p-oct1", activePayslipPeriod: "1A-OCT-2026" },
      payroll: {
        latestPeriod: "1A-OCT-2026",
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 4500, lastSeenAt: "1A-OCT-2026", payslipId: "p-oct1", confirmed: true },
          { conceptCode: "011", lastAmount: 3500, lastSeenAt: "1A-OCT-2026", payslipId: "p-oct1", confirmed: true },
        ],
      },
    } as unknown as WorkerContext
    expect(selectSalaryEstimateInputs(contextOct1).isPostCutoff).toBe(false)

    // Formato Q2 de 2026-10
    const contextQ2 = {
      meta: { activePayslipId: "p-q2", activePayslipPeriod: "2026-10-Q2" },
      payroll: {
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 4500, lastSeenAt: "2026-10-Q2", payslipId: "p-q2", confirmed: true },
        ],
      },
    } as unknown as WorkerContext
    expect(selectSalaryEstimateInputs(contextQ2).isPostCutoff).toBe(true)

    // Año posterior: 2027
    const context2027 = {
      meta: { activePayslipId: "p-2027", activePayslipPeriod: "1A-ENE-2027" },
      payroll: {
        recurringConcepts: [
          { conceptCode: "002", lastAmount: 4500, lastSeenAt: "1A-ENE-2027", payslipId: "p-2027", confirmed: true },
        ],
      },
    } as unknown as WorkerContext
    expect(selectSalaryEstimateInputs(context2027).isPostCutoff).toBe(true)
  })
})
