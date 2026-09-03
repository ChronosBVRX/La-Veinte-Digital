import type { AnnualVacationCalendar, VacationRole } from "./types"
import { validateCalendarRoleList } from "./calendar-roles"

export interface ParseCalendarImportResult {
  calendar: AnnualVacationCalendar | null
  errors: string[]
  warnings: string[]
}

/**
 * Parsea e importa un calendario vacacional desde formato JSON o CSV.
 * Valida integridad estructural, unicidad de roles y presencia obligatoria de fechas.
 */
export function parseCalendarImport(
  rawContent: string,
  targetYear: number,
  version: string = "v1-borrador"
): ParseCalendarImportResult {
  const errors: string[] = []
  const warnings: string[] = []

  const trimmed = rawContent.trim()
  if (!trimmed) {
    return {
      calendar: null,
      errors: ["El archivo de importación está vacío."],
      warnings: [],
    }
  }

  let parsedRoles: VacationRole[] = []
  let detectedYear = targetYear

  // Intentar parseo como JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        parsedRoles = mapJsonRoles(parsed)
      } else if (typeof parsed === "object" && parsed !== null) {
        if (typeof parsed.year === "number") {
          detectedYear = parsed.year
        }
        if (Array.isArray(parsed.roles)) {
          parsedRoles = mapJsonRoles(parsed.roles)
        } else {
          errors.push("El JSON debe contener un arreglo 'roles'.")
        }
      }
    } catch (e) {
      errors.push(`Error de sintaxis en el archivo JSON: ${e instanceof Error ? e.message : String(e)}`)
    }
  } else {
    // Parseo como CSV
    parsedRoles = parseCsvRoles(trimmed, errors)
  }

  if (errors.length > 0) {
    return { calendar: null, errors, warnings }
  }

  // Salvaguarda: advertir o bloquear si se intenta usar la tabla 2026 para 2027
  if (detectedYear === 2026 && targetYear === 2027) {
    errors.push("No se permite importar el rol de vacaciones 2026 como si fuera el calendario oficial 2027. Las fechas 2027 deben ser emitidas oficialmente.")
    return { calendar: null, errors, warnings }
  }

  // Validar lista de roles
  const validation = validateCalendarRoleList(parsedRoles)
  if (!validation.valid) {
    errors.push(...validation.errors)
  }

  if (validation.missingEndDates > 0) {
    errors.push(`Se encontraron ${validation.missingEndDates} rol(es) sin fecha de término (endDate).`)
  }

  if (errors.length > 0) {
    return { calendar: null, errors, warnings }
  }

  const calendar: AnnualVacationCalendar = {
    id: `cal-${targetYear}-${Date.now()}`,
    year: targetYear,
    version,
    status: "DRAFT",
    sourceName: `Importación ${new Date().toISOString().slice(0, 10)}`,
    sourceDate: new Date().toISOString().slice(0, 10),
    roles: parsedRoles,
  }

  return {
    calendar,
    errors: [],
    warnings,
  }
}

function mapJsonRoles(rawList: unknown[]): VacationRole[] {
  return rawList.map((item, idx) => {
    const obj = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>
    const roleNum = typeof obj.roleNumber === "number" ? obj.roleNumber : (idx + 1)
    const startDate = typeof obj.startDate === "string" ? obj.startDate.trim() : ""
    const endDate = typeof obj.endDate === "string" ? obj.endDate.trim() : undefined
    const roleGroup = obj.roleGroup === "A" || obj.roleGroup === "B" ? obj.roleGroup : "GENERAL"
    const label = typeof obj.label === "string" ? obj.label : `Rol #${roleNum}`
    const enabled = obj.enabled !== false

    return {
      id: typeof obj.id === "string" ? obj.id : `role-${roleNum}-${idx}`,
      roleNumber: roleNum,
      startDate,
      endDate,
      roleGroup,
      label,
      enabled,
    }
  })
}

function parseCsvRoles(csvText: string, errors: string[]): VacationRole[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    errors.push("El archivo CSV debe tener una fila de encabezados y al menos una fila de datos.")
    return []
  }

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""))
  const roleIdx = header.findIndex((h) => h.includes("rol") || h.includes("numero") || h === "id")
  const startIdx = header.findIndex((h) => h.includes("inicio") || h.includes("start") || h.includes("desde"))
  const endIdx = header.findIndex((h) => h.includes("termino") || h.includes("fin") || h.includes("end") || h.includes("hasta"))
  const groupIdx = header.findIndex((h) => h.includes("grupo") || h.includes("group"))

  if (startIdx === -1) {
    errors.push("No se encontró la columna de fecha de inicio ('inicio' o 'start_date') en el CSV.")
    return []
  }

  const roles: VacationRole[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""))
    if (cols.length <= startIdx) continue

    const roleNumber = roleIdx !== -1 && !isNaN(Number(cols[roleIdx])) ? Number(cols[roleIdx]) : i
    const startDate = cols[startIdx] || ""
    const endDate = endIdx !== -1 ? cols[endIdx] || undefined : undefined
    let roleGroup: "A" | "B" | "GENERAL" = "GENERAL"
    if (groupIdx !== -1) {
      const rawG = (cols[groupIdx] || "").toUpperCase()
      if (rawG === "A" || rawG === "B") roleGroup = rawG
    }

    roles.push({
      id: `csv-role-${roleNumber}-${i}`,
      roleNumber,
      startDate,
      endDate,
      roleGroup,
      label: `Rol #${roleNumber}`,
      enabled: true,
    })
  }

  return roles
}
