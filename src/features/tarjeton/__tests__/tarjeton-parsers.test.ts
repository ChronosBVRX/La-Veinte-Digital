import { describe, expect, it } from "vitest"
import { parseImssMoney, roundImssMoney, sumImssMoney } from "../lib/money-parser"
import { parseImssPeriod, parseImssDate, imssPeriodEndDate } from "../lib/imss-date-parser"
import { parseImssPayslipSeniority, reconstructEffectiveDateFromSeniority } from "../lib/imss-seniority-parser"
import { parseImssConceptTables } from "../lib/imss-concept-table-parser"
import { parseImssObservations } from "../lib/imss-observations-parser"
import { stripSensitiveFields, maskIdentifier, isSensitiveKey } from "../lib/sanitize-sensitive-fields"
import { reconstructLines } from "../lib/line-reconstruction"
import { parseImssTarjeton } from "../lib/imss-tarjeton-parser"
import { applyConceptEdits, needsExplicitConfirmation, updateReviewedConcept } from "../lib/confirm-mark"
import { buildDifferences } from "../components/Differences"
import { DETAIL_LABELS, buildFriendlyWarnings } from "../components/Review"
import { imssPositionedTextFixture, expectedSyntheticValues } from "./fixtures/imss-positioned-text"
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

  it("conserva filas distintas aunque repitan el mismo código", () => {
    const repeated = reconstructLines([
      item(1, "PERCEPCIONES"),
      item(2, "055 FONDO A 100.00"),
      item(3, "055 FONDO B 200.00"),
      item(4, "TOTAL PERCEPCIONES 300.00"),
    ])
    expect(parseImssConceptTables(repeated, []).earnings.map((line) => line.amount)).toEqual([100, 200])
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

  it("conserva texto libre solo dentro de la región de observaciones", () => {
    const freeText = reconstructLines([
      item(1, "OBSERVACIONES"),
      item(2, "ACLARACION GENERAL SIN CONCEPTO"),
      item(3, "CERTIFICACION"),
    ])
    expect(parseImssObservations(freeText)).toEqual([
      { lineIndex: 0, conceptCode: "", notes: "ACLARACION GENERAL SIN CONCEPTO" },
    ])
  })

  it("reconstruye encabezados compuestos cuando OCR los separa por palabra", () => {
    const ocrLines = reconstructLines([
      positionedItem(10, 10, "OBSERVACIONES", "ocr"),
      positionedItem(10, 30, "CONCEPTO", "ocr"), positionedItem(80, 30, "IMPORTE", "ocr"),
      positionedItem(150, 30, "VENCIMIENTO", "ocr"), positionedItem(230, 30, "UNIDADES", "ocr"),
      positionedItem(300, 30, "NUM", "ocr"), positionedItem(325, 30, "CONTROL", "ocr"),
      positionedItem(390, 30, "CARGO", "ocr"), positionedItem(425, 30, "INICIAL", "ocr"),
      positionedItem(500, 30, "OBSERVACIONES", "ocr"),
      positionedItem(10, 50, "190", "ocr"), positionedItem(80, 50, "1,430.19", "ocr"),
      positionedItem(150, 50, "2026014", "ocr"), positionedItem(230, 50, "2", "ocr"),
      positionedItem(300, 50, "A01", "ocr"), positionedItem(390, 50, "8,000.00", "ocr"),
      positionedItem(500, 50, "Préstamo", "ocr"),
      positionedItem(500, 62, "vigente", "ocr"),
      positionedItem(10, 80, "CERTIFICACION", "ocr"),
    ])
    expect(parseImssObservations(ocrLines)).toEqual([
      expect.objectContaining({
        conceptCode: "190",
        amount: 1430.19,
        duePeriod: "2026014",
        units: 2,
        controlNumber: "A01",
        initialCharge: 8000,
        notes: "Préstamo vigente",
      }),
    ])
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

    expect(parsed.employee).toEqual({})

    expect(parsed.payroll.earnings.map((l) => l.code)).toEqual(["002", "011", "055"])
    expect(parsed.payroll.deductions.map((l) => l.code)).toEqual(["212"])
    expect(parsed.payroll.totalEarnings).toBe(7572.41)
    expect(parsed.payroll.netPay).toBe(6337.85)
    expect(parsed.payroll.daysWorkedInYear).toBeUndefined()

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

  it("extrae el fixture geométrico completo sin mezclar columnas", async () => {
    const shiftedItems = imssPositionedTextFixture.map((pdfItem) => ({ ...pdfItem, x: pdfItem.x + 100 }))
    const outcome = await parseImssTarjeton({ items: shiftedItems, pageCount: 2, hashText: async () => "f".repeat(64) })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    expect(outcome.parsed.document).toMatchObject({ periodRaw: expectedSyntheticValues.periodRaw, year: 2026, month: 7, half: 2, folio: "4321" })
    expect(outcome.parsed.employee).toMatchObject({
      employeeNumber: expectedSyntheticValues.employeeNumber,
      fullName: expectedSyntheticValues.fullName,
      categoryCode: expectedSyntheticValues.categoryCode,
      categoryName: expectedSyntheticValues.categoryName,
      workdayHours: 8,
      entryDate: expectedSyntheticValues.entryDate,
    })
    expect(outcome.parsed.employee).not.toHaveProperty("assignmentName")
    expect(outcome.parsed.employee.seniority).toMatchObject({ years: 12, fortnights: 4, days: 2 })
    expect(outcome.parsed.payroll.earnings).toHaveLength(10)
    expect(outcome.parsed.payroll.deductions).toHaveLength(7)
    expect(outcome.parsed.payroll.earnings.map(({ code, description, amount }) => [code, description, amount])).toEqual([
      ["002", "Sueldo Base Fijo", 3937.64],
      ["011", "Ayuda Renta Cláusula 63 Bis Inc b", 3234.77],
      ["020", "Ayuda Renta Cláusula 63 Bis Inc a", 250],
      ["022", "Ayuda Renta Cláusula 63 Bis Inc c", 1972.41],
      ["032", "Estímulo por Asistencia", 1721.37],
      ["033", "Estímulo por Puntualidad", 1147.58],
      ["050", "Ayuda para Despensa", 200],
      ["054", "Emanaciones Radioactivas no Médicas", 1434.48],
      ["055", "Fondo de Ahorro", 21934.68],
      ["072", "Ayuda para Libros", 358.62],
    ])
    expect(outcome.parsed.payroll.deductions.map(({ code, description, amount }) => [code, description, amount])).toEqual([
      ["111", "Aport Complementaria Afore", 5321.15],
      ["112", "Fondo Ayuda Sindical por Defunción", 55.31],
      ["151", "ISR", 313.03],
      ["154", "Descuento Crédito INFONAVIT", 2670.42],
      ["180", "Cuota Sindical", 143.45],
      ["190", "Caja de ahorro préstamo", 1430.19],
      ["192", "Caja de Ahorro Ahorro", 14720],
    ])
    const conceptIndexes = [...outcome.parsed.payroll.earnings, ...outcome.parsed.payroll.deductions]
      .map((line) => line.lineIndex)
    expect(new Set(conceptIndexes).size).toBe(conceptIndexes.length)
    expect(outcome.parsed.payroll.totalEarnings).toBe(expectedSyntheticValues.totalEarnings)
    expect(outcome.parsed.payroll.totalDeductions).toBe(expectedSyntheticValues.totalDeductions)
    expect(outcome.parsed.payroll.netPay).toBe(expectedSyntheticValues.netPay)
    expect(outcome.parsed.extraction.validations).toMatchObject({
      earningsTotalMatches: true,
      deductionsTotalMatches: true,
      netPayMatches: true,
    })
    expect(outcome.parsed.extraction.globalConfidence).toBeGreaterThanOrEqual(0.95)

    expect(outcome.parsed.attendance).toMatchObject({
      delays: 0, exitPasses: 2, absences: 0, noDelayDays: 4, attendanceScore: 2,
      maternityLeave: 0, license140Bis: 0, paidLicenses: 0, unpaidLicenses: 0,
      commissions: 12, concept033Days: 1,
    })
    expect(outcome.parsed.vacations).toMatchObject({ enjoyedDays: 10, daysInYear: 20, continuityMark: 1, periodNumberToEnjoy: 12 })
    expect(outcome.parsed.payroll).toMatchObject({ daysWorkedInYear: 100, daysPaidInFortnight: 14, integratedMonthlySalary: 22058.6, creditCapacity: -2390.73 })
    expect(outcome.parsed.payroll.earnings.find((line) => line.code === "011")?.description).toBe("Ayuda Renta Cláusula 63 Bis Inc b")
    expect(outcome.parsed.payroll.earnings.every((line) => !/\b(?:111|112|151|154|180|190|192)\b/.test(line.description))).toBe(true)
    expect(outcome.parsed.payroll.observations.map((observation) => observation.conceptCode)).toEqual(["154", "190", "192", "192", "032", "055"])

    const withoutTotals = shiftedItems.filter((pdfItem) => pdfItem.y !== 608 && pdfItem.y !== 626)
    const incompleteOutcome = await parseImssTarjeton({ items: withoutTotals, pageCount: 2 })
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

  it("edita solo la fila identificada por tipo e índice", () => {
    const rows = [
      { lineIndex: 0, code: "002", description: "Sueldo", amount: 100, kind: "earning" as const, confidence: 0.9, confirmedByUser: false },
      { lineIndex: 0, code: "111", description: "Afore", amount: 50, kind: "deduction" as const, confidence: 0.9, confirmedByUser: false },
    ]
    const updated = updateReviewedConcept(rows, { kind: "earning", lineIndex: 0 }, { amount: 125, deleted: true })
    expect(updated[0]).toMatchObject({ amount: 125, deleted: true })
    expect(updated[1]).toEqual(rows[1])
    const restored = updateReviewedConcept(updated, { kind: "earning", lineIndex: 0 }, { deleted: false })
    expect(restored[0].deleted).toBe(false)
  })
})

describe("presentación amigable del tarjetón", () => {
  it("nunca ofrece adscripción y compara la categoría por nombre", async () => {
    const outcome = await parseImssTarjeton({ items: imssPositionedTextFixture, pageCount: 2 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const differences = buildDifferences(outcome.parsed, {
      fullName: expectedSyntheticValues.fullName,
      matricula: expectedSyntheticValues.employeeNumber,
      categoria: "OTRA CATEGORIA",
      antiguedad: outcome.parsed.employee.seniority?.raw,
    })
    expect(differences).toEqual([expect.objectContaining({ key: "categoria", detected: "TECNICO RADIOLOGO 80" })])
    expect(differences.some((difference) => String(difference.key).includes("adscripcion"))).toBe(false)
  })

  it("permite importar la categoría cuando el perfil todavía está vacío", async () => {
    const outcome = await parseImssTarjeton({ items: imssPositionedTextFixture, pageCount: 2 })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(buildDifferences(outcome.parsed, { categoria: null })).toEqual([
      expect.objectContaining({ key: "categoria", current: null, detected: "TECNICO RADIOLOGO 80" }),
    ])
  })

  it("traduce las claves visibles y agrupa advertencias técnicas", () => {
    const requiredLabels = ["delays", "exitPasses", "absences", "noDelayDays", "attendanceScore", "maternityLeave", "license140Bis", "paidLicenses", "unpaidLicenses", "commissions", "concept033Days", "enjoyedDays", "daysInYear", "continuityMark", "periodNumberToEnjoy"]
    expect(requiredLabels.every((key) => Boolean(DETAIL_LABELS[key]))).toBe(true)
    const warnings = buildFriendlyWarnings([
      "Fila de percepción sin interpretar.",
      "Fila de deducción sin interpretar.",
      "No se pudieron separar las tablas por coordenadas; revisa percepciones y deducciones.",
    ])
    expect(warnings).toHaveLength(2)
    expect(warnings.join(" ")).not.toMatch(/earning|deduction|lineIndex|assignmentName|requiresReview/i)
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
function positionedItem(
  x: number,
  y: number,
  text: string,
  method: PositionedPdfText["method"] = "native_text",
): PositionedPdfText {
  return {
    text,
    page: 1,
    x,
    y,
    width: Math.max(10, text.length * 3),
    height: 10,
    confidence: method === "ocr" ? 0.95 : 1,
    method,
  }
}
