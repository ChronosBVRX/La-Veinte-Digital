import { describe, expect, it } from "vitest"
import {
  safeMoney,
  safeUnits,
  safeIntegerIn,
  safeDate,
  safeConfidence,
  sanitizeTarjetonForPersistence,
  MAX_ABS_MONEY,
  MAX_SMALLINT,
} from "../lib/safe-values"
import type { ParsedImssTarjeton } from "@/shared/contracts/tarjeton-import"

function makeParsed(overrides: Partial<ParsedImssTarjeton["payroll"]> = {}): ParsedImssTarjeton {
  return {
    schemaVersion: "1.0",
    document: {
      type: "imss_payroll_receipt",
      pageCount: 1,
      periodRaw: "1A-ENE-2026",
      year: 2026,
      month: 1,
      half: 1,
      certificationDate: "2026-01-31",
    },
    employee: {},
    attendance: {},
    vacations: {},
    payroll: {
      earnings: [
        { lineIndex: 0, code: "002", description: "SUELDO", amount: 3937.64, kind: "earning", confidence: 0.98, confirmedByUser: true },
      ],
      deductions: [
        { lineIndex: 0, code: "212", description: "ISR", amount: -234.56, kind: "deduction", confidence: 0.98, confirmedByUser: true },
      ],
      observations: [],
      totalEarnings: 3937.64,
      totalDeductions: 234.56,
      netPay: 3703.08,
      ...overrides,
    },
    extraction: {
      method: "native_text",
      globalConfidence: 0.98,
      warnings: [],
      validations: {
        templateDetected: true,
        earningsTotalMatches: null,
        deductionsTotalMatches: null,
        netPayMatches: null,
        employeeMatchesProfile: null,
        categoryResolved: null,
      },
    },
  }
}

