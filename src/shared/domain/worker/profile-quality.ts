/**
 * Calidad del perfil laboral (derivada, nunca persistida).
 *
 * El porcentaje representa completitud y confianza relativa, NO precisión
 * garantizada. En UI se recomienda etiquetar como "alta / media / básica"
 * y mostrar el número solo como indicador de completitud.
 */
import type {
  FieldRequirement,
  ProfileQuality,
  ToolId,
  WorkerFieldName,
  WorkerFieldSource,
  WorkerProfile,
} from "./types"

/**
 * Pesos versionados de calidad por campo. DEBEN sumar 100.
 * v1: pesos iniciales propuestos, no demostrados como óptimos; se pueden
 * recalibrar en futuras versiones sin cambiar el mecanismo.
 */
export const PROFILE_QUALITY_WEIGHTS_V1: Readonly<Record<WorkerFieldName, number>> = {
  categoria: 25,
  effectiveSeniorityDate: 25,
  workdayHours: 15,
  employmentType: 10,
  shift: 10,
  adscripcion: 8,
  matricula: 7,
}

/**
 * Factor de fuente: cómo pesa cada procedencia en la completitud.
 * payslip_confirmed > calculated > manual > inferred.
 */
const SOURCE_FACTORS: Readonly<Record<WorkerFieldSource, number>> = {
  payslip_confirmed: 1,
  calculated: 0.9,
  manual: 0.8,
  inferred: 0.6,
}

/** Verifica que los pesos sumen 100. Útil para pruebas. */
export function validateQualityWeightsSum(
  weights: Readonly<Record<WorkerFieldName, number>> = PROFILE_QUALITY_WEIGHTS_V1,
): boolean {
  const sum = Object.values(weights).reduce((acc, w) => acc + w, 0)
  return Math.abs(sum - 100) < 1e-9
}

/** Fuente de un campo, o null si el campo no está presente/declarado. */
function sourceOf(profile: WorkerProfile, field: WorkerFieldName): WorkerFieldSource | null {
  return profile.sources[field] ?? null
}

/** Campos faltantes: requeridos por al menos una herramienta y sin fuente. */
export function getMissingWorkerFields(
  profile: WorkerProfile,
  requirements: readonly FieldRequirement[],
): WorkerFieldName[] {
  const required = new Set<WorkerFieldName>()
  for (const req of requirements) {
    if (req.tools.some((t) => t.required)) required.add(req.field)
  }
  const missing: WorkerFieldName[] = []
  for (const field of required) {
    if (sourceOf(profile, field) === null) missing.push(field)
  }
  return missing
}

/**
 * Herramientas beneficiadas: todas sus herramientas requeridas están
 * cubiertas por una fuente.
 */
export function getBenefitedTools(
  profile: WorkerProfile,
  requirements: readonly FieldRequirement[],
): ToolId[] {
  const tools = new Map<ToolId, Set<WorkerFieldName>>()
  for (const req of requirements) {
    for (const { tool, required } of req.tools) {
      if (!required) continue
      const set = tools.get(tool) ?? new Set<WorkerFieldName>()
      set.add(req.field)
      tools.set(tool, set)
    }
  }

  const benefited: ToolId[] = []
  for (const [tool, fields] of tools) {
    const allCovered = [...fields].every((f) => sourceOf(profile, f) !== null)
    if (allCovered) benefited.push(tool)
  }
  return benefited
}

/**
 * Calcula la calidad del perfil.
 *
 * Ponderación (documentada):
 * - Cada campo aporta su peso (PROFILE_QUALITY_WEIGHTS_V1) × factor de fuente.
 * - Campo sin fuente aporta 0 y, si es requerido por ≥1 herramienta, aparece
 *   en missingFields.
 * - confidence = promedio ponderado de factores sobre campos presentes.
 */
export function calculateProfileQuality(
  profile: WorkerProfile,
  requirements: readonly FieldRequirement[],
  weights: Readonly<Record<WorkerFieldName, number>> = PROFILE_QUALITY_WEIGHTS_V1,
): ProfileQuality {
  const missingFields = getMissingWorkerFields(profile, requirements)

  let weighted = 0
  let presentSum = 0
  let presentCount = 0
  let confirmedCount = 0
  let manualCount = 0
  let inferredCount = 0

  for (const field of Object.keys(weights) as WorkerFieldName[]) {
    const weight = weights[field] ?? 0
    const source = sourceOf(profile, field)
    if (source === null) continue

    const factor = SOURCE_FACTORS[source] ?? 0
    weighted += weight * factor
    presentSum += factor
    presentCount += 1

    if (source === "payslip_confirmed") confirmedCount += 1
    if (source === "manual") manualCount += 1
    if (source === "inferred") inferredCount += 1
  }

  const percent = Math.round(weighted)
  const confidence = presentCount > 0 ? presentSum / presentCount : 0

  const recommendations: string[] = []
  for (const field of missingFields) {
    const req = requirements.find((r) => r.field === field)
    if (req) recommendations.push(req.impactIfMissing)
  }

  return {
    percent,
    confidence,
    confirmedCount,
    manualCount,
    inferredCount,
    missingFields,
    recommendations,
    benefitedTools: getBenefitedTools(profile, requirements),
  }
}
