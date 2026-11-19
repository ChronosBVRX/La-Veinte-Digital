import { describe, it, expect } from "vitest"
import { buildExplainer } from "../lib/explainer"
import type { GuidePayslip } from "../lib/types"

describe("buildExplainer - Evolución del analizador de tarjetones", () => {
  it("explica de forma sencilla sueldo base, estímulos 032 y 033 integrados", () => {
    const payslip: GuidePayslip = {
      id: "test-base",
      source: "local",
      periodRaw: "1A-AGO-2026",
      earnings: [
        { code: "002", description: "SUELDO TABULAR", amount: 7500, kind: "earning" },
        { code: "032", description: "ESTIMULO POR ASISTENCIA", amount: 1500, kind: "earning" },
        { code: "033", description: "ESTIMULO POR PUNTUALIDAD", amount: 1000, kind: "earning" },
      ],
      deductions: [{ code: "151", description: "I.S.R.", amount: 800, kind: "deduction" }],
      observations: [],
    }

    const steps = buildExplainer(payslip)

    // 1. Sueldo base
    expect(steps[0].kind).toBe("sueldo")
    expect(steps[0].title).toBe("Tu sueldo base")
    expect(steps[0].explanation).toContain("cuota tabular contractual")

    // 2. Estímulos integrados
    const estimulosStep = steps.find((s) => s.title.includes("estímulos de asistencia y puntualidad"))
    expect(estimulosStep).toBeTruthy()
    expect(estimulosStep?.kind).toBe("estimulo")
    expect(estimulosStep?.explanation).toContain("032")
    expect(estimulosStep?.explanation).toContain("033")
    expect(estimulosStep?.explanation).toContain("un mes de diferencia")
    expect(estimulosStep?.dateInfo).toBeDefined()
    expect(estimulosStep?.dateInfo?.incidenceText).toContain("Constancia evaluada")
    expect(estimulosStep?.dateInfo?.paymentText).toContain("Pagado en este tarjetón")
  })

  it("explica guardias especificando qué guardia y qué fecha devengada trae en Observaciones", () => {
    const payslip: GuidePayslip = {
      id: "test-guardia",
      source: "local",
      periodRaw: "2A-JUL-2026",
      earnings: [
        { code: "002", description: "SUELDO", amount: 6000, kind: "earning" },
        { code: "037", description: "TIEMPO EXTRAORDINARIO", amount: 1800, kind: "earning" },
      ],
      deductions: [],
      observations: [
        {
          conceptCode: "037",
          amount: 1800,
          units: 8,
          controlNumber: "20260614",
          notes: "GUARDIA NOCTURNA",
        },
      ],
    }

    const steps = buildExplainer(payslip)
    const guardiaStep = steps.find((s) => s.kind === "guardia")
    expect(guardiaStep).toBeTruthy()
    expect(guardiaStep?.title).toContain("Horas Extra")
    expect(guardiaStep?.title).toContain("Tiempo Extraordinario")
    expect(guardiaStep?.explanation).toContain("domingo 14 de junio de 2026")
    expect(guardiaStep?.explanation).toContain("nocturna")
    expect(guardiaStep?.explanation).toContain("8 horas")
    expect(guardiaStep?.dateInfo).toBeDefined()
    expect(guardiaStep?.dateInfo?.incidenceText).toContain("domingo 14 de junio de 2026")
    expect(guardiaStep?.dateInfo?.paymentText).toContain("Pagadas en este tarjetón")
  })

  it("explica concepto 035 Guardias distinguiéndolo claramente de tiempo extra", () => {
    const payslip: GuidePayslip = {
      id: "test-guardia-035",
      source: "local",
      periodRaw: "2A-SEP-2026",
      earnings: [
        { code: "002", description: "SUELDO", amount: 6000, kind: "earning" },
        { code: "035", description: "GUARDIAS", amount: 1470.56, kind: "earning" },
      ],
      deductions: [],
      observations: [
        {
          conceptCode: "035",
          amount: 1470.56,
          units: 8,
          notes: "16092026-16092026",
        },
      ],
    }

    const steps = buildExplainer(payslip)
    const guardiaStep = steps.find((s) => s.kind === "guardia")
    expect(guardiaStep).toBeTruthy()
    expect(guardiaStep?.title).toBe("Guardias (Concepto 035)")
    expect(guardiaStep?.explanation).toContain("16 de septiembre de 2026")
    expect(guardiaStep?.explanation).toContain("8 horas")
    expect(guardiaStep?.dateInfo?.incidenceText).toContain("16 de septiembre de 2026")
    expect(guardiaStep?.dateInfo?.paymentText).toContain("Pagada en este tarjetón")
  })

  it("explica incidencias de falta 172 con fecha exacta y consecuencias normativas", () => {
    const payslip: GuidePayslip = {
      id: "test-falta",
      source: "local",
      periodRaw: "1A-JUN-2026",
      earnings: [{ code: "002", description: "SUELDO", amount: 6000, kind: "earning" }],
      deductions: [
        { code: "172", description: "FALTA INJUSTIFICADA", amount: -400, kind: "deduction" },
      ],
      observations: [
        {
          conceptCode: "172",
          controlNumber: "20260603",
          units: 1,
          notes: "FALTA",
        },
      ],
    }

    const steps = buildExplainer(payslip)
    const faltaStep = steps.find((s) => s.kind === "falta")
    expect(faltaStep).toBeTruthy()
    expect(faltaStep?.title).toContain("Falta Injustificada")
    expect(faltaStep?.explanation).toContain("miércoles 3 de junio de 2026")
    expect(faltaStep?.explanation).toContain("Art. 86 del RIT")
    expect(faltaStep?.dateInfo).toBeDefined()
    expect(faltaStep?.dateInfo?.incidenceText).toContain("miércoles 3 de junio de 2026")
    expect(faltaStep?.dateInfo?.paymentText).toContain("Descuento")
  })

  it("explica vacaciones indicando fecha de salida y fecha de regreso a labores", () => {
    const payslip: GuidePayslip = {
      id: "test-vacaciones",
      source: "local",
      periodRaw: "2A-JUL-2026",
      earnings: [
        { code: "002", description: "SUELDO", amount: 7000, kind: "earning" },
        { code: "029", description: "PRIMA VACACIONAL", amount: 1750, kind: "earning" },
      ],
      deductions: [],
      observations: [
        {
          conceptCode: "029",
          units: 15,
          notes: "VACACIONES DEL 20260701 AL 20260715",
        },
      ],
    }

    const steps = buildExplainer(payslip)
    const vacStep = steps.find((s) => s.kind === "vacaciones")
    expect(vacStep).toBeTruthy()
    expect(vacStep?.explanation).toContain("salida es el miércoles 1 de julio de 2026")
    expect(vacStep?.explanation).toContain("regreso a labores es el jueves 16 de julio de 2026")
    expect(vacStep?.dateInfo).toBeDefined()
    expect(vacStep?.dateInfo?.incidenceText).toContain("Salida: miércoles 1 de julio de 2026")
    expect(vacStep?.dateInfo?.details).toContain("jueves 16 de julio de 2026")
  })

  it("detecta y explica conceptos pagados de forma retroactiva", () => {
    const payslip: GuidePayslip = {
      id: "test-retro",
      source: "local",
      periodRaw: "2A-OCT-2026",
      earnings: [
        { code: "002", description: "SUELDO BASE", amount: 8000, kind: "earning" },
        { code: "022", description: "ANTIGUEDAD RETROACTIVO", amount: 1200, kind: "earning" },
      ],
      deductions: [],
      observations: [
        {
          conceptCode: "022",
          duePeriod: "2026018",
          notes: "DIFERENCIA REVISION",
        },
      ],
    }

    const steps = buildExplainer(payslip)
    const retroStep = steps.find((s) => s.kind === "retroactivo")
    expect(retroStep).toBeTruthy()
    expect(retroStep?.title).toContain("Retroactivo (022)")
    expect(retroStep?.explanation).toContain("2.ª quincena de septiembre de 2026")
  })

  it("explica concepto 035 Guardias con 16092026-16092026 y estímulo 032 con QI 18 en Observaciones", () => {
    const payslip: GuidePayslip = {
      id: "real-tarjeton-guardia-035",
      source: "local",
      periodRaw: "1A-OCT-2026",
      earnings: [
        { code: "002", description: "SUELDO BASE FIJO", amount: 3937.64, kind: "earning" },
        { code: "032", description: "ESTIMULO POR ASISTENCIA", amount: 1721.37, kind: "earning" },
        { code: "033", description: "ESTIMULO POR PUNTUALIDAD", amount: 1147.58, kind: "earning" },
        { code: "035", description: "GUARDIAS", amount: 1470.56, kind: "earning" },
      ],
      deductions: [{ code: "151", description: "I.S.R.", amount: -313.03, kind: "deduction" }],
      observations: [
        {
          conceptCode: "035",
          amount: 1470.56,
          duePeriod: "2026020",
          units: 8,
          notes: "16092026-16092026",
        },
        {
          conceptCode: "032",
          amount: 1721.37,
          duePeriod: "2026020",
          units: 3,
          notes: "QI 18",
        },
      ],
    }

    const steps = buildExplainer(payslip)

    // 1. Guardia 035
    const guardiaStep = steps.find((s) => s.kind === "guardia")
    expect(guardiaStep).toBeTruthy()
    expect(guardiaStep?.title).toContain("Guardias (Concepto 035)")
    expect(guardiaStep?.explanation).toContain("16 de septiembre de 2026")
    expect(guardiaStep?.explanation).toContain("8 horas")
    expect(guardiaStep?.dateInfo?.incidenceText).toContain("16 de septiembre de 2026")
    expect(guardiaStep?.dateInfo?.sourceBadge).toBe("📍 Viene en Observaciones de tu tarjetón")

    // 2. Estímulo 032 con QI 18
    const estimuloStep = steps.find((s) => s.kind === "estimulo")
    expect(estimuloStep).toBeTruthy()
    expect(estimuloStep?.dateInfo?.incidenceText).toContain("Quincena 18")
    expect(estimuloStep?.dateInfo?.sourceBadge).toContain("QI 18")
  })

  it("reconoce y explica correctamente el Concepto 008 como sueldo de suplencia para personal sustituto", () => {
    const payslip: GuidePayslip = {
      id: "suplente-tarjeton-008",
      source: "local",
      periodRaw: "1A-OCT-2026",
      earnings: [
        { code: "008", description: "SUELDO SUSTITUTOS", amount: 4850.50, kind: "earning" },
        { code: "035", description: "GUARDIAS", amount: 1470.56, kind: "earning" },
      ],
      deductions: [{ code: "151", description: "I.S.R.", amount: -420.00, kind: "deduction" }],
      observations: [
        {
          conceptCode: "035",
          amount: 1470.56,
          notes: "16092026-16092026",
        },
      ],
    }

    const steps = buildExplainer(payslip)

    // Paso 1: Sueldo de suplencia (Concepto 008)
    const sueldoStep = steps[0]
    expect(sueldoStep.kind).toBe("sueldo")
    expect(sueldoStep.title).toBe("Tu sueldo de suplencia (Concepto 008)")
    expect(sueldoStep.subtitle).toContain("Sueldo sustitutos (Bolsa de Trabajo)")
    expect(sueldoStep.explanation).toContain("sustituto de Bolsa de Trabajo")
    expect(sueldoStep.explanation).toContain("Cláusulas 22 a 25 del CCT")
    expect(sueldoStep.explanation).toContain("Procedimiento 1A74-003-030")
    expect(sueldoStep.line?.code).toBe("008")
  })
})
