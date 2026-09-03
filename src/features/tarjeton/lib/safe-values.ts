/**
 * Sanitización de valores numéricos del tarjetón antes de persistirlos.
 *
 * Regla de producto:
 * - DATOS SECUNDARIOS (observaciones, fechas auxiliares, confianzas):
 *   un valor mal leído por el PDF/OCR se normaliza a undefined y se
 *   registra un warning; nunca aborta la confirmación completa.
 * - DATOS CRÍTICOS (importes de conceptos y totales): un valor fuera de
 *   rango se reporta por separado (`critical`) para que el flujo lo
 *   rechace con un mensaje claro.
 *
 * Estas funciones son puras y se ejecutan en el cliente (antes de enviar
 * el contrato) y de nuevo en el servidor (defensa en profundidad). La
 * sanitización es idempotente.
 */
import type { ParsedImssTarjeton, TarjetonObservation } from "@/shared/contracts/tarjeton-import"
import { roundImssMoney } from "./money-parser"
import { isValidMexicanCivilDate } from "./imss-date-parser"

/** Sanidad de importe: coincide con la corrección previa de initialCharge. */
export const MAX_ABS_MONEY = 100_000_000
/** Límite de SMALLINT en PostgreSQL (columna units). */
export const MAX_SMALLINT = 32767
export const MIN_YEAR = 1900
export const MAX_YEAR = 2100

export function safeMoney(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  if (Math.abs(value) > MAX_ABS_MONEY) return undefined
  return roundImssMoney(value)
}

export function safeUnits(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined
  if (value < 0 || value > MAX_SMALLINT) return undefined
  return value
}

export function safeIntegerIn(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) return undefined
  if (value < min || value > max) return undefined
  return value
}

/** Fecha ISO estricta YYYY-MM-DD y que exista en el calendario civil mexicano. */
export function safeDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!isValidMexicanCivilDate(day, month, year)) return undefined
  return value
}

/** Confianza 0..1 redondeada a 3 decimales (NUMERIC(4,3)); inválida → 0. */
export function safeConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000
}

export interface TarjetonSanitizationResult {
  parsed: ParsedImssTarjeton
  /** Warnings por campos secundarios normalizados (sin datos sensibles). */
  sanitized: string[]
  /** Errores de datos críticos que deben impedir la confirmación. */
  critical: string[]
}

