import type { EmployeePayrollProfile, ImportedPayslip, PayrollProjection } from "@/features/nomina/lib/types"

const NOMINA_PROFILE_KEY = "nomina_profile"
const NOMINA_PAYSLIPS_KEY = "nomina_payslips"
const NOMINA_PROJECTIONS_KEY = "nomina_projections"
const NOMINA_CONSENT_KEY = "nomina_consent"

export function hasConsent(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(NOMINA_CONSENT_KEY) === "true"
}

export function saveConsent(given: boolean): void {
  if (typeof window === "undefined") return
  if (given) {
    localStorage.setItem(NOMINA_CONSENT_KEY, "true")
  } else {
    localStorage.removeItem(NOMINA_CONSENT_KEY)
  }
}

export function getProfile(): EmployeePayrollProfile | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(NOMINA_PROFILE_KEY)
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as EmployeePayrollProfile
    p.facts = p.facts ?? []
    p.occupationalConditions = p.occupationalConditions ?? []
    p.siapConceptMarks = p.siapConceptMarks ?? []
    p.recurringConcepts = p.recurringConcepts ?? []
    return p
  } catch {
    return null
  }
}

export function deleteProjection(projectionId: string): void {
  if (typeof window === "undefined") return
  const projs = getProjections()
  const filtered = projs.filter((p) => p.id !== projectionId)
  localStorage.setItem(NOMINA_PROJECTIONS_KEY, JSON.stringify(filtered))
}

export function saveProfile(profile: EmployeePayrollProfile): void {
  if (typeof window === "undefined") return
  localStorage.setItem(NOMINA_PROFILE_KEY, JSON.stringify(profile))
  try {
    window.dispatchEvent(new CustomEvent("nomina_profile_updated", { detail: profile }))
  } catch {
    // noop en entornos sin CustomEvent
  }
}

export function deleteProfile(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(NOMINA_PROFILE_KEY)
  localStorage.removeItem(NOMINA_PAYSLIPS_KEY)
  localStorage.removeItem(NOMINA_PROJECTIONS_KEY)
}

export function getPayslips(): ImportedPayslip[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(NOMINA_PAYSLIPS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as ImportedPayslip[]
    if (!Array.isArray(parsed)) return []
    // Deduplicate on read if necessary
    const seen = new Map<string, ImportedPayslip>()
    for (const s of parsed) {
      const key =
        typeof s.period === "string"
          ? s.period
          : s.period?.id || s.period?.label || s.periodRaw || s.id
      const existing = seen.get(key)
      if (!existing) {
        seen.set(key, s)
      } else {
        const existingCount = ((existing.earnings ?? existing.perceptions)?.length ?? 0) + (existing.deductions?.length ?? 0)
        const sCount = ((s.earnings ?? s.perceptions)?.length ?? 0) + (s.deductions?.length ?? 0)
        if (sCount > existingCount) {
          seen.set(key, s)
        }
      }
    }
    return Array.from(seen.values()).map((s) => ({
      ...s,
      perceptions: s.perceptions ?? s.earnings ?? [],
      earnings: s.earnings ?? s.perceptions ?? [],
      netAmount: s.netAmount ?? s.netPay,
      netPay: s.netPay ?? s.netAmount ?? 0,
    }))
  } catch {
    return []
  }
}

export function savePayslip(payslip: ImportedPayslip): void {
  if (typeof window === "undefined") return
  const slips = getPayslips()
  const payslipPeriodKey =
    typeof payslip.period === "string"
      ? payslip.period
      : payslip.period?.id || payslip.period?.label || payslip.periodRaw || ""

  const normalizedPayslip: ImportedPayslip = {
    ...payslip,
    perceptions: payslip.perceptions ?? payslip.earnings ?? [],
    earnings: payslip.earnings ?? payslip.perceptions ?? [],
    netAmount: payslip.netAmount ?? payslip.netPay,
    netPay: payslip.netPay ?? payslip.netAmount ?? 0,
  }

  const idx = slips.findIndex((s) => {
    if (s.id === normalizedPayslip.id) return true
    const sPeriodKey =
      typeof s.period === "string"
        ? s.period
        : s.period?.id || s.period?.label || s.periodRaw || ""
    if (payslipPeriodKey && sPeriodKey) {
      if (payslipPeriodKey === sPeriodKey) return true
      if (payslipPeriodKey.includes(sPeriodKey) || sPeriodKey.includes(payslipPeriodKey)) return true
    }
    return false
  })

  if (idx >= 0) {
    const existing = slips[idx]
    const newConceptCount = (normalizedPayslip.earnings?.length ?? 0) + (normalizedPayslip.deductions?.length ?? 0)
    const oldConceptCount = (existing.earnings?.length ?? 0) + (existing.deductions?.length ?? 0)
    if (newConceptCount >= oldConceptCount) {
      slips[idx] = { ...existing, ...normalizedPayslip, id: existing.id }
    } else {
      slips[idx] = {
        ...normalizedPayslip,
        id: existing.id,
        earnings: existing.earnings,
        deductions: existing.deductions,
        perceptions: existing.earnings,
      }
    }
  } else {
    slips.push(normalizedPayslip)
  }
  localStorage.setItem(NOMINA_PAYSLIPS_KEY, JSON.stringify(slips))
  try {
    window.dispatchEvent(new CustomEvent("nomina_payslip_updated", { detail: normalizedPayslip }))
  } catch {
    // noop en entornos sin CustomEvent
  }
}

export function deduplicatePayslips(): void {
  if (typeof window === "undefined") return
  const slips = getPayslips()
  localStorage.setItem(NOMINA_PAYSLIPS_KEY, JSON.stringify(slips))
  try {
    window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))
  } catch {
    // noop
  }
}

export function getProjections(): PayrollProjection[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(NOMINA_PROJECTIONS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as PayrollProjection[]
  } catch {
    return []
  }
}

export function saveProjection(projection: PayrollProjection): void {
  if (typeof window === "undefined") return
  const projs = getProjections()
  const idx = projs.findIndex((p) => p.id === projection.id)
  if (idx >= 0) {
    projs[idx] = projection
  } else {
    projs.push(projection)
  }
  localStorage.setItem(NOMINA_PROJECTIONS_KEY, JSON.stringify(projs))
}

export function deleteAllData(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(NOMINA_PROFILE_KEY)
  localStorage.removeItem(NOMINA_PAYSLIPS_KEY)
  localStorage.removeItem(NOMINA_PROJECTIONS_KEY)
  localStorage.removeItem(NOMINA_CONSENT_KEY)
}
