import type { User, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { getWorkerContext, type WorkerContext } from "@/shared/server/worker-context"

/**
 * Representación no sensible del contexto del trabajador para el Asistente IA.
 * NUNCA incluye: RFC, CURP, NSS, cuentas bancarias, sellos ni folios fiscales.
 */
export interface SanitizedWorkerProfile {
  hasProfile: boolean
  nombre?: string | null
  categoria?: string | null
  categoriaCodigo?: string | null
  jornadaHoras?: number | null
  antiguedadAnios?: number | null
  antiguedadTexto?: string | null
  tipoPlaza?: string | null
  turno?: string | null
  adscripcion?: string | null
  exposicionRadiologica?: boolean
  conceptosRecurrentes?: string[]
  vacacionesPorVencer?: string | null
  salarioIntegradoAproximado?: number | null
}

export async function fetchSanitizedWorkerProfile(
  user: User,
  supabase?: SupabaseClient<Database>,
  requestId?: string,
): Promise<SanitizedWorkerProfile> {
  try {
    const ctx = await getWorkerContext(user, supabase, requestId)
    return sanitizeWorkerContext(ctx)
  } catch (err) {
    console.warn("[asistente:worker-profile] Error obteniendo contexto laboral:", err instanceof Error ? err.message : err)
    return { hasProfile: false }
  }
}

export function sanitizeWorkerContext(ctx: WorkerContext): SanitizedWorkerProfile {
  if (!ctx || (!ctx.profile && !ctx.employment && !ctx.payroll)) {
    return { hasProfile: false }
  }

  const nombre = ctx.profile?.fullName?.trim() || null
  const categoria = ctx.employment?.categoryName?.trim() || ctx.profile?.categoria?.trim() || null
  const categoriaCodigo = ctx.employment?.categoryCode?.trim() || null
  const jornadaHoras = ctx.employment?.workdayHours ?? null

  const antiguedadAnios =
    ctx.vacationProfile?.effectiveSeniorityYears ??
    (ctx.profile?.antiguedad ? parseInt(ctx.profile.antiguedad, 10) || null : null)
  const antiguedadTexto = ctx.profile?.antiguedad?.trim() || (antiguedadAnios ? `${antiguedadAnios} años` : null)

  const tipoPlaza = ctx.employment?.employmentType?.trim() || null
  const turno = ctx.employment?.shift?.trim() || null
  const adscripcion = ctx.employment?.adscripcion?.trim() || ctx.profile?.adscripcion?.trim() || null

  const exposicionRadiologica =
    ctx.employment?.radiologicalExposure === true ||
    ctx.vacationProfile?.radiologicalExposure === "true" ||
    (Array.isArray(ctx.payroll?.recurringConcepts) &&
      ctx.payroll.recurringConcepts.some((c: unknown) => {
        if (typeof c === "object" && c !== null && "conceptCode" in c) {
          const code = String((c as { conceptCode: unknown }).conceptCode)
          return code === "063" || code === "058"
        }
        return false
      }))

  const conceptosRecurrentes: string[] = []
  if (Array.isArray(ctx.payroll?.recurringConcepts)) {
    for (const c of ctx.payroll.recurringConcepts) {
      if (typeof c === "object" && c !== null && "conceptCode" in c) {
        const code = String((c as { conceptCode: unknown }).conceptCode).trim()
        if (code && !conceptosRecurrentes.includes(code)) {
          conceptosRecurrentes.push(code)
        }
      }
    }
  }

  const vacacionesPorVencer = ctx.vacations?.porVencer?.trim() || ctx.vacations?.dueDate?.trim() || null
  const salarioIntegradoAproximado = ctx.payroll?.integratedMonthlySalary ?? null

  const hasAnyData = Boolean(
    categoria ||
    jornadaHoras ||
    antiguedadAnios ||
    antiguedadTexto ||
    tipoPlaza ||
    adscripcion,
  )

  return {
    hasProfile: hasAnyData,
    nombre,
    categoria,
    categoriaCodigo,
    jornadaHoras,
    antiguedadAnios,
    antiguedadTexto,
    tipoPlaza,
    turno,
    adscripcion,
    exposicionRadiologica,
    conceptosRecurrentes,
    vacacionesPorVencer,
    salarioIntegradoAproximado,
  }
}

/**
 * Formatea el perfil para el System Prompt del asistente.
 */
export function formatWorkerProfilePrompt(profile: SanitizedWorkerProfile): string {
  if (!profile.hasProfile) return ""

  const lineas: string[] = [
    "--- PERFIL DEL TRABAJADOR CONSULTANTE (Datos verificados en expediente) ---",
  ]
  if (profile.nombre) lineas.push(`- Nombre: ${profile.nombre}`)
  if (profile.categoria) lineas.push(`- Categoría / Puesto: ${profile.categoria}${profile.categoriaCodigo ? ` (Código: ${profile.categoriaCodigo})` : ""}`)
  if (profile.jornadaHoras) lineas.push(`- Jornada de trabajo: ${profile.jornadaHoras} horas diarias`)
  if (profile.antiguedadTexto || profile.antiguedadAnios) lineas.push(`- Antigüedad: ${profile.antiguedadTexto ?? `${profile.antiguedadAnios} años`}`)
  if (profile.tipoPlaza) lineas.push(`- Tipo de contratación: ${profile.tipoPlaza}`)
  if (profile.turno) lineas.push(`- Turno: ${profile.turno}`)
  if (profile.adscripcion) lineas.push(`- Adscripción: ${profile.adscripcion}`)
  if (profile.exposicionRadiologica) lineas.push(`- Exposición a emanaciones radiactivas / infectocontagiosidad: SÍ (Acreditada)`)
  if (profile.conceptosRecurrentes && profile.conceptosRecurrentes.length > 0) {
    lineas.push(`- Conceptos de nómina recurrentes registrados: ${profile.conceptosRecurrentes.join(", ")}`)
  }
  if (profile.vacacionesPorVencer) lineas.push(`- Periodo vacacional próximo / por vencer: ${profile.vacacionesPorVencer}`)

  lineas.push(
    "INSTRUCCIÓN DE PERSONALIZACIÓN: Si la consulta del trabajador atañe a sus propios derechos, percepciones, vacaciones o condiciones, aplícale de inmediato estos datos sin preguntarle su puesto o antigüedad. Si el usuario pregunta expresamente sobre un tercero o un caso general diferente, atiende prioritariamente lo que el usuario especifique.",
  )
  lineas.push("-----------------------------------------------------------------------")

  return lineas.join("\n")
}