export function sanitizeTarjetonForPersistence(parsed: ParsedImssTarjeton): TarjetonSanitizationResult {
  const sanitized: string[] = []
  const critical: string[] = []

  const observations: TarjetonObservation[] = parsed.payroll.observations.map((obs, index) => {
    const clean: TarjetonObservation = { ...obs }
    const label = `Observación ${index + 1}${obs.conceptCode ? ` (${obs.conceptCode})` : ""}`

    if (obs.amount !== undefined) {
      const amount = safeMoney(obs.amount)
      if (amount === undefined) {
        delete clean.amount
        sanitized.push(`${label}: importe inválido; se omitió.`)
      } else {
        clean.amount = amount
      }
    }
    if (obs.units !== undefined) {
      const units = safeUnits(obs.units)
      if (units === undefined) {
        delete clean.units
        sanitized.push(`${label}: unidades inválidas; se omitieron.`)
      } else {
        clean.units = units
      }
    }
    if (obs.initialCharge !== undefined) {
      const initialCharge = safeMoney(obs.initialCharge)
      if (initialCharge === undefined) {
        delete clean.initialCharge
        sanitized.push(`${label}: cargo inicial inválido; se omitió.`)
      } else {
        clean.initialCharge = initialCharge
      }
    }

    return clean
  })

  const document = { ...parsed.document }
  const year = safeIntegerIn(parsed.document.year, MIN_YEAR, MAX_YEAR)
  if (parsed.document.year !== undefined && year === undefined) {
    delete document.year
    sanitized.push("Periodo: año inválido; se omitió.")
  } else if (year !== undefined) {
    document.year = year
  }
  const month = safeIntegerIn(parsed.document.month, 1, 12)
  if (parsed.document.month !== undefined && month === undefined) {
    delete document.month
    sanitized.push("Periodo: mes inválido; se omitió.")
  } else if (month !== undefined) {
    document.month = month
  }
  const half = safeIntegerIn(parsed.document.half, 1, 2)
  if (parsed.document.half !== undefined && half === undefined) {
    delete document.half
    sanitized.push("Periodo: quincena inválida; se omitió.")
  } else if (half === 1 || half === 2) {
    document.half = half
  }
  const certificationDate = safeDate(parsed.document.certificationDate)
  if (parsed.document.certificationDate !== undefined && certificationDate === undefined) {
    delete document.certificationDate
    sanitized.push("Fecha de certificación inválida; se omitió.")
  } else if (certificationDate !== undefined) {
    document.certificationDate = certificationDate
  }

  const employee = {
    ...parsed.employee,
    seniority: parsed.employee.seniority ? { ...parsed.employee.seniority } : undefined,
  }
  if (employee.seniority?.reconstructedEffectiveDate !== undefined) {
    const effective = safeDate(employee.seniority.reconstructedEffectiveDate)
    if (effective === undefined) {
      delete employee.seniority.reconstructedEffectiveDate
      sanitized.push("Antigüedad: fecha efectiva inválida; se omitió.")
    } else {
      employee.seniority.reconstructedEffectiveDate = effective
    }
  }

  const sanitizeLine = (line: ParsedImssTarjeton["payroll"]["earnings"][number]) => {
    const kindLabel = line.kind === "earning" ? "Percepción" : "Deducción"
    if (
      typeof line.amount !== "number" ||
      !Number.isFinite(line.amount) ||
      Math.abs(line.amount) > MAX_ABS_MONEY
    ) {
      critical.push(`${kindLabel} ${line.code}: importe fuera de rango.`)
    }
    const confidence = safeConfidence(line.confidence)
    if (
      typeof line.confidence !== "number" ||
      !Number.isFinite(line.confidence) ||
      line.confidence < 0 ||
      line.confidence > 1
    ) {
      sanitized.push(`${kindLabel} ${line.code}: confianza inválida; se ajustó.`)
    }
    return { ...line, confidence }
  }
  const earnings = parsed.payroll.earnings.map(sanitizeLine)
  const deductions = parsed.payroll.deductions.map(sanitizeLine)

  for (const key of ["totalEarnings", "totalDeductions", "netPay"] as const) {
    const total = parsed.payroll[key]
    if (
      total !== undefined &&
      (typeof total !== "number" || !Number.isFinite(total) || Math.abs(total) > MAX_ABS_MONEY)
    ) {
      critical.push(`Total ${key}: fuera de rango.`)
    }
  }

  const globalConfidence = safeConfidence(parsed.extraction.globalConfidence)
  if (
    typeof parsed.extraction.globalConfidence !== "number" ||
    !Number.isFinite(parsed.extraction.globalConfidence) ||
    parsed.extraction.globalConfidence < 0 ||
    parsed.extraction.globalConfidence > 1
  ) {
    sanitized.push("Confianza global inválida; se ajustó.")
  }

  const vacations = { ...parsed.vacations }
  if (vacations.porVencer !== undefined) {
    const porVencer = safeDate(vacations.porVencer)
    if (porVencer === undefined) {
      delete vacations.porVencer
      sanitized.push("Vacaciones: fecha por vencer inválida; se omitió.")
    } else {
      vacations.porVencer = porVencer
      if (!vacations.dueDate) {
        vacations.dueDate = porVencer
      }
    }
  }

  if (vacations.dueDate !== undefined) {
    const dueDate = safeDate(vacations.dueDate)
    if (dueDate === undefined) {
      delete vacations.dueDate
    } else {
      vacations.dueDate = dueDate
      if (!vacations.porVencer) {
        vacations.porVencer = dueDate
      }
    }
  }

  const payroll = { ...parsed.payroll, earnings, deductions, observations }
  const extraction = {
    ...parsed.extraction,
    globalConfidence,
    warnings: [...parsed.extraction.warnings, ...sanitized],
  }

  return {
    parsed: { ...parsed, document, employee, vacations, payroll, extraction },
    sanitized,
    critical,
  }
}
