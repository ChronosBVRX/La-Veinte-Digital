import { describe, it, expect } from "vitest"
import { normalizePayslipConcept } from "@/shared/contracts/payslip-concept"
import { dbRowToGuidePayslip, toGuidePayslip } from "../services/payslip-guide"
import { buildExplainer, buildQuincenaSummary } from "../lib/explainer"
import { parseImssConceptTables } from "@/features/tarjeton/lib/imss-concept-table-parser"
import { savePayslip, getPayslips } from "@/shared/services/local-storage"
import { getPayPeriod } from "@/features/nomina/lib/periods"
import type { ImportedPayslip } from "@/features/nomina/lib/types"
import type { ReconstructedLine } from "@/features/tarjeton/lib/line-reconstruction"

describe("Guía del tarjetón: Reconocimiento robusto de conceptos y tolerancia a formatos", () => {
  // 1. Fixture anonimizada con edge cases: códigos de 2 y 3 dígitos, strings con $, comas, variaciones de clave
  const FIXTURE_DB_ROW = {
    id: "pay_anon_12345",
    period_month: 8,
    period_year: 2026,
    period_half: 2,
    period_raw: "2026/16",
    created_at: "2026-08-31T12:00:00Z",
    payroll_totals: {
      total_earnings: 14500.5,
      total_deductions: 3200.25,
      net_pay: 11300.25,
    },
  }

  const FIXTURE_DB_LINES = [
    { concept_code: "02", description: "SUELDO BASE", amount: 6850.5, kind: "earning" },
    { concept_code: "011", description: "AYUDA DE RENTA", amount: 1450.0, kind: "earning" },
    { concept_code: "20", description: "ANTIGUEDAD EFECTIVA", importe: "$1,200.00", kind: "earning" },
    { code: "107", descripcion: "FONDO DE AHORRO SNTSS", monto: " 2,500.00 ", tipo: "percepcion" },
    { concept_code: "151", description: "I.S.R.", amount: 2100.25, kind: "deduction" },
    { conceptCode: "50", descripcion: "CUOTA SINDICAL", importe: "$100.00", tipo: "deduccion" },
    { clave: "063", description: "PRESTAMO CAJA DE AHORRO", amount: 1000.0, kind: "deduction" },
  ]

  it("normalizePayslipConcept extrae correctamente códigos de 2, 3 dígitos y montos formateados", () => {
    const c1 = normalizePayslipConcept({ concept_code: "02", description: "SUELDO", amount: 5000 })
    expect(c1).not.toBeNull()
    expect(c1?.code).toBe("02")
    expect(c1?.amount).toBe(5000)
    expect(c1?.kind).toBe("earning")

    const c2 = normalizePayslipConcept({ code: "011", importe: "$1,234.56", kind: "percepcion" })
    expect(c2).not.toBeNull()
    expect(c2?.code).toBe("011")
    expect(c2?.amount).toBe(1234.56)
    expect(c2?.kind).toBe("earning")

    const c3 = normalizePayslipConcept({ conceptCode: "151", descripcion: "ISR", monto: "-$850.00", tipo: "deduccion" })
    expect(c3).not.toBeNull()
    expect(c3?.code).toBe("151")
    expect(c3?.amount).toBe(-850)
    expect(c3?.kind).toBe("deduction")
  })

  it("dbRowToGuidePayslip convierte filas del servidor y mapea percepciones y deducciones correctamente", () => {
    const guidePayslip = dbRowToGuidePayslip(FIXTURE_DB_ROW, FIXTURE_DB_LINES, [])
    expect(guidePayslip).not.toBeNull()
    expect(guidePayslip?.earnings.length).toBe(4) // 02, 011, 20, 107
    expect(guidePayslip?.deductions.length).toBe(3) // 151, 50, 063
    expect(guidePayslip?.totalEarnings).toBe(14500.5)
    expect(guidePayslip?.totalDeductions).toBe(3200.25)
    expect(guidePayslip?.netPay).toBe(11300.25)
  })

  it("toGuidePayslip reconoce conceptos almacenados localmente", () => {
    const localData = {
      id: "local_1",
      period: { label: "2ª Quincena Agosto 2026" },
      totalEarnings: 10000,
      totalDeductions: 2000,
      netPay: 8000,
      earnings: [
        { code: "02", description: "SUELDO", amount: "7,000.00" },
        { concept_code: "22", description: "AGUINALDO", importe: "$3,000.00" },
      ],
      deductions: [
        { code: "151", description: "ISR", amount: 2000 },
      ],
    }

    const parsed = toGuidePayslip(localData)
    expect(parsed).not.toBeNull()
    expect(parsed?.earnings.length).toBe(2)
    expect(parsed?.deductions.length).toBe(1)
    expect(parsed?.earnings[0].amount).toBe(7000)
    expect(parsed?.earnings[1].amount).toBe(3000)
  })

  it("parseImssConceptTables recupera filas con códigos de 2 dígitos y símbolos monetarios", () => {
    const makeLine = (data: Partial<ReconstructedLine> & { text: string; y: number }): ReconstructedLine => ({
      index: 0,
      xMin: 10,
      xMax: 200,
      yMin: data.y,
      yMax: data.y + 10,
      page: 1,
      confidence: 0.9,
      method: "native_text",
      items: [],
      norm: data.text,
      ...data,
    })

    const earningLines: ReconstructedLine[] = [
      makeLine({
        y: 80,
        text: "PERCEPCIONES",
        norm: "PERCEPCIONES",
        items: [
          { text: "PERCEPCIONES", norm: "PERCEPCIONES", page: 1, x: 10, y: 80, width: 80, height: 10, confidence: 0.9, method: "native_text" },
        ],
      }),
      makeLine({
        y: 100,
        text: "02 SUELDO BASE 6,850.50",
        norm: "02 SUELDO BASE 6,850.50",
        items: [
          { text: "02", norm: "02", page: 1, x: 10, y: 100, width: 20, height: 10, confidence: 0.9, method: "native_text" },
          { text: "SUELDO BASE", norm: "SUELDO BASE", page: 1, x: 40, y: 100, width: 80, height: 10, confidence: 0.9, method: "native_text" },
          { text: "6,850.50", norm: "6,850.50", page: 1, x: 150, y: 100, width: 50, height: 10, confidence: 0.9, method: "native_text" },
        ],
      }),
      makeLine({
        y: 120,
        text: "TOTAL PERCEPCIONES 6,850.50",
        norm: "TOTAL PERCEPCIONES 6,850.50",
        items: [
          { text: "TOTAL PERCEPCIONES", norm: "TOTAL PERCEPCIONES", page: 1, x: 10, y: 120, width: 100, height: 10, confidence: 0.9, method: "native_text" },
          { text: "6,850.50", norm: "6,850.50", page: 1, x: 150, y: 120, width: 50, height: 10, confidence: 0.9, method: "native_text" },
        ],
      }),
    ]

    const deductionLines: ReconstructedLine[] = [
      makeLine({
        y: 80,
        text: "DEDUCCIONES",
        norm: "DEDUCCIONES",
        items: [
          { text: "DEDUCCIONES", norm: "DEDUCCIONES", page: 1, x: 10, y: 80, width: 80, height: 10, confidence: 0.9, method: "native_text" },
        ],
      }),
      makeLine({
        y: 100,
        text: "151 I.S.R. 850.00",
        norm: "151 I.S.R. 850.00",
        items: [
          { text: "151", norm: "151", page: 1, x: 10, y: 100, width: 20, height: 10, confidence: 0.9, method: "native_text" },
          { text: "I.S.R.", norm: "I.S.R.", page: 1, x: 40, y: 100, width: 50, height: 10, confidence: 0.9, method: "native_text" },
          { text: "850.00", norm: "850.00", page: 1, x: 150, y: 100, width: 50, height: 10, confidence: 0.9, method: "native_text" },
        ],
      }),
      makeLine({
        y: 120,
        text: "TOTAL DEDUCCIONES 850.00",
        norm: "TOTAL DEDUCCIONES 850.00",
        items: [
          { text: "TOTAL DEDUCCIONES", norm: "TOTAL DEDUCCIONES", page: 1, x: 10, y: 120, width: 100, height: 10, confidence: 0.9, method: "native_text" },
          { text: "850.00", norm: "850.00", page: 1, x: 150, y: 120, width: 50, height: 10, confidence: 0.9, method: "native_text" },
        ],
      }),
      makeLine({
        y: 140,
        text: "LIQUIDO 6,000.50",
        norm: "LIQUIDO 6,000.50",
        items: [
          { text: "LIQUIDO", norm: "LIQUIDO", page: 1, x: 10, y: 140, width: 60, height: 10, confidence: 0.9, method: "native_text" },
          { text: "6,000.50", norm: "6,000.50", page: 1, x: 150, y: 140, width: 50, height: 10, confidence: 0.9, method: "native_text" },
        ],
      }),
    ]

    const result = parseImssConceptTables(earningLines, deductionLines)
    expect(result.earnings.length).toBe(1)
    expect(result.earnings[0].code).toBe("02")
    expect(result.earnings[0].amount).toBe(6850.5)
    expect(result.deductions.length).toBe(1)
    expect(result.deductions[0].code).toBe("151")
    expect(result.totalEarnings).toBe(6850.5)
    expect(result.totalDeductions).toBe(850.0)
    expect(result.netPay).toBe(6000.5)
  })

  it("buildExplainer emite el mensaje claro cuando los totales existen pero hay 0 conceptos", () => {
    const emptyConceptsWithTotals = {
      id: "pay_empty",
      earnings: [],
      deductions: [],
      observations: [],
      totalEarnings: 15000,
      totalDeductions: 3000,
      netPay: 12000,
      source: "local" as const,
    }

    const steps = buildExplainer(emptyConceptsWithTotals)
    const summaryStep = steps.find((s) => s.kind === "resumen")
    expect(summaryStep).toBeDefined()
    expect(summaryStep?.explanation).toBe(
      "Detectamos los totales de tu tarjetón, pero no pudimos leer el detalle de los conceptos."
    )
    expect(summaryStep?.cta?.href).toBe("/profile/mi-informacion-laboral")
  })

  it("Prueba End-to-End con fixture real: parser -> normalizador -> confirm -> persistencia -> recarga -> consulta -> Guía", () => {
    // 1. Fixture de líneas reconstruidas de un tarjetón real de enfermería
    const makeLine = (data: Partial<ReconstructedLine> & { text: string; y: number }): ReconstructedLine => ({
      index: 0,
      xMin: 10,
      xMax: 200,
      yMin: data.y,
      yMax: data.y + 10,
      page: 1,
      confidence: 0.95,
      method: "native_text",
      items: [],
      norm: data.text,
      ...data,
    })

    const rawEarningLines: ReconstructedLine[] = [
      makeLine({ y: 50, text: "PERCEPCIONES", norm: "PERCEPCIONES" }),
      makeLine({ y: 70, text: "02 SUELDO 6,850.50", norm: "02 SUELDO 6,850.50" }),
      makeLine({ y: 90, text: "011 AYUDA RENTA 1,450.00", norm: "011 AYUDA RENTA 1,450.00" }),
      makeLine({ y: 110, text: "20 ANTIGUEDAD 1,200.00", norm: "20 ANTIGUEDAD 1,200.00" }),
      makeLine({ y: 130, text: "TOTAL PERCEPCIONES 9,500.50", norm: "TOTAL PERCEPCIONES 9,500.50" }),
    ]

    const rawDeductionLines: ReconstructedLine[] = [
      makeLine({ y: 50, text: "DEDUCCIONES", norm: "DEDUCCIONES" }),
      makeLine({ y: 70, text: "151 I.S.R. 1,200.50", norm: "151 I.S.R. 1,200.50" }),
      makeLine({ y: 90, text: "50 CUOTA SINDICAL 100.00", norm: "50 CUOTA SINDICAL 100.00" }),
      makeLine({ y: 110, text: "TOTAL DEDUCCIONES 1,300.50", norm: "TOTAL DEDUCCIONES 1,300.50" }),
      makeLine({ y: 130, text: "LIQUIDO 8,200.00", norm: "LIQUIDO 8,200.00" }),
    ]

    // 2. Parser: parseImssConceptTables
    const parsedTables = parseImssConceptTables(rawEarningLines, rawDeductionLines)
    expect(parsedTables.earnings.length).toBe(3)
    expect(parsedTables.deductions.length).toBe(2)
    expect(parsedTables.totalEarnings).toBe(9500.5)
    expect(parsedTables.totalDeductions).toBe(1300.5)
    expect(parsedTables.netPay).toBe(8200.0)

    // 3. Normalizador: normalizePayslipConcept
    const normalizedEarnings = parsedTables.earnings.map((e) => normalizePayslipConcept(e, "earning")!)
    const normalizedDeductions = parsedTables.deductions.map((d) => normalizePayslipConcept(d, "deduction")!)
    expect(normalizedEarnings.every((e) => e !== null)).toBe(true)
    expect(normalizedDeductions.every((d) => d !== null)).toBe(true)

    // 4. Persistencia canónica local (simulando confirm_imported_payslip y almacenamiento)
    const storedPayslip = {
      id: "payslip_e2e_verified",
      period: { label: "2ª Quincena Agosto 2026", raw: "2026/16" },
      generatedAt: "2026-08-31T12:00:00Z",
      totalEarnings: parsedTables.totalEarnings,
      totalDeductions: parsedTables.totalDeductions,
      netPay: parsedTables.netPay,
      earnings: normalizedEarnings,
      deductions: normalizedDeductions,
    }

    // 5. Recarga y consulta mediante toGuidePayslip
    const guideDoc = toGuidePayslip(storedPayslip)
    expect(guideDoc).not.toBeNull()
    if (!guideDoc) return

    // Verificaciones exactas del contrato
    expect(guideDoc.earnings.length).toBe(3)
    expect(guideDoc.deductions.length).toBe(2)
    expect(guideDoc.totalEarnings).toBe(9500.5)
    expect(guideDoc.totalDeductions).toBe(1300.5)
    expect(guideDoc.netPay).toBe(8200.0)

    // Detalle de descripciones e importes
    expect(guideDoc.earnings[0]).toMatchObject({ code: "02", description: "SUELDO", amount: 6850.5 })
    expect(guideDoc.earnings[1]).toMatchObject({ code: "011", description: "AYUDA RENTA", amount: 1450.0 })
    expect(guideDoc.earnings[2]).toMatchObject({ code: "20", description: "ANTIGUEDAD", amount: 1200.0 })
    expect(guideDoc.deductions[0]).toMatchObject({ code: "151", description: "I.S.R.", amount: 1200.5 })
    expect(guideDoc.deductions[1]).toMatchObject({ code: "50", description: "CUOTA SINDICAL", amount: 100.0 })

    // 6. Guía Educativa: generación del explainer
    const explainerSteps = buildExplainer(guideDoc)
    expect(explainerSteps.length).toBeGreaterThan(2)

    // Debe contener paso de sueldo principal
    const sueldoStep = explainerSteps.find((s) => s.kind === "sueldo")
    expect(sueldoStep).toBeDefined()

    // Debe contener percepciones relevantes
    const percepcionStep = explainerSteps.find((s) => s.kind === "percepcion")
    expect(percepcionStep).toBeDefined()

    // Debe contener deducciones relevantes
    const deduccionStep = explainerSteps.find((s) => s.kind === "deduccion")
    expect(deduccionStep).toBeDefined()

    // Debe contener resumen de balance neto
    const resumenStep = explainerSteps.find((s) => s.kind === "resumen")
    expect(resumenStep).toBeDefined()
    expect(resumenStep?.title).toBe("Tu pago en pocas palabras")
    expect(resumenStep?.explanation).toContain("Detectamos 3 percepciones y 2 deducciones")
  })

  it("savePayslip deduplica por periodo y preserva conceptos sin multiplicar registros", () => {
    // Simular un mock de localStorage
    const store: Record<string, string> = {}
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        for (const k in store) delete store[k]
      },
    }
    const origWindow = globalThis.window
    const origStorage = (globalThis as unknown as { localStorage?: unknown }).localStorage
    // @ts-expect-error Mock window and localStorage for test
    globalThis.localStorage = mockStorage
    // @ts-expect-error Mock window for test
    globalThis.window = { localStorage: mockStorage, dispatchEvent: () => true }

    try {
      // 1. Guardar tarjetón inicial sin conceptos (como el que falló antes)
      const sepPeriod = { ...getPayPeriod(2026, 9, 1), label: "1A-SEP-2026" }
      const emptySlip = {
        id: "slip-initial-id",
        userId: "user-1",
        period: sepPeriod,
        earnings: [],
        deductions: [],
        totalEarnings: 4500,
        totalDeductions: 598,
        netPay: 3902,
        source: "pdf" as const,
        confirmedByUser: true,
      }
      savePayslip(emptySlip)
      expect(getPayslips().length).toBe(1)
      expect(getPayslips()[0].earnings.length).toBe(0)

      // 2. Reanalizar y guardar resultado con percepciones y deducciones
      const reanalyzedSlip = {
        id: "slip-retry-id", // nuevo id generado en reintento
        userId: "user-1",
        period: sepPeriod,
        earnings: [
          { code: "002", description: "SUELDO BASE", amount: 4500, confirmedByUser: true },
        ],
        deductions: [
          { code: "101", description: "CUOTA", amount: 598, confirmedByUser: true },
        ],
        totalEarnings: 4500,
        totalDeductions: 598,
        netPay: 3902,
        source: "pdf" as const,
        confirmedByUser: true,
      }
      savePayslip(reanalyzedSlip)

      // 3. Verificar que NO se duplicó en el almacenamiento y que conservó el ID original con los conceptos nuevos
      const slips = getPayslips()
      expect(slips.length).toBe(1)
      expect(slips[0].id).toBe("slip-initial-id")
      expect(slips[0].earnings.length).toBe(1)
      expect(slips[0].earnings[0].code).toBe("002")
      expect(slips[0].deductions.length).toBe(1)
      expect(slips[0].deductions[0].code).toBe("101")
    } finally {
      globalThis.window = origWindow
      ;(globalThis as unknown as { localStorage?: unknown }).localStorage = origStorage
    }
  })

  it("caso obligatorio 1A-SEP-2026: recupera conceptos, valida netAmount=3902 y balance contable exacto", () => {
    const store: Record<string, string> = {}
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        for (const k in store) delete store[k]
      },
    }
    const origWindow = globalThis.window
    const origStorage = (globalThis as unknown as { localStorage?: unknown }).localStorage
    // @ts-expect-error Mock window and localStorage for test
    globalThis.localStorage = mockStorage
    // @ts-expect-error Mock window for test
    globalThis.window = { localStorage: mockStorage, dispatchEvent: () => true }

    try {
      // 1. Guardado de tarjetón 1A-SEP-2026 con conceptos reales
      const initialSlip: ImportedPayslip = {
        id: "slip-1a-sep-2026",
        userId: "user-test",
        period: "1A-SEP-2026",
        earnings: [
          { code: "002", description: "SUELDO BASE", amount: 4500, confirmedByUser: true },
        ],
        deductions: [
          { code: "053", description: "IMPUESTO SOBRE LA RENTA", amount: 400, confirmedByUser: true },
          { code: "054", description: "CUOTA SINDICAL", amount: 198, confirmedByUser: true },
        ],
        totalEarnings: 4500,
        totalDeductions: 598,
        netPay: 3902,
        source: "pdf",
        confirmedByUser: true,
      }

      savePayslip(initialSlip)

      const slips = getPayslips()
      expect(slips.length).toBe(1)
      const savedPayslip = slips[0]

      // Validaciones obligatorias
      expect(savedPayslip.period).toBe("1A-SEP-2026")
      expect(savedPayslip.perceptions!.length).toBeGreaterThan(0)
      expect(savedPayslip.deductions!.length).toBeGreaterThan(0)
      expect(savedPayslip.netAmount).toBe(3902)

      const sumPerceptions = savedPayslip.perceptions!.reduce((acc, p) => acc + p.amount, 0)
      const sumDeductions = savedPayslip.deductions!.reduce((acc, d) => acc + d.amount, 0)
      expect(sumPerceptions - sumDeductions).toBeCloseTo(savedPayslip.netAmount!, 2)

      // Conversión a GuidePayslip y verificación en la Guía
      const guideSlip = toGuidePayslip(savedPayslip)
      expect(guideSlip).not.toBeNull()
      expect(guideSlip?.periodLabel).toBe("1A-SEP-2026")
      expect(guideSlip?.earnings.length).toBe(1)
      expect(guideSlip?.deductions.length).toBe(2)
      expect(guideSlip?.netPay).toBe(3902)

      const summary = buildQuincenaSummary(guideSlip!)
      expect(summary.incompleteExtraction).toBe(false)
      expect(summary.perceptions).toBe(1)
      expect(summary.deductions).toBe(2)
      expect(summary.netPay).toBe(3902)
    } finally {
      globalThis.window = origWindow
      ;(globalThis as unknown as { localStorage?: unknown }).localStorage = origStorage
    }
  })

  it("tolera conceptos desconocidos o sin código (code: null) y los conserva en la Guía", () => {
    const rawLine = {
      description: "APOYO ESPECIAL EXTRAORDINARIO",
      amount: 1500,
      kind: "earning",
    }
    const concept = normalizePayslipConcept(rawLine)
    expect(concept).not.toBeNull()
    expect(concept?.code).toBeNull()
    expect(concept?.description).toBe("APOYO ESPECIAL EXTRAORDINARIO")
    expect(concept?.amount).toBe(1500)

    const guidePayslip = toGuidePayslip({
      id: "slip-uncoded",
      period: "1A-SEP-2026",
      earnings: [concept],
      deductions: [],
      totalEarnings: 1500,
      netPay: 1500,
    })
    expect(guidePayslip).not.toBeNull()
    expect(guidePayslip?.earnings.length).toBe(1)
    expect(guidePayslip?.earnings[0].code).toBeNull()

    const steps = buildExplainer(guidePayslip!)
    expect(steps.length).toBeGreaterThan(0)
    const step = steps.find((s) => s.line?.description === "APOYO ESPECIAL EXTRAORDINARIO")
    expect(step).toBeDefined()
    expect(step?.explanation).toContain("APOYO ESPECIAL EXTRAORDINARIO")
    expect(step?.cta).toBeUndefined() // Sin código no genera link roto a /guia/conceptos/null
  })

  it("caso con totales contables exactos ($14,256.87 perc, $10,354.87 ded, $3,902.00 neto) con conceptos reales", () => {
    const rawPayslip = {
      id: "slip-exact-sep",
      period: "1A-SEP-2026",
      totalEarnings: 14256.87,
      totalDeductions: 10354.87,
      netPay: 3902.0,
      earnings: [
        { code: "002", description: "SUELDO BASE", amount: 6250.30 },
        { code: "011", description: "AYUDA PARA RENTA", amount: 2150.25 },
        { code: "022", description: "ANTIGUEDAD", amount: 1856.32 },
        { code: "032", description: "ESTIMULO DE ASISTENCIA", amount: 2000.00 },
        { code: "033", description: "ESTIMULO DE PUNTUALIDAD", amount: 2000.00 },
      ],
      deductions: [
        { code: "151", description: "I.S.R.", amount: 3500.87 },
        { code: "107", description: "FONDO DE AHORRO SNTSS", amount: 2854.00 },
        { code: "063", description: "PRESTAMO CAJA DE AHORRO", amount: 4000.00 },
      ],
    }

    const guide = toGuidePayslip(rawPayslip)
    expect(guide).not.toBeNull()
    expect(guide?.earnings.length).toBe(5)
    expect(guide?.deductions.length).toBe(3)

    const sumPerc = guide!.earnings.reduce((s, l) => s + l.amount, 0)
    const sumDed = guide!.deductions.reduce((s, l) => s + l.amount, 0)
    expect(sumPerc).toBeCloseTo(14256.87, 2)
    expect(sumDed).toBeCloseTo(10354.87, 2)
    expect(sumPerc - sumDed).toBeCloseTo(3902.00, 2)

    const summary = buildQuincenaSummary(guide!)
    expect(summary.incompleteExtraction).toBe(false)
    expect(summary.perceptions).toBe(5)
    expect(summary.deductions).toBe(3)
    expect(summary.netPay).toBe(3902.00)
    expect(summary.totalEarnings).toBe(14256.87)
    expect(summary.totalDeductions).toBe(10354.87)

    const steps = buildExplainer(guide!)
    const resumenStep = steps.find((s) => s.kind === "resumen")
    expect(resumenStep?.title).toBe("Tu pago en pocas palabras")
    expect(resumenStep?.explanation).toContain("Detectamos 5 percepciones y 3 deducciones")
  })
})


