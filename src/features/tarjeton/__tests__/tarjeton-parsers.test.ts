import { describe, expect, it } from "vitest"
import { parseImssMoney, roundImssMoney, sumImssMoney } from "../lib/money-parser"
import { parseImssPeriod, parseImssDate, imssPeriodEndDate } from "../lib/imss-date-parser"
import { parseImssPayslipSeniority, reconstructEffectiveDateFromSeniority } from "../lib/imss-seniority-parser"
import { parseImssConceptTables } from "../lib/imss-concept-table-parser"
import { parseImssObservations } from "../lib/imss-observations-parser"
import { stripSensitiveFields, maskIdentifier, isSensitiveKey } from "../lib/sanitize-sensitive-fields"
import { reconstructLines } from "../lib/line-reconstruction"
import { parseImssTarjeton } from "../lib/imss-tarjeton-parser"
import { applyConceptEdits, needsExplicitConfirmation } from "../lib/confirm-mark"
import type { PositionedPdfText } from "@/shared/contracts/tarjeton-import"

describe("money-parser", () => {
  it("parsea importes del tarjetón con separador de miles", () => {
    expect(parseImssMoney("3,937.64")).toBe(3937.64)
    expect(parseImssMoney("-2,390.73")).toBe(-2390.73)
    expect(parseImssMoney("1 000.50")).toBe(1000.5)
    expect(parseImssMoney("0")).toBe(0)
    expect(parseImssMoney("15")).toBe(15)
    expect(parseImssMoney("6.5")).toBe(6.5)
  })

  it("rechaza formatos no monetarios", () => {
    expect(parseImssMoney("abc")).toBeUndefined()
    expect(parseImssMoney("")).toBeUndefined()
    expect(parseImssMoney(null)).toBeUndefined()
    expect(parseImssMoney("1,5")).toBeUndefined()
    expect(parseImssMoney("12.34.56")).toBeUndefined()
  })

  it("redondea y suma sin NaN", () => {
    expect(roundImssMoney(1.005)).toBe(1.01)
    expect(sumImssMoney([1.1, 2.2, undefined, Number.NaN])).toBe(3.3)
  })
})

describe("imss-date-parser", () => {
  it("interpreta periodos 1A/2A", () => {
    const p1 = parseImssPeriod("PERIODO DE PAGO 1A-ENE-2026")
    expect(p1).toEqual({ year: 2026, month: 1, half: 1, normalized: "1A-ENE-2026" })
    const p2 = parseImssPeriod("2A JUL 2026")
    expect(p2).toEqual({ year: 2026, month: 7, half: 2, normalized: "2A-JUL-2026" })
    expect(parseImssPeriod("SIN PERIODO")).toBeNull()
  })

  it("calcula el fin del periodo", () => {
    expect(imssPeriodEndDate({ year: 2026, month: 1, half: 1, normalized: "1A-ENE-2026" })).toBe("2026-01-15")
    expect(imssPeriodEndDate({ year: 2026, month: 2, half: 2, normalized: "2A-FEB-2026" })).toBe("2026-02-28")
  })

  it("parsea fechas numéricas y con mes abreviado", () => {
    expect(parseImssDate("31-01-2026")).toBe("2026-01-31")
    expect(parseImssDate("15-ENE-2026")).toBe("2026-01-15")
    expect(parseImssDate("hola")).toBeUndefined()
  })
})

describe("imss-seniority-parser", () => {
  it("interpreta la antigüedad con quincenas", () => {
    expect(parseImssPayslipSeniority("14 años 3 qnas 1 días")).toEqual({ years: 14, fortnights: 3, days: 1 })
    expect(parseImssPayslipSeniority("10 años 2 quincenas")).toEqual({ years: 10, fortnights: 2, days: 0 })
    expect(parseImssPayslipSeniority("sin datos")).toBeNull()
  })

  it("reconstruye la fecha efectiva desde el fin de periodo", () => {
    expect(reconstructEffectiveDateFromSeniority({ years: 14, fortnights: 3, days: 1 }, "2026-01-15")).toBe("2011-11-30")
  })
})

