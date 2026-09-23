import type { WorkerContext } from "@/shared/server/worker-context-builder"
import { parseImssPeriod } from "@/features/tarjeton/lib/imss-date-parser"
import type { SalaryBaseType, SubstituteCoverageType } from "../lib/calculate-salary-increase"

/**
 * Adaptador: extrae sueldo tabular (002) o sueldo sustituto (008), y Concepto 11 (011)
 * del tarjetón activo canónico (`GET /api/worker-context` → `payroll.recurringConcepts`).
 *
 * Es la misma fuente que alimenta a las calculadoras (prerrelleno
 * `concepto002`/`concepto011`): líneas confirmadas del tarjetón activo
 * (`imported_payslip_lines`, mismo `activePayslipId`/periodo). No crea una
 * segunda fuente de verdad y no toca el parser del tarjetón.
 *
 * REGLAS OBLIGATORIAS:
 * 1. Admite el concepto 008 como sueldo tabular de sustitución, con una rama explícita
 *    e identificable, SIN renombrarlo a 002.
 * 2. Distingue cobertura parcial comprobada de cobertura desconocida: el concepto 008
 *    por sí solo no confirma días trabajados ni tipo permanente de contratación.
 * 3. La base (002 o 008) y el 011 deben proceder de líneas confirmadas del MISMO tarjetón
 *    activo, matrícula y periodo coherente.
 * 4. Si coexisten 002 y 008 o coberturas mezcladas, verificar tramos; si no se acreditan,
 *    marcar `hasAmbiguousCoverages: true` y `salaryType: "mixed"` (faltan datos para estimar).
 * 5. Valida vigencia desde el 16 de octubre de 2026 (quincena 20 / 2A-OCT-2026): si el
 *    tarjetón corresponde a esa vigencia, marca `isPostCutoff: true` sin afirmar que el
 *    nuevo tabulador ya se aplicó ni devolver $0.00 como si fuera cálculo definitivo.
 */

export interface SalaryEstimateSelection {
  hasPayslip: boolean
  salaryType?: SalaryBaseType
  tabular: unknown // numeric amount if base (002), undefined if substitute or missing
  substituteSalary?: unknown // numeric amount if substitute (008), undefined if base or missing
  concept002Amount?: number
  concept008Amount?: number
  concept11: unknown
  activePayslipId?: string | null
  activePeriod?: string | null
  isPostCutoff?: boolean
  hasAmbiguousCoverages?: boolean
  substituteCoverage?: SubstituteCoverageType
  daysPaid?: number
  tabularPayslipId?: string | null
  concept11PayslipId?: string | null
  substitutePayslipId?: string | null
}

interface ConceptPeriodMatch {
  amount: number
  period: string | null
  payslipId: string | null
}

export function isPeriodPostCutoff(periodRaw: string | null | undefined): boolean {
  if (!periodRaw || typeof periodRaw !== "string") return false
  const trimmed = periodRaw.trim().toUpperCase()

  // 1. Formato IMSS canónico: "2A-OCT-2026", "1A-NOV-2026", etc.
  const parsed = parseImssPeriod(trimmed)
  if (parsed) {
    if (parsed.year > 2026) return true
    if (parsed.year === 2026) {
      if (parsed.month > 10) return true
      if (parsed.month === 10 && parsed.half >= 2) return true
    }
    return false
  }

  // 2. Formato YYYY-MM-Q#: "2026-10-Q2"
  const qMatch = trimmed.match(/^(\d{4})-(\d{2})-Q([12])$/)
  if (qMatch) {
    const year = Number(qMatch[1])
    const month = Number(qMatch[2])
    const half = Number(qMatch[3])
    if (year > 2026) return true
    if (year === 2026) {
      if (month > 10) return true
      if (month === 10 && half >= 2) return true
    }
    return false
  }

  // 3. Formato quincenas continuas YYYY/NN: "2026/20" (quincena 20 = 2A-OCT)
  const qnaMatch = trimmed.match(/^(\d{4})\/(\d{1,2})$/)
  if (qnaMatch) {
    const year = Number(qnaMatch[1])
    const qna = Number(qnaMatch[2])
    if (year > 2026) return true
    if (year === 2026 && qna >= 20) return true
    return false
  }

  // 4. Formato fecha civil ISO: "2026-10-16"
  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateMatch) {
    return trimmed >= "2026-10-16"
  }

  return false
}

function findRecurringEntry(
  concepts: unknown,
  code: "002" | "008" | "011",
  activePeriod?: string | null,
  activePayslipId?: string | null,
): ConceptPeriodMatch | undefined {
  if (!Array.isArray(concepts)) return undefined
  let totalAmount = 0
  let found = false
  let matchedPeriod: string | null = null
  let matchedPayslipId: string | null = null

  for (const entry of concepts) {
    if (!entry || typeof entry !== "object") continue
    const rec = entry as {
      conceptCode?: unknown
      lastAmount?: unknown
      lastSeenAt?: unknown
      source?: unknown
      confirmed?: unknown
      payslipId?: unknown
    }
    if (rec.conceptCode !== code) continue
    if (rec.confirmed === false) continue

    const entryPayslipId = typeof rec.payslipId === "string" ? rec.payslipId.trim() : null
    const entryPeriod = typeof rec.lastSeenAt === "string" ? rec.lastSeenAt.trim() : null

    // Procedencia comprobada: para atribuirse al tarjetón activo, el concepto DEBE tener
    // payslipId explícito y coincidir exactamente con activePayslipId.
    // Si no tiene payslipId (o difiere de activePayslipId), su procedencia no está comprobada y se rechaza.
    if (!entryPayslipId || (activePayslipId && entryPayslipId !== activePayslipId)) {
      continue
    }

    // Coherencia de periodo si está definido tanto en el concepto como en el tarjetón activo
    if (activePeriod && entryPeriod && entryPeriod !== activePeriod) {
      continue
    }

    if (typeof rec.lastAmount === "number" && Number.isFinite(rec.lastAmount) && rec.lastAmount >= 0) {
      totalAmount += rec.lastAmount
      found = true
      matchedPeriod = entryPeriod ?? activePeriod ?? null
      matchedPayslipId = entryPayslipId
    }
  }

  if (found) {
    return {
      amount: Math.round(totalAmount * 100) / 100,
      period: matchedPeriod,
      payslipId: matchedPayslipId,
    }
  }
  return undefined
}

