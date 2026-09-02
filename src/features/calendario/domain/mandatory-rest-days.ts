/**
 * Días de Descanso Obligatorio contractuales del IMSS
 * Fuente: Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027
 * Cláusula 46 Fracción III (Descansos obligatorios)
 * Cláusula 45 (Roles de guardias)
 * Cláusula 33 (Pago de guardias)
 */

export interface ImssMandatoryRestDay {
  id: string
  date: string // Fecha civil local en formato ISO "YYYY-MM-DD" (sin desplazamientos UTC)
  year: number
  month: number // 0-indexed (0 = Enero, ..., 11 = Diciembre)
  day: number // 1-31
  title: string
  description: string
  type: "imss_mandatory_rest"
  source: "CCT_IMSS_SNTSS_2025_2027"
  clause: "46-III"
  guardEligible: true
  assignedGuard: boolean // Siempre false por defecto; el usuario confirma si le fue asignada guardia
  contractual: true
  legalBasis: string
  electoralJurisdiction?: string
}

export interface ElectoralHolidayEntry {
  date: string // "YYYY-MM-DD"
  jurisdiction: string
  title: string
  description?: string
}

export interface ImssRestDaysOptions {
  /** Fechas electorales oficiales aprobadas por jurisdicción */
  electoralDates?: ElectoralHolidayEntry[]
  /** Si se debe filtrar por jurisdicción electoral del usuario */
  jurisdiction?: string
}

/**
 * Catálogo versionado de jornadas electorales ordinarias oficiales.
 * Solo deben incluirse cuando existe decreto/publicación oficial verificable.
 */
export const VERSIONED_ELECTORAL_HOLIDAYS: Record<number, ElectoralHolidayEntry[]> = {
  // 2024 tuvo elección federal el 2 de junio de 2024
  2024: [
    {
      date: "2024-06-02",
      jurisdiction: "federal",
      title: "Jornada Electoral Federal Ordinaria",
      description: "Día establecido por la legislación electoral federal para elecciones ordinarias (Cláusula 46 Fracción III).",
    },
  ],
  // 2026: Sin elección federal ordinaria predeterminada.
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/**
 * Calcula el Domingo de Resurrección (Pascua) para cualquier año en el calendario gregoriano
 * utilizando el algoritmo de Computus (Meeus / Jones / Butcher).
 * Retorna { month: 0-indexed (2=Marzo, 3=Abril), day: number }.
 */
export function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const L = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * L) / 451)
  const monthNumber = Math.floor((h + L - 7 * m + 114) / 31) // 3 = Marzo, 4 = Abril
  const day = ((h + L - 7 * m + 114) % 31) + 1

  return { month: monthNumber - 1, day }
}

/**
 * Obtiene el día del mes correspondiente al N-ésimo día de la semana (0=Dom, 1=Lun, ..., 6=Sáb).
 * @param year Año
 * @param monthIndex Mes 0-indexed
 * @param targetDayOfWeek 0=Dom, 1=Lun, etc.
 * @param nth Ocurrencia (1 para 1er, 3 para 3er, etc.)
 */
export function getNthDayOfWeek(year: number, monthIndex: number, targetDayOfWeek: number, nth: number): number {
  // Primer día del mes
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const firstOccurrenceDay = 1 + ((targetDayOfWeek - firstDay + 7) % 7)
  const targetDay = firstOccurrenceDay + (nth - 1) * 7
  return targetDay
}

/**
 * Suma o resta días a una fecha civil dada en un año y mes específico.
 */
function offsetDate(year: number, monthIndex: number, day: number, offsetDays: number): { year: number; month: number; day: number; dateStr: string } {
  const d = new Date(year, monthIndex, day + offsetDays)
  const y = d.getFullYear()
  const m = d.getMonth()
  const dayOfMonth = d.getDate()
  return {
    year: y,
    month: m,
    day: dayOfMonth,
    dateStr: `${y}-${pad(m + 1)}-${pad(dayOfMonth)}`,
  }
}

/**
 * Genera todos los días de descanso obligatorio contractuales para un año específico
 * conforme a la Cláusula 46 Fracción III del CCT IMSS-SNTSS 2025-2027.
 */