describe("imss-concept-table-parser", () => {
  const lines = reconstructLines([
    item(10, "PERCEPCIONES"),
    item(11, "002 SUELDO BASE 3,937.64"),
    item(12, "011 PRESTACIONES EN DINERO 3,234.77"),
    item(13, "055 MAYOR IMPORTE 400.00"),
    item(14, "TOTAL PERCEPCIONES 7,572.41"),
    item(15, "DEDUCCIONES"),
    item(16, "212 IMPUESTO SOBRE LA RENTA -1,234.56"),
    item(17, "TOTAL DEDUCCIONES 1,234.56"),
    item(18, "LIQUIDO 6,337.85"),
  ])

  it("separa percepciones y deducciones con sus importes", () => {
    const result = parseImssConceptTables(lines, lines)
    expect(result.earnings).toHaveLength(3)
    expect(result.earnings[0]).toMatchObject({ code: "002", amount: 3937.64, kind: "earning" })
    expect(result.earnings[1]).toMatchObject({ code: "011", amount: 3234.77 })
    expect(result.earnings[2]).toMatchObject({ code: "055", amount: 400 })
    expect(result.deductions).toHaveLength(1)
    expect(result.deductions[0]).toMatchObject({ code: "212", amount: -1234.56, kind: "deduction" })
  })

  it("extrae los totales del documento", () => {
    const result = parseImssConceptTables(lines, lines)
    expect(result.totalEarnings).toBe(7572.41)
    expect(result.totalDeductions).toBe(1234.56)
    expect(result.netPay).toBe(6337.85)
  })
})

describe("imss-observations-parser", () => {
  const lines = reconstructLines([
    item(10, "OBSERVACIONES"),
    item(11, "055 VENCIMIENTO 2026014"),
    item(12, "032 RETROACTIVO DE 3 UNIDADES 900.00"),
    item(13, "CERTIFICACION"),
  ])

  it("conserva código, importe y campos auxiliares", () => {
    const observations = parseImssObservations(lines)
    expect(observations).toHaveLength(2)
    expect(observations[0]).toMatchObject({ conceptCode: "055", duePeriod: "2026014" })
    expect(observations[1]).toMatchObject({ conceptCode: "032", amount: 900, units: 3 })
  })
})

describe("sanitize-sensitive-fields", () => {
  it("elimina RFC, CURP, NSS, cuenta, QR y sellos recursivamente", () => {
    const dirty = {
      rfc: "ROGA900101HX0",
      curp: "ROGA900101HDFXNR04",
      nss: "12345678901",
      cuentaBancaria: "0123456789",
      codigoQR: "data:image/png;base64,...",
      sello: "abc123",
      fiscalFolioHash: "a1b2c3",
      employee: { fullName: "MARIA JOSE GARCIA RUIZ" },
      lines: [{ amount: 100 }, { banco: "BBVA" }],
    }
    const clean = stripSensitiveFields(dirty)
    expect(clean).not.toHaveProperty("rfc")
    expect(clean).not.toHaveProperty("curp")
    expect(clean).not.toHaveProperty("nss")
    expect(clean).not.toHaveProperty("cuentaBancaria")
    expect(clean).not.toHaveProperty("codigoQR")
    expect(clean).not.toHaveProperty("sello")
    expect(clean.fiscalFolioHash).toBe("a1b2c3")
    expect(clean.employee?.fullName).toBe("MARIA JOSE GARCIA RUIZ")
    expect((clean.lines as Array<Record<string, unknown>>)[1]).not.toHaveProperty("banco")
  })

  it("identifica claves sensibles con distintos separadores", () => {
    expect(isSensitiveKey("cuenta_bancaria")).toBe(true)
    expect(isSensitiveKey("folio fiscal")).toBe(true)
    expect(isSensitiveKey("fiscalFolioHash")).toBe(false)
    expect(maskIdentifier("ROGA900101HX0", 3, 2)).toBe("ROG********X0")
  })
})