export function selectSalaryEstimateInputs(
  context: WorkerContext | null | undefined,
): SalaryEstimateSelection {
  const activePayslipId = context?.meta?.activePayslipId ?? null
  if (!context || !activePayslipId) {
    return {
      hasPayslip: false,
      tabular: undefined,
      concept11: undefined,
    }
  }

  // Validar coherencia de matrícula si ambos están presentes
  const metaMatricula = context.meta?.activeEmployeeNumber?.trim()
  const profileMatricula = context.profile?.matricula?.trim()
  if (metaMatricula && profileMatricula && metaMatricula !== profileMatricula) {
    return {
      hasPayslip: false,
      tabular: undefined,
      concept11: undefined,
    }
  }

  const activePeriod = context.meta?.activePayslipPeriod || context.payroll?.latestPeriod || null
  const concepts = context?.payroll?.recurringConcepts

  const tabularEntry = findRecurringEntry(concepts, "002", activePeriod, activePayslipId)
  const substituteEntry = findRecurringEntry(concepts, "008", activePeriod, activePayslipId)
  const concept11Entry = findRecurringEntry(concepts, "011", activePeriod, activePayslipId)

  const isPostCutoff = isPeriodPostCutoff(activePeriod)

  // Caso 1: Coexisten 002 y 008 (coberturas mezcladas sin tramos acreditados)
  if (tabularEntry && substituteEntry) {
    return {
      hasPayslip: true,
      salaryType: "mixed",
      hasAmbiguousCoverages: true,
      concept002Amount: tabularEntry.amount,
      concept008Amount: substituteEntry.amount,
      tabular: undefined,
      substituteSalary: undefined,
      concept11: concept11Entry?.amount,
      activePayslipId,
      activePeriod,
      isPostCutoff,
      tabularPayslipId: tabularEntry.payslipId,
      substitutePayslipId: substituteEntry.payslipId,
      concept11PayslipId: concept11Entry?.payslipId,
    }
  }

  // Caso 2: Sueldo tabular ordinario (002)
  if (tabularEntry) {
    const validConcept11 =
      concept11Entry &&
      concept11Entry.payslipId === activePayslipId &&
      (!tabularEntry.period || !concept11Entry.period || tabularEntry.period === concept11Entry.period)
        ? concept11Entry.amount
        : undefined

    return {
      hasPayslip: true,
      salaryType: "base",
      concept002Amount: tabularEntry.amount,
      tabular: tabularEntry.amount,
      substituteSalary: undefined,
      concept11: validConcept11,
      activePayslipId,
      activePeriod,
      isPostCutoff,
      tabularPayslipId: tabularEntry.payslipId,
      concept11PayslipId: validConcept11 !== undefined ? (concept11Entry?.payslipId ?? null) : undefined,
    }
  }

  // Caso 3: Sueldo tabular de sustitución (008) — Rama explícita e identificable
  if (substituteEntry) {
    const validConcept11 =
      concept11Entry &&
      concept11Entry.payslipId === activePayslipId &&
      (!substituteEntry.period || !concept11Entry.period || substituteEntry.period === concept11Entry.period)
        ? concept11Entry.amount
        : undefined

    const rawDays = (context?.payroll as { daysPaidInFortnight?: unknown })?.daysPaidInFortnight
    const daysPaid = typeof rawDays === "number" && rawDays > 0 ? rawDays : undefined
    const substituteCoverage: SubstituteCoverageType = daysPaid !== undefined ? "partial_confirmed" : "unknown"

    return {
      hasPayslip: true,
      salaryType: "substitute",
      concept008Amount: substituteEntry.amount,
      tabular: undefined, // NO se renombra a 002
      substituteSalary: substituteEntry.amount,
      concept11: validConcept11,
      activePayslipId,
      activePeriod,
      isPostCutoff,
      substituteCoverage,
      daysPaid,
      substitutePayslipId: substituteEntry.payslipId,
      concept11PayslipId: validConcept11 !== undefined ? (concept11Entry?.payslipId ?? null) : undefined,
    }
  }

  // Caso 4: No cuenta con 002 ni 008 en el tarjetón activo
  const validConcept11 =
    concept11Entry && concept11Entry.payslipId === activePayslipId
      ? concept11Entry.amount
      : undefined

  return {
    hasPayslip: true,
    salaryType: "none",
    tabular: undefined,
    substituteSalary: undefined,
    concept11: validConcept11,
    activePayslipId,
    activePeriod,
    isPostCutoff,
    concept11PayslipId: validConcept11 !== undefined ? (concept11Entry?.payslipId ?? null) : undefined,
  }
}