export function getImssMandatoryRestDays(year: number, options?: ImssRestDaysOptions): ImssMandatoryRestDay[] {
  const list: ImssMandatoryRestDay[] = []

  const legalBasis = "Cláusula 46 Fracción III del CCT IMSS-SNTSS 2025-2027"

  // 1. 1 de enero (Año Nuevo)
  list.push({
    id: `cct-46-iii-${year}-01-01`,
    date: `${year}-01-01`,
    year,
    month: 0,
    day: 1,
    title: "Año Nuevo",
    description: "Descanso obligatorio contractual de Año Nuevo.",
    type: "imss_mandatory_rest",
    source: "CCT_IMSS_SNTSS_2025_2027",
    clause: "46-III",
    guardEligible: true,
    assignedGuard: false,
    contractual: true,
    legalBasis,
  })

  // 2. Primer lunes de febrero (en conmemoración del 5 de febrero)
  const febMonday = getNthDayOfWeek(year, 1, 1, 1)
  list.push({
    id: `cct-46-iii-${year}-02-lunes1`,
    date: `${year}-02-${pad(febMonday)}`,
    year,
    month: 1,
    day: febMonday,
    title: "Conmemoración de la Constitución (5 de Febrero)",
    description: "Primer lunes de febrero, en conmemoración del 5 de febrero.",
    type: "imss_mandatory_rest",
    source: "CCT_IMSS_SNTSS_2025_2027",
    clause: "46-III",
    guardEligible: true,
    assignedGuard: false,
    contractual: true,
    legalBasis,
  })

  // 3. Tercer lunes de marzo (en conmemoración del 21 de marzo)
  const marMonday = getNthDayOfWeek(year, 2, 1, 3)
  list.push({
    id: `cct-46-iii-${year}-03-lunes3`,
    date: `${year}-03-${pad(marMonday)}`,
    year,
    month: 2,
    day: marMonday,
    title: "Natalicio de Benito Juárez (21 de Marzo)",
    description: "Tercer lunes de marzo, en conmemoración del 21 de marzo.",
    type: "imss_mandatory_rest",
    source: "CCT_IMSS_SNTSS_2025_2027",
    clause: "46-III",
    guardEligible: true,
    assignedGuard: false,
    contractual: true,
    legalBasis,
  })

  // 4, 5, 6. Jueves, Viernes y Sábado Santo (Semana Mayor)
  const easter = getEasterSunday(year)
  const juevesSanto = offsetDate(year, easter.month, easter.day, -3)
  const viernesSanto = offsetDate(year, easter.month, easter.day, -2)
  const sabadoSanto = offsetDate(year, easter.month, easter.day, -1)

  list.push({
    id: `cct-46-iii-${year}-jueves-santo`,
    date: juevesSanto.dateStr,
    year: juevesSanto.year,
    month: juevesSanto.month,
    day: juevesSanto.day,
    title: "Jueves Santo",
    description: "Jueves de la Semana Mayor.",
    type: "imss_mandatory_rest",
    source: "CCT_IMSS_SNTSS_2025_2027",
    clause: "46-III",
    guardEligible: true,
    assignedGuard: false,
    contractual: true,
    legalBasis,
  })

  list.push({
    id: `cct-46-iii-${year}-viernes-santo`,
    date: viernesSanto.dateStr,
    year: viernesSanto.year,
    month: viernesSanto.month,
    day: viernesSanto.day,
    title: "Viernes Santo",
    description: "Viernes de la Semana Mayor.",
    type: "imss_mandatory_rest",
    source: "CCT_IMSS_SNTSS_2025_2027",
    clause: "46-III",
    guardEligible: true,
    assignedGuard: false,
    contractual: true,
    legalBasis,
  })

  list.push({
    id: `cct-46-iii-${year}-sabado-santo`,
    date: sabadoSanto.dateStr,
    year: sabadoSanto.year,
    month: sabadoSanto.month,
    day: sabadoSanto.day,
    title: "Sábado Santo",
    description: "Sábado de la Semana Mayor.",
    type: "imss_mandatory_rest",
    source: "CCT_IMSS_SNTSS_2025_2027",
    clause: "46-III",
    guardEligible: true,
    assignedGuard: false,
    contractual: true,
    legalBasis,
  })

  // 7. 1 de mayo (Día del Trabajo)
  list.push({
    id: `cct-46-iii-${year}-05-01`,
    date: `${year}-05-01`,
    year,
    month: 4,
    day: 1,
    title: "Día del Trabajo",
    description: "Descanso obligatorio contractual del 1 de mayo.",
    type: "imss_mandatory_rest",
    source: "CCT_IMSS_SNTSS_2025_2027",
    clause: "46-III",
    guardEligible: true,
    assignedGuard: false,
    contractual: true,
    legalBasis,
  })

  // 8. 10 de mayo (Día de las Madres)
  list.push({
    id: `cct-46-iii-${year}-05-10`,
    date: `${year}-05-10`,
    year,
    month: 4,
    day: 10,
    title: "Día de las Madres",
    description: "Descanso obligatorio contractual del 10 de mayo.",
    type: "imss_mandatory_rest",
    source: "CCT_IMSS_SNTSS_2025_2027",
    clause: "46-III",
    guardEligible: true,
    assignedGuard: false,
    contractual: true,
    legalBasis,
  })

  // 9. 15 de septiembre
  list.push({
    id: `cct-46-iii-${year}-09-15`,
    date: `${year}-09-15`,
    year,
    month: 8,
    day: 15,
    title: "Conmemoración del Grito de Independencia",
    description: "Descanso obligatorio contractual del 15 de septiembre.",
    type: "imss_mandatory_rest",
    source: "CCT_IMSS_SNTSS_2025_2027",
    clause: "46-III",
    guardEligible: true,
    assignedGuard: false,
    contractual: true,
    legalBasis,
  })

  // 10. 16 de septiembre (Día de la Independencia Nacional)
  list.push({
    id: `cct-46-iii-${year}-09-16`,
    date: `${year}-09-16`,
    year,
    month: 8,
    day: 16,
    title: "Día de la Independencia Nacional",
    description: "Descanso obligatorio contractual del 16 de septiembre.",
    type: "imss_mandatory_rest",
    source: "CCT_IMSS_SNTSS_2025_2027",
    clause: "46-III",
    guardEligible: true,
    assignedGuard: false,
    contractual: true,
    legalBasis,
  })

  // 11. 1 de octubre cada 6 años (Transmisión del Poder Ejecutivo Federal)
  // Referencia oficial CCT: 2024, 2030, 2036, etc.
  if (year >= 2024 && (year - 2024) % 6 === 0) {
    list.push({
      id: `cct-46-iii-${year}-10-01`,
      date: `${year}-10-01`,
      year,
      month: 9,
      day: 1,
      title: "Transmisión del Poder Ejecutivo Federal",
      description: "1 de octubre cada seis años, cuando corresponda a la transmisión del Poder Ejecutivo Federal.",
      type: "imss_mandatory_rest",
      source: "CCT_IMSS_SNTSS_2025_2027",
      clause: "46-III",
      guardEligible: true,
      assignedGuard: false,
      contractual: true,
      legalBasis,
    })
  }

  // 12. Tercer lunes de noviembre (en conmemoración del 20 de noviembre)
  const novMonday = getNthDayOfWeek(year, 10, 1, 3)
  list.push({
    id: `cct-46-iii-${year}-11-lunes3`,
    date: `${year}-11-${pad(novMonday)}`,
    year,
    month: 10,
    day: novMonday,
    title: "Conmemoración de la Revolución Mexicana (20 de Noviembre)",
    description: "Tercer lunes de noviembre, en conmemoración del 20 de noviembre.",
    type: "imss_mandatory_rest",
    source: "CCT_IMSS_SNTSS_2025_2027",
    clause: "46-III",
    guardEligible: true,
    assignedGuard: false,
    contractual: true,
    legalBasis,
  })

  // 13. 25 de diciembre (Navidad)
  list.push({
    id: `cct-46-iii-${year}-12-25`,
    date: `${year}-12-25`,
    year,
    month: 11,
    day: 25,
    title: "Navidad",
    description: "Descanso obligatorio contractual de Navidad.",
    type: "imss_mandatory_rest",
    source: "CCT_IMSS_SNTSS_2025_2027",
    clause: "46-III",
    guardEligible: true,
    assignedGuard: false,
    contractual: true,
    legalBasis,
  })

  // 14. Jornadas electorales oficiales
  const customElectoral = options?.electoralDates ?? VERSIONED_ELECTORAL_HOLIDAYS[year] ?? []
  for (const item of customElectoral) {
    if (options?.jurisdiction && item.jurisdiction !== "federal" && item.jurisdiction !== options.jurisdiction) {
      continue
    }
    const [yStr, mStr, dStr] = item.date.split("-")
    const itemYear = Number(yStr)
    const itemMonth = Number(mStr) - 1
    const itemDay = Number(dStr)

    if (itemYear === year) {
      list.push({
        id: `cct-46-iii-${year}-electoral-${item.date}`,
        date: item.date,
        year: itemYear,
        month: itemMonth,
        day: itemDay,
        title: item.title,
        description: item.description ?? "Día que determinen las leyes federales y locales electorales para elecciones ordinarias.",
        type: "imss_mandatory_rest",
        source: "CCT_IMSS_SNTSS_2025_2027",
        clause: "46-III",
        guardEligible: true,
        assignedGuard: false,
        contractual: true,
        legalBasis,
        electoralJurisdiction: item.jurisdiction,
      })
    }
  }

  // Ordenar cronológicamente por fecha
  return list.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Consulta los días de descanso obligatorio para un mes específico.
 */
export function getImssMandatoryRestDaysForMonth(year: number, monthIndex: number, options?: ImssRestDaysOptions): ImssMandatoryRestDay[] {
  return getImssMandatoryRestDays(year, options).filter((d) => d.month === monthIndex)
}

/**
 * Busca si una fecha específica (formato "YYYY-MM-DD") es un día de descanso obligatorio.
 */
export function getMandatoryRestDayByDate(dateStr: string, options?: ImssRestDaysOptions): ImssMandatoryRestDay | undefined {
  const [yStr] = dateStr.split("-")
  const year = Number(yStr)
  if (!year || isNaN(year)) return undefined
  return getImssMandatoryRestDays(year, options).find((d) => d.date === dateStr)
}