describe("imss-tarjeton-parser (orquestador)", () => {
  const pdfItems: PositionedPdfText[] = [
    item(1, "INSTITUTO MEXICANO DEL SEGURO SOCIAL"),
    item(2, "RECIBO DE PAGO DE NOMINA"),
    item(3, "PERIODO DE PAGO 1A-ENE-2026"),
    item(4, "MATRICULA 123456"),
    item(5, "NOMBRE MARIA JOSE GARCIA RUIZ"),
    item(6, "CLAVE DE CATEGORIA/PUESTO 6112"),
    item(7, "NOMBRE CATEGORIA/PUESTO ENFERMERA GENERAL 80"),
    item(8, "FECHA DE INGRESO 01-03-2003"),
    item(9, "ANTIGUEDAD EFECTIVA 22 años 10 qnas 2 días"),
    item(10, "FOLIO 998877"),
    item(11, "FOLIO FISCAL RF-2026-000123"),
    item(12, "PERCEPCIONES"),
    item(13, "002 SUELDO BASE 3,937.64"),
    item(14, "011 PRESTACIONES EN DINERO 3,234.77"),
    item(15, "055 MAYOR IMPORTE 400.00"),
    item(16, "TOTAL PERCEPCIONES 7,572.41"),
    item(17, "DEDUCCIONES"),
    item(18, "212 IMPUESTO SOBRE LA RENTA -1,234.56"),
    item(19, "TOTAL DEDUCCIONES 1,234.56"),
    item(20, "LIQUIDO 6,337.85"),
    item(21, "OBSERVACIONES"),
    item(22, "055 VENCIMIENTO 2026014"),
    item(23, "DIAS LABORADOS EN EL AÑO 12"),
    item(24, "CERTIFICACION 31-01-2026"),
  ]

  it("extrae el tarjetón completo y valida los totales", async () => {
    const outcome = await parseImssTarjeton({
      items: pdfItems,
      pageCount: 1,
      hashText: async (text) => `hash:${text.length}`,
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    const { parsed } = outcome
    expect(parsed.extraction.validations.templateDetected).toBe(true)
    expect(parsed.extraction.method).toBe("native_text")

    expect(parsed.document).toMatchObject({
      year: 2026,
      month: 1,
      half: 1,
      folio: "998877",
      certificationDate: "2026-01-31",
    })
    expect(parsed.document.fiscalFolioHash).toBe("hash:14")

    expect(parsed.employee).toMatchObject({
      employeeNumber: "123456",
      fullName: "MARIA JOSE GARCIA RUIZ",
      categoryCode: "6112",
      categoryName: "ENFERMERA GENERAL 80",
      entryDate: "2003-03-01",
      workdayHours: 8,
    })
    expect(parsed.employee.seniority).toMatchObject({
      years: 22,
      fortnights: 10,
      days: 2,
      referenceDate: "2026-01-15",
    })

    expect(parsed.payroll.earnings.map((l) => l.code)).toEqual(["002", "011", "055"])
    expect(parsed.payroll.deductions.map((l) => l.code)).toEqual(["212"])
    expect(parsed.payroll.totalEarnings).toBe(7572.41)
    expect(parsed.payroll.netPay).toBe(6337.85)
    expect(parsed.payroll.daysWorkedInYear).toBe(12)

    expect(parsed.extraction.validations.earningsTotalMatches).toBe(true)
    expect(parsed.extraction.validations.deductionsTotalMatches).toBe(true)
    expect(parsed.extraction.validations.netPayMatches).toBe(true)
    expect(parsed.extraction.globalConfidence).toBeLessThan(0.85)
    expect(parsed.extraction.warnings).toContain(
      "No se pudo aislar la sección Receptor; revisa manualmente los datos laborales.",
    )
  })

  it("rechaza documentos que no son tarjetón", async () => {
    const outcome = await parseImssTarjeton({
      items: [item(1, "NOTA DE CREDITO BANCO NACIONAL")],
      pageCount: 1,
    })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe("template_not_detected")
  })

  it("devuelve no_text cuando no hay contenido", async () => {
    const outcome = await parseImssTarjeton({ items: [], pageCount: 1 })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.reason).toBe("no_text")
  })

  it("separa el receptor y las tablas paralelas usando coordenadas", async () => {
    const parallelItems: PositionedPdfText[] = [
      positioned(30, 20, "INSTITUTO MEXICANO DEL SEGURO SOCIAL"),
      positioned(30, 40, "RECIBO DE PAGO DE NOMINA"),
      positioned(30, 60, "NOMBRE:"),
      positioned(100, 60, "Instituto Mexicano del Seguro Social"),
      positioned(30, 100, "RECEPTOR"),
      positioned(40, 140, "MATRICULA:"),
      positioned(130, 140, "98173968"),
      positioned(260, 140, "RETARDOS:"),
      positioned(350, 140, "0"),
      positioned(410, 140, "PERIODO DE PAGO:"),
      positioned(510, 140, "2A-JUL-2026"),
      positioned(40, 170, "NOMBRE:"),
      positioned(130, 170, "EDUARDO BOLAÑOS VAZQUEZ"),
      positioned(40, 200, "CLAVE DE CATEGORIA/PUESTO:"),
      positioned(180, 200, "20570080"),
      positioned(40, 230, "NOMBRE CATEGORIA/PUESTO:"),
      positioned(180, 230, "TECNICO RADIOLOGO 80"),
      positioned(40, 260, "NOMBRE DE ADSCRIPCION:"),
      positioned(155, 260, "COORDINACION CLIN DE AUX DE DIAGN Y TRAT"),
      positioned(40, 290, "ANTIGUEDAD EFECTIVA:"),
      positioned(150, 290, "14 años 3 qnas 1 días"),
      positioned(410, 290, "FECHA DE INGRESO:"),
      positioned(510, 290, "01-04-2012"),
      positioned(30, 500, "PERCEPCIONES"),
      positioned(315, 500, "DEDUCCIONES"),
      positioned(30, 520, "CONCEPTO DESCRIPCION IMPORTE"),
      positioned(315, 520, "CONCEPTO DESCRIPCION IMPORTE"),
      ...parallelConceptRow(540, ["002", "Sueldo Base Fijo", "3,937.64"], ["111", "Aport Complementaria Afore", "5,321.15"]),
      ...parallelConceptRow(558, ["011", "Prestaciones en Dinero", "3,234.77"], ["212", "Impuesto Sobre la Renta", "1,234.56"]),
      ...parallelConceptRow(576, ["013", "Sobresueldo", "400.00"], ["107", "Fondo Jubilacion", "2,000.00"]),
      ...parallelConceptRow(594, ["020", "Ayuda Renta", "1,000.00"], ["151", "Cuota Sindical", "3,000.00"]),
      ...parallelConceptRow(612, ["022", "Ayuda Despensa", "2,000.00"], ["180", "Seguro", "4,000.00"]),
      ...parallelConceptRow(630, ["032", "Estimulos", "3,000.00"], ["183", "Prestamo", "5,000.00"]),
      ...parallelConceptRow(648, ["050", "Ayuda Vacaciones", "4,000.00"], ["190", "Otros Descuentos", "4,097.84"]),
      ...parallelConceptRow(666, ["054", "Compensacion", "5,000.00"]),
      ...parallelConceptRow(684, ["063", "Prima", "6,000.00"]),
      ...parallelConceptRow(702, ["080", "Ajuste", "7,619.14"]),
      positioned(30, 725, "TOTAL PERCEPCIONES"),
      positioned(245, 725, "36,191.55"),
      positioned(315, 725, "TOTAL DEDUCCIONES"),
      positioned(540, 725, "24,653.55"),
      positioned(315, 745, "LIQUIDO"),
      positioned(540, 745, "11,538.00"),
      positioned(30, 770, "MENSAJES"),
      positioned(30, 790, "CERTIFICACION 31-07-2026"),
    ]

    const shiftedItems = parallelItems.map((pdfItem) => ({ ...pdfItem, x: pdfItem.x + 100 }))
    const outcome = await parseImssTarjeton({ items: shiftedItems, pageCount: 1 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    expect(outcome.parsed.employee.employeeNumber).toBe("98173968")
    expect(outcome.parsed.employee.fullName).toBe("EDUARDO BOLAÑOS VAZQUEZ")
    expect(outcome.parsed.employee.assignmentName).toBe("COORDINACION CLIN DE AUX DE DIAGN Y TRAT")
    expect(outcome.parsed.employee.categoryCode).toBe("20570080")
    expect(outcome.parsed.employee.categoryName).toBe("TECNICO RADIOLOGO 80")
    expect(outcome.parsed.employee.seniority).toMatchObject({ years: 14, fortnights: 3, days: 1 })
    expect(outcome.parsed.payroll.earnings).toHaveLength(10)
    expect(outcome.parsed.payroll.deductions).toHaveLength(7)
    const conceptIndexes = [...outcome.parsed.payroll.earnings, ...outcome.parsed.payroll.deductions]
      .map((line) => line.lineIndex)
    expect(new Set(conceptIndexes).size).toBe(conceptIndexes.length)
    expect(outcome.parsed.payroll.totalEarnings).toBe(36191.55)
    expect(outcome.parsed.payroll.totalDeductions).toBe(24653.55)
    expect(outcome.parsed.payroll.netPay).toBe(11538)
    expect(outcome.parsed.extraction.validations).toMatchObject({
      earningsTotalMatches: true,
      deductionsTotalMatches: true,
      netPayMatches: true,
    })
    expect(outcome.parsed.extraction.globalConfidence).toBeGreaterThanOrEqual(0.95)

    const withoutTotals = shiftedItems.filter((pdfItem) => pdfItem.y < 725 || pdfItem.y >= 770)
    const incompleteOutcome = await parseImssTarjeton({ items: withoutTotals, pageCount: 1 })
    expect(incompleteOutcome.ok).toBe(true)
    if (!incompleteOutcome.ok) return
    expect(incompleteOutcome.parsed.extraction.globalConfidence).toBeLessThan(0.85)
    expect(incompleteOutcome.parsed.extraction.warnings).toContain(
      "Falta uno o más totales de nómina; la extracción requiere revisión.",
    )
  })
})

describe("confirm-mark", () => {
  it("aplica ediciones, descarta eliminadas y conserva confirmación individual", () => {
    const parsed = {
      payroll: {
        earnings: [
          { lineIndex: 0, code: "002", description: "Sueldo", amount: 1000, kind: "earning", confidence: 0.6, confirmedByUser: false },
          { lineIndex: 1, code: "011", description: "Prima", amount: 500, kind: "earning", confidence: 0.9, confirmedByUser: false },
        ],
        deductions: [
          { lineIndex: 0, code: "212", description: "Cuota", amount: 100, kind: "deduction", confidence: 0.7, confirmedByUser: false },
        ],
      },
    }
    const result = applyConceptEdits(parsed as never, [
      { lineIndex: 0, code: "002", description: "Sueldo base", amount: 1050, kind: "earning", confidence: 0.6, confirmedByUser: true },
      { lineIndex: 1, code: "011", description: "Prima", amount: 500, kind: "earning", confidence: 0.9, confirmedByUser: false, deleted: true },
      { lineIndex: 0, code: "212", description: "Cuota", amount: 100, kind: "deduction", confidence: 0.7, confirmedByUser: true },
    ])
    expect(result.payroll.earnings).toEqual([
      { lineIndex: 0, code: "002", description: "Sueldo base", amount: 1050, kind: "earning", confidence: 0.6, confirmedByUser: true },
    ])
    expect(result.payroll.deductions).toEqual([
      { lineIndex: 0, code: "212", description: "Cuota", amount: 100, kind: "deduction", confidence: 0.7, confirmedByUser: true },
    ])
  })

  it("no muta el objeto original", () => {
    const parsed = {
      payroll: {
        earnings: [
          { lineIndex: 0, code: "002", description: "Sueldo", amount: 1000, kind: "earning", confidence: 0.6, confirmedByUser: false },
        ],
        deductions: [],
      },
    }
    const result = applyConceptEdits(parsed as never, [
      { lineIndex: 0, code: "002", description: "Sueldo", amount: 1000, kind: "earning", confidence: 0.6, confirmedByUser: true },
    ])
    expect(parsed.payroll.earnings[0].confirmedByUser).toBe(false)
    expect(parsed.payroll.earnings[0].description).toBe("Sueldo")
    expect(result.payroll.deductions).toEqual([])
  })

  it("needsExplicitConfirmation usa el umbral de importes críticos", () => {
    expect(needsExplicitConfirmation(0.94)).toBe(true)
    expect(needsExplicitConfirmation(0.95)).toBe(false)
    expect(needsExplicitConfirmation(0.98)).toBe(false)
  })
})

function item(y: number, text: string): PositionedPdfText {
  return {
    text,
    page: 1,
    x: 10,
    y: y * 20,
    width: text.length * 4,
    height: 10,
    confidence: 1,
    method: "native_text",
  }
}

function positioned(x: number, y: number, text: string): PositionedPdfText {
  return {
    text,
    page: 1,
    x,
    y,
    width: text.length * 3,
    height: 10,
    confidence: 1,
    method: "native_text",
  }
}

function parallelConceptRow(
  y: number,
  earning: [string, string, string],
  deduction?: [string, string, string],
): PositionedPdfText[] {
  const row = [
    positioned(30, y, earning[0]),
    positioned(70, y, earning[1]),
    positioned(245, y, earning[2]),
  ]
  if (deduction) {
    row.push(
      positioned(315, y, deduction[0]),
      positioned(355, y, deduction[1]),
      positioned(540, y, deduction[2]),
    )
  }
  return row
}
