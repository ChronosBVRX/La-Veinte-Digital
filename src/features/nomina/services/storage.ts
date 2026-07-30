import type { EmployeePayrollProfile, ImportedPayslip, PayrollProjection } from "../lib/types"

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
    return JSON.parse(raw) as EmployeePayrollProfile
  } catch {
    return null
  }
}

export function saveProfile(profile: EmployeePayrollProfile): void {
  if (typeof window === "undefined") return
  localStorage.setItem(NOMINA_PROFILE_KEY, JSON.stringify(profile))
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
    return JSON.parse(raw) as ImportedPayslip[]
  } catch {
    return []
  }
}

export function savePayslip(payslip: ImportedPayslip): void {
  if (typeof window === "undefined") return
  const slips = getPayslips()
  const idx = slips.findIndex((s) => s.id === payslip.id)
  if (idx >= 0) {
    slips[idx] = payslip
  } else {
    slips.push(payslip)
  }
  localStorage.setItem(NOMINA_PAYSLIPS_KEY, JSON.stringify(slips))
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