describe("safe-values", () => {
  it("safeMoney rechaza no finitos, NaN y valores gigantes", () => {
    expect(safeMoney(3180.45)).toBe(3180.45)
    expect(safeMoney(-1234.5)).toBe(-1234.5)
    expect(safeMoney(3180.455)).toBe(3180.46)
    expect(safeMoney(Number.NaN)).toBeUndefined()
    expect(safeMoney(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(safeMoney(742135987210)).toBeUndefined()
    expect(safeMoney(MAX_ABS_MONEY)).toBe(MAX_ABS_MONEY)
    expect(safeMoney("100")).toBeUndefined()
    expect(safeMoney(undefined)).toBeUndefined()
  })

  it("safeUnits solo acepta enteros dentro de SMALLINT", () => {
    expect(safeUnits(3)).toBe(3)
    expect(safeUnits(0)).toBe(0)
    expect(safeUnits(MAX_SMALLINT)).toBe(MAX_SMALLINT)
    expect(safeUnits(32768)).toBeUndefined()
    expect(safeUnits(99999)).toBeUndefined()
    expect(safeUnits(2.5)).toBeUndefined()
    expect(safeUnits(-1)).toBeUndefined()
    expect(safeUnits(Number.NaN)).toBeUndefined()
  })

  it("safeIntegerIn valida rango y entereza", () => {
    expect(safeIntegerIn(2026, 1900, 2100)).toBe(2026)
    expect(safeIntegerIn(2026.5, 1900, 2100)).toBeUndefined()
    expect(safeIntegerIn(1850, 1900, 2100)).toBeUndefined()
    expect(safeIntegerIn(undefined, 1900, 2100)).toBeUndefined()
  })

  it("safeDate solo acepta fechas ISO reales", () => {
    expect(safeDate("2026-01-31")).toBe("2026-01-31")
    expect(safeDate("31-01-2026")).toBeUndefined()
    expect(safeDate("2026-13-01")).toBeUndefined()
    expect(safeDate("2026-02-30")).toBeUndefined()
    expect(safeDate("")).toBeUndefined()
    expect(safeDate(undefined)).toBeUndefined()
    expect(safeDate("hola")).toBeUndefined()
  })

  it("safeConfidence clampa a 0..1 y redondea a 3 decimales", () => {
    expect(safeConfidence(0.987654321)).toBe(0.988)
    expect(safeConfidence(99.8)).toBe(1)
    expect(safeConfidence(-5)).toBe(0)
    expect(safeConfidence(Number.NaN)).toBe(0)
    expect(safeConfidence(0.98)).toBe(0.98)
  })
})

describe("sanitizeTarjetonForPersistence", () => {
  it("normaliza initialCharge gigantesco a undefined + warning y conserva el tarjetón", () => {
    const parsed = makeParsed({
      observations: [
        { lineIndex: 0, conceptCode: "190", amount: 2670.42, units: 2, initialCharge: 742135987210 },
      ],
    })
    const { parsed: clean, sanitized, critical } = sanitizeTarjetonForPersistence(parsed)
    expect(critical).toEqual([])
    expect(clean.payroll.observations[0]).toEqual({
      lineIndex: 0,
      conceptCode: "190",
      amount: 2670.42,
      units: 2,
    })
    expect(clean.payroll.observations[0]).not.toHaveProperty("initialCharge")
    expect(sanitized).toContain("Observación 1 (190): cargo inicial inválido; se omitió.")
    expect(clean.extraction.warnings).toContain("Observación 1 (190): cargo inicial inválido; se omitió.")
  })

  it("normaliza units fuera de SMALLINT", () => {
    const parsed = makeParsed({
      observations: [
        { lineIndex: 0, conceptCode: "055", units: 99999 },
      ],
    })
    const { parsed: clean, sanitized } = sanitizeTarjetonForPersistence(parsed)
    expect(clean.payroll.observations[0].units).toBeUndefined()
    expect(clean.payroll.observations[0].conceptCode).toBe("055")
    expect(sanitized.some((warning) => warning.includes("unidades inválidas"))).toBe(true)
  })

  it("conserva observación sin amount y observación parcialmente vacía", () => {
    const parsed = makeParsed({
      observations: [
        { lineIndex: 0, conceptCode: "032", notes: "SIN IMPORTE" },
        { lineIndex: 1, conceptCode: "" },
      ],
    })
    const { parsed: clean, critical } = sanitizeTarjetonForPersistence(parsed)
    expect(critical).toEqual([])
    expect(clean.payroll.observations[0]).toEqual({ lineIndex: 0, conceptCode: "032", notes: "SIN IMPORTE" })
    expect(clean.payroll.observations[1]).toEqual({ lineIndex: 1, conceptCode: "" })
  })

  it("redondea confianza con muchos decimales en líneas y global", () => {
    const parsed = makeParsed({
      earnings: [
        { lineIndex: 0, code: "002", description: "SUELDO", amount: 3937.64, kind: "earning", confidence: 0.987654321, confirmedByUser: true },
      ],
    })
    parsed.extraction.globalConfidence = 0.987654321
    const { parsed: clean, sanitized } = sanitizeTarjetonForPersistence(parsed)
    expect(clean.payroll.earnings[0].confidence).toBe(0.988)
    expect(clean.extraction.globalConfidence).toBe(0.988)
    expect(sanitized).toEqual([])
  })

  it("clampa confianza fuera de 0..1 en líneas con warning", () => {
    const parsed = makeParsed({
      earnings: [
        { lineIndex: 0, code: "002", description: "SUELDO", amount: 3937.64, kind: "earning", confidence: 99.8, confirmedByUser: true },
      ],
    })
    const { parsed: clean, sanitized } = sanitizeTarjetonForPersistence(parsed)
    expect(clean.payroll.earnings[0].confidence).toBe(1)
    expect(sanitized).toContain("Percepción 002: confianza inválida; se ajustó.")
  })

  it("elimina año, mes, quincena y fecha de certificación inválidos con warnings", () => {
    const parsed = makeParsed()
    parsed.document.year = 2026.5 as never
    parsed.document.month = 13 as never
    parsed.document.half = 3 as never
    parsed.document.certificationDate = "31-01-2026"
    const { parsed: clean, sanitized } = sanitizeTarjetonForPersistence(parsed)
    expect(clean.document.year).toBeUndefined()
    expect(clean.document.month).toBeUndefined()
    expect(clean.document.half).toBeUndefined()
    expect(clean.document.certificationDate).toBeUndefined()
    expect(sanitized).toContain("Periodo: año inválido; se omitió.")
    expect(sanitized).toContain("Periodo: mes inválido; se omitió.")
    expect(sanitized).toContain("Periodo: quincena inválida; se omitió.")
    expect(sanitized).toContain("Fecha de certificación inválida; se omitió.")
  })

  it("elimina fecha efectiva de antigüedad inválida", () => {
    const parsed = makeParsed()
    parsed.employee.seniority = {
      raw: "14 a 3 q 1 d",
      years: 14,
      fortnights: 3,
      days: 1,
      reconstructedEffectiveDate: "2011-99-99",
      status: "complete",
    }
    const { parsed: clean, sanitized } = sanitizeTarjetonForPersistence(parsed)
    expect(clean.employee.seniority?.reconstructedEffectiveDate).toBeUndefined()
    expect(sanitized).toContain("Antigüedad: fecha efectiva inválida; se omitió.")
  })

  it("reporta como crítico un importe de concepto fuera de rango sin mutarlo", () => {
    const parsed = makeParsed({
      earnings: [
        { lineIndex: 0, code: "002", description: "SUELDO", amount: 742135987210, kind: "earning", confidence: 0.98, confirmedByUser: true },
      ],
    })
    const { parsed: clean, critical } = sanitizeTarjetonForPersistence(parsed)
    expect(critical).toContain("Percepción 002: importe fuera de rango.")
    expect(clean.payroll.earnings[0].amount).toBe(742135987210)
  })

  it("reporta como crítico un total fuera de rango", () => {
    const parsed = makeParsed({ totalEarnings: 742135987210 })
    const { critical } = sanitizeTarjetonForPersistence(parsed)
    expect(critical).toContain("Total totalEarnings: fuera de rango.")
  })

  it("no muta el objeto original", () => {
    const parsed = makeParsed({
      observations: [{ lineIndex: 0, conceptCode: "055", units: 99999 }],
    })
    sanitizeTarjetonForPersistence(parsed)
    expect(parsed.payroll.observations[0].units).toBe(99999)
    expect(parsed.extraction.warnings).toEqual([])
  })
})
