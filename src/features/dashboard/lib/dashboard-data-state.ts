/**
 * Estado de datos del Home.
 *
 * Regla fundamental: un error de consulta NUNCA se interpreta como ausencia
 * de dato. Solo una consulta exitosa con `count === 0` permite afirmar que el
 * trabajador no tiene tarjetón.
 */

export type DataPresence = "present" | "absent" | "unknown"

export interface DashboardProfileRow {
  full_name?: string | null
  matricula?: string | null
  categoria?: string | null
  antiguedad?: string | null
}

export interface DashboardProfileState {
  presence: DataPresence
  fullName: string | null
  matricula: string | null
  /** true = confirmado, false = confirmado ausente, null = no se pudo confirmar */
  hasCategoria: boolean | null
  /** true = confirmado, false = confirmado ausente, null = no se pudo confirmar */
  hasAntiguedad: boolean | null
}

export function resolveDashboardProfile(result: {
  data: DashboardProfileRow | null
  error: unknown
}): DashboardProfileState {
  if (result.error) {
    return {
      presence: "unknown",
      fullName: null,
      matricula: null,
      hasCategoria: null,
      hasAntiguedad: null,
    }
  }

  if (!result.data) {
    return {
      presence: "absent",
      fullName: null,
      matricula: null,
      hasCategoria: false,
      hasAntiguedad: false,
    }
  }

  const data = result.data
  return {
    presence: "present",
    fullName: typeof data.full_name === "string" ? data.full_name : null,
    matricula:
      typeof data.matricula === "string" && data.matricula.trim() ? data.matricula : null,
    hasCategoria: Boolean(data.categoria),
    hasAntiguedad: Boolean(data.antiguedad),
  }
}

export interface DashboardPayslipQueryResult {
  count: number | null
  error: unknown
}

export function resolvePayslipPresence(result: DashboardPayslipQueryResult): DataPresence {
  if (result.error) return "unknown"
  if (typeof result.count === "number") return result.count > 0 ? "present" : "absent"
  return "unknown"
}

export interface SupabaseErrorLogFields {
  code: string | null
  message: string | null
}

export function describeSupabaseError(error: unknown): SupabaseErrorLogFields {
  if (!error || typeof error !== "object") return { code: null, message: null }
  const candidate = error as { code?: unknown; message?: unknown }
  return {
    code: typeof candidate.code === "string" && candidate.code ? candidate.code : null,
    message:
      typeof candidate.message === "string" && candidate.message ? candidate.message : null,
  }
}
