import { describe, expect, it } from "vitest"
import { parseImssMoney, roundImssMoney, sumImssMoney } from "../lib/money-parser"
import { parseImssPeriod, parseImssDate, imssPeriodEndDate } from "../lib/imss-date-parser"
import { parseImssPayslipSeniority, reconstructEffectiveDateFromSeniority } from "../lib/imss-seniority-parser"
import { parseImssConceptTables } from "../lib/imss-concept-table-parser"
import { parseImssObservations } from "../lib/imss-observations-parser"
import { stripSensitiveFields, maskIdentifier, isSensitiveKey } from "../lib/sanitize-sensitive-fields"
import { reconstructLines } from "../lib/line-reconstruction"
import { parseImssTarjeton } from "../lib/imss-tarjeton-parser"
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
    const result = parseImssConceptTables(lines)
    expect(result.earnings).toHaveLength(3)
    expect(result.earnings[0]).toMatchObject({ code: "002", amount: 3937.64, kind: "earning" })
    expect(result.earnings[1]).toMatchObject({ code: "011", amount: 3234.77 })
    expect(result.earnings[2]).toMatchObject({ code: "055", amount: 400 })
    expect(result.deductions).toHaveLength(1)
    expect(result.deductions[0]).toMatchObject({ code: "212", amount: -1234.56, kind: "deduction" })
  })

  it("extrae los totales del documento", () => {
    const result = parseImssConceptTables(lines)
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
