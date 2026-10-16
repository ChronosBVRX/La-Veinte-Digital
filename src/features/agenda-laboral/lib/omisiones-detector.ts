/**
 * Motor de detección de omisiones de entrada y salida para el IMSS.
 * La Veinte Digital
 *
 * Características:
 * - Soporte para turnos con cruce de medianoche (Nocturno 20:30 a 08:15, Domingo JA a Lunes).
 * - Jornada Acumulada (Sábado y Domingo, lunes a viernes como días de descanso contractual).
 * - Variaciones de turnos matutinos (07:00 a 15:00, 08:00 a 16:00, 6.5h 07:00 a 13:30) y vespertinos (14:00 a 21:30, 14:00 a 22:00).
 * - Detección y emparejamiento de TxT (coberturas a compañeros) y Tiempos Extra (dobletes, jornadas prolongadas sin falsas omisiones).
 * - Auto-detección inteligente del turno más probable analizando los patrones de checada.
 */

import type { WorkerCommitment } from "../types"

export type ShiftCategory =
  | "matutino_7"
  | "matutino_8"
  | "matutino_6_5"
  | "vespertino_21_30"
  | "vespertino_22"
  | "nocturno"
  | "jornada_acumulada_diurna"
  | "jornada_acumulada_nocturna"
  | "personalizado"

export interface ShiftPatternDefinition {
  id: ShiftCategory
  label: string
  expectedEntry: string // "HH:mm"
  expectedExit: string // "HH:mm"
  entryWindow: { start: string; end: string }
  exitWindow: { start: string; end: string }
  crossesMidnight: boolean
  scheduledDays: number[] // 0=Domingo, 1=Lunes, ..., 6=Sábado
}

export const CATALOGO_TURNOS_IMSS: Record<ShiftCategory, ShiftPatternDefinition> = {
  matutino_7: {
    id: "matutino_7",
    label: "Matutino Hospitalario (07:00 - 15:00)",
    expectedEntry: "07:00",
    expectedExit: "15:00",
    entryWindow: { start: "06:15", end: "08:00" },
    exitWindow: { start: "14:45", end: "17:00" },
    crossesMidnight: false,
    scheduledDays: [1, 2, 3, 4, 5],
  },
  matutino_8: {
    id: "matutino_8",
    label: "Matutino Administrativo (08:00 - 16:00)",
    expectedEntry: "08:00",
    expectedExit: "16:00",
    entryWindow: { start: "07:15", end: "09:00" },
    exitWindow: { start: "15:45", end: "18:00" },
    crossesMidnight: false,
    scheduledDays: [1, 2, 3, 4, 5],
  },
  matutino_6_5: {
    id: "matutino_6_5",
    label: "Matutino Reducido 6.5h (07:00 - 13:30)",
    expectedEntry: "07:00",
    expectedExit: "13:30",
    entryWindow: { start: "06:15", end: "08:00" },
    exitWindow: { start: "13:15", end: "15:00" },
    crossesMidnight: false,
    scheduledDays: [1, 2, 3, 4, 5],
  },
  vespertino_21_30: {
    id: "vespertino_21_30",
    label: "Vespertino Estándar (14:00 - 21:30)",
    expectedEntry: "14:00",
    expectedExit: "21:30",
    entryWindow: { start: "13:15", end: "15:00" },
    exitWindow: { start: "21:15", end: "23:00" },
    crossesMidnight: false,
    scheduledDays: [1, 2, 3, 4, 5],
  },
  vespertino_22: {
    id: "vespertino_22",
    label: "Vespertino 8h (14:00 - 22:00)",
    expectedEntry: "14:00",
    expectedExit: "22:00",
    entryWindow: { start: "13:15", end: "15:00" },
    exitWindow: { start: "21:45", end: "23:45" },
    crossesMidnight: false,
    scheduledDays: [1, 2, 3, 4, 5],
  },
  nocturno: {
    id: "nocturno",
    label: "Nocturno Terciado (20:30 - 08:15)",
    expectedEntry: "20:30",
    expectedExit: "08:15",
    entryWindow: { start: "19:30", end: "22:00" },
    exitWindow: { start: "07:30", end: "10:30" },
    crossesMidnight: true,
    scheduledDays: [0, 1, 2, 3, 4, 5, 6], // Terciado se adapta al rol
  },
  jornada_acumulada_diurna: {
    id: "jornada_acumulada_diurna",
    label: "Jornada Acumulada Diurna (Sábado y Domingo)",
    expectedEntry: "08:00",
    expectedExit: "20:00",
    entryWindow: { start: "07:00", end: "09:00" },
    exitWindow: { start: "19:30", end: "22:00" },
    crossesMidnight: false,
    scheduledDays: [0, 6], // Solo Sábado (6) y Domingo (0)
  },
  jornada_acumulada_nocturna: {
    id: "jornada_acumulada_nocturna",
    label: "Jornada Acumulada Especial (Sáb Diurno + Dom a Lun)",
    expectedEntry: "08:00",
    expectedExit: "08:00",
    entryWindow: { start: "07:00", end: "09:00" },
    exitWindow: { start: "07:30", end: "09:30" },
    crossesMidnight: true, // Domingo cruza al lunes
    scheduledDays: [0, 6], // Solo Sábado (6) y Domingo (0)
  },
  personalizado: {
    id: "personalizado",
    label: "Horario Personalizado",
    expectedEntry: "07:00",
    expectedExit: "15:00",
    entryWindow: { start: "06:00", end: "08:30" },
    exitWindow: { start: "14:30", end: "17:00" },
    crossesMidnight: false,
    scheduledDays: [1, 2, 3, 4, 5],
  },
}

export interface RawPunch {
  date: string // "YYYY-MM-DD"
  time: string // "HH:mm"
  originalTimestamp?: number | string
}

export type ShiftBlockStatus =
  | "completo"
  | "omision_entrada"
  | "omision_salida"
  | "ausencia"
  | "descanso"

export interface MatchedShiftBlock {
  shiftDate: string // Fecha contable del turno
  shiftType: ShiftCategory | "extraordinario" | "txt_cobertura" | "tiempo_extra"
  entryPunch?: RawPunch
  exitPunch?: RawPunch
  status: ShiftBlockStatus
  durationMinutes?: number
  isExtendedExit?: boolean
  overtimeEstimatedMinutes?: number
  isCoveringColleague?: boolean
  linkedCommitmentId?: string
  observations: string[]
}

export interface AttendanceAuditSummary {
  totalShiftsScheduled: number
  completeShifts: number
  omisionesEntrada: number
  omisionesSalida: number
  ausencias: number
  turnosExtraordinarios: number
  detectedShift: ShiftCategory
  blocks: MatchedShiftBlock[]
}

/** Convierte "HH:mm" a minutos desde medianoche (0..1439). */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const parts = timeStr.trim().split(":")
  const h = Number(parts[0]) || 0
  const m = Number(parts[1]) || 0
  return h * 60 + m
}

/** Convierte minutos a "HH:mm". */
export function minutesToTime(mins: number): string {
  const norm = ((mins % 1440) + 1440) % 1440
  const h = Math.floor(norm / 60)
  const m = norm % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Verifica si una hora cae dentro de una ventana de tiempo "HH:mm". */
export function isTimeInWindow(time: string, windowStart: string, windowEnd: string): boolean {
  const t = timeToMinutes(time)
  const start = timeToMinutes(windowStart)
  const end = timeToMinutes(windowEnd)

  if (start <= end) {
    return t >= start && t <= end
  }
  // Ventana que cruza medianoche (ej. 22:00 a 02:00)
  return t >= start || t <= end
}

/** Suma días en formato YYYY-MM-DD */
export function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/** Obtiene el día de la semana (0=Dom, 1=Lun, ..., 6=Sáb) para una fecha YYYY-MM-DD */
export function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * Auto-detecta el patrón de turno más probable a partir de un conjunto de checadas en crudo.
 */
export function detectShiftPattern(punches: RawPunch[]): ShiftCategory {
  if (!punches || punches.length === 0) return "matutino_7"

  // 1. Evaluar si es Jornada Acumulada (JA): la gran mayoría de las checadas son fin de semana
  const weekendPunches = punches.filter((p) => {
    const dow = getDayOfWeek(p.date)
    return dow === 0 || dow === 6
  })

  if (weekendPunches.length >= Math.max(2, Math.floor(punches.length * 0.65))) {
    // Si tiene checada el lunes por la mañana (salida de guardia de domingo), es JA nocturna
    const hasMondayMorningExit = punches.some((p) => {
      const dow = getDayOfWeek(p.date)
      const mins = timeToMinutes(p.time)
      return dow === 1 && mins <= 10 * 60
    })
    return hasMondayMorningExit ? "jornada_acumulada_nocturna" : "jornada_acumulada_diurna"
  }

  // 2. Evaluar turno nocturno: debe tener checadas de noche (19:30 - 22:00) Y checadas de mañana siguiente (07:00 - 10:00)
  const nightEntries = punches.filter((p) => {
    const mins = timeToMinutes(p.time)
    return mins >= 19 * 60 + 30 && mins <= 22 * 60
  })
  const morningExits = punches.filter((p) => {
    const mins = timeToMinutes(p.time)
    return mins >= 7 * 60 && mins <= 10 * 60
  })

  // Para ser nocturno, debe tener tanto entradas de noche como salidas por la mañana
  if (nightEntries.length >= 1 && morningExits.length >= 1 && nightEntries.length + morningExits.length >= punches.length * 0.4) {
    return "nocturno"
  }

  // 3. Evaluar horario vespertino (entradas entre 13:15 y 15:15)
  const afternoonEntries = punches.filter((p) => {
    const mins = timeToMinutes(p.time)
    return mins >= 13 * 60 + 15 && mins <= 15 * 60 + 15
  })

  if (afternoonEntries.length >= 1 && afternoonEntries.length >= punches.length * 0.25) {
    // Si la salida promedio es pasadas las 21:45
    const lateExits = punches.filter((p) => timeToMinutes(p.time) >= 21 * 60 + 45).length
    return lateExits >= afternoonEntries.length * 0.5 ? "vespertino_22" : "vespertino_21_30"
  }

  // 4. Evaluar si es Matutino 07:00 vs 08:00 vs 6.5h
  const morningPunches = punches.filter((p) => {
    const mins = timeToMinutes(p.time)
    return mins >= 6 * 60 && mins <= 9 * 60
  })

  if (morningPunches.length > 0) {
    const avgMinutes =
      morningPunches.reduce((acc, p) => acc + timeToMinutes(p.time), 0) / morningPunches.length
    if (avgMinutes >= 7 * 60 + 40) {
      return "matutino_8"
    }

    // Verificar si las salidas ocurren cerca de las 13:30 (6.5 horas)
    const exits6_5 = punches.filter((p) => {
      const mins = timeToMinutes(p.time)
      return mins >= 13 * 60 && mins <= 14 * 60
    }).length
    if (exits6_5 > 2 && exits6_5 >= morningPunches.length * 0.4) {
      return "matutino_6_5"
    }

    return "matutino_7"
  }

  return "matutino_7"
}

export interface AuditAttendanceParams {
  punches: RawPunch[]
  pattern?: ShiftCategory | ShiftPatternDefinition
  commitments?: WorkerCommitment[]
  startDate?: string
  endDate?: string
}

/**
 * Motor central de auditoría de checadas para detectar omisiones de entrada y salida.
 * Soporta turnos nocturnos, jornada acumulada, matutinos, vespertinos, TxT y tiempos extra.
 */
export function auditAttendancePunches(params: AuditAttendanceParams): AttendanceAuditSummary {
  const { punches = [], commitments = [], startDate, endDate } = params

  // 1. Determinar el patrón de turno base
  let patternDef: ShiftPatternDefinition
  let detectedShift: ShiftCategory

  if (typeof params.pattern === "string") {
    detectedShift = params.pattern
    patternDef = CATALOGO_TURNOS_IMSS[params.pattern] || CATALOGO_TURNOS_IMSS.matutino_7
  } else if (params.pattern && typeof params.pattern === "object") {
    patternDef = params.pattern
    detectedShift = patternDef.id
  } else {
    detectedShift = detectShiftPattern(punches)
    patternDef = CATALOGO_TURNOS_IMSS[detectedShift]
  }

  // 2. Normalizar y ordenar cronológicamente las checadas
  const sortedPunches = [...punches]
    .filter((p) => p.date && p.time)
    .sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date)
      if (cmpDate !== 0) return cmpDate
      return a.time.localeCompare(b.time)
    })

  // Agrupar checadas por fecha calendario
  const punchesByDate = new Map<string, RawPunch[]>()
  for (const p of sortedPunches) {
    if (!punchesByDate.has(p.date)) {
      punchesByDate.set(p.date, [])
    }
    punchesByDate.get(p.date)!.push(p)
  }

  // Determinar rango de fechas a auditar
  let minDate = startDate
  let maxDate = endDate

  if (!minDate || !maxDate) {
    const dates = sortedPunches.map((p) => p.date).sort()
    if (!minDate) minDate = dates[0] || new Date().toISOString().slice(0, 10)
    if (!maxDate) maxDate = dates[dates.length - 1] || minDate
  }

  // Generar lista de fechas del periodo
  const dateList: string[] = []
  let curr = minDate
  while (curr <= maxDate) {
    dateList.push(curr)
    curr = addDaysToDate(curr, 1)
  }

  // Set de checadas consumidas para evitar doble emparejamiento
  const consumedPunches = new Set<string>()
  const punchKey = (p: RawPunch) => `${p.date}_${p.time}`

  const blocks: MatchedShiftBlock[] = []

  // 3. Evaluar cada día calendario
  for (const date of dateList) {
    const dow = getDayOfWeek(date)
    const isScheduledDay = patternDef.scheduledDays.includes(dow)
    const dayPunches = (punchesByDate.get(date) || []).filter((p) => !consumedPunches.has(punchKey(p)))

    // Compromisos en agenda para esta fecha
    const dayCommitments = commitments.filter((c) => {
      const cDate = c.startAt ? c.startAt.slice(0, 10) : ""
      return cDate === date
    })
    const hasTxtCommitment = dayCommitments.some((c) => c.type === "txt_substitution")
    const hasOtCommitment = dayCommitments.some((c) => c.type === "overtime")

    // ── CASO A: TURNO CON CRUCE DE MEDIANOCHE (Nocturno o Domingo JA) ──
    if (patternDef.crossesMidnight) {
      if (!isScheduledDay && dayPunches.length === 0) {
        // Día no programado sin checadas
        continue
      }

      // Si es un día programado (ej. noche de turno, o domingo en JA)
      const nextDate = addDaysToDate(date, 1)
      const nextDayPunches = (punchesByDate.get(nextDate) || []).filter(
        (p) => !consumedPunches.has(punchKey(p)),
      )

      // Buscar entrada en la ventana de entrada de la fecha de inicio
      const entryPunch = dayPunches.find((p) =>
        isTimeInWindow(p.time, patternDef.entryWindow.start, patternDef.entryWindow.end),
      )

      // Buscar salida en la ventana de salida del DÍA SIGUIENTE
      const exitPunch = nextDayPunches.find((p) =>
        isTimeInWindow(p.time, patternDef.exitWindow.start, patternDef.exitWindow.end),
      )

      if (entryPunch) consumedPunches.add(punchKey(entryPunch))
      if (exitPunch) consumedPunches.add(punchKey(exitPunch))

      if (entryPunch && exitPunch) {
        const duration =
          timeToMinutes(exitPunch.time) + 1440 - timeToMinutes(entryPunch.time)
        blocks.push({
          shiftDate: date,
          shiftType: patternDef.id,
          entryPunch,
          exitPunch,
          status: "completo",
          durationMinutes: duration,
          observations: [`Jornada nocturna completa (${entryPunch.time} a ${exitPunch.time} +1d)`],
        })
      } else if (entryPunch && !exitPunch) {
        blocks.push({
          shiftDate: date,
          shiftType: patternDef.id,
          entryPunch,
          status: "omision_salida",
          observations: [`Entrada registrada a las ${entryPunch.time}, sin salida registrada al día siguiente`],
        })
      } else if (!entryPunch && exitPunch) {
        blocks.push({
          shiftDate: date,
          shiftType: patternDef.id,
          exitPunch,
          status: "omision_entrada",
          observations: [`Salida registrada a las ${exitPunch.time} al día siguiente, sin entrada registrada previa`],
        })
      } else if (isScheduledDay) {
        // No hubo entrada ni salida en un día programado
        blocks.push({
          shiftDate: date,
          shiftType: patternDef.id,
          status: "ausencia",
          observations: ["Sin registros biométricos en jornada programada"],
        })
      }

      continue
    }

    // ── CASO B: JORNADA ACUMULADA DIURNA O DIAS NO PROGRAMADOS (L-V en JA) ──
    if (!isScheduledDay) {
      if (dayPunches.length === 0) {
        // Día de descanso respetado: no generar falsas alertas
        continue
      }

      // Si checó en día de descanso, es un TxT o Tiempo Extra
      // Emparejar en bloques pares o individuales
      let i = 0
      while (i < dayPunches.length) {
        const p1 = dayPunches[i]
        const p2 = dayPunches[i + 1]
        consumedPunches.add(punchKey(p1))

        if (p2) {
          consumedPunches.add(punchKey(p2))
          const dur = timeToMinutes(p2.time) - timeToMinutes(p1.time)
          blocks.push({
            shiftDate: date,
            shiftType: hasTxtCommitment ? "txt_cobertura" : "extraordinario",
            entryPunch: p1,
            exitPunch: p2,
            status: "completo",
            durationMinutes: dur > 0 ? dur : dur + 1440,
            isCoveringColleague: hasTxtCommitment,
            observations: [
              hasTxtCommitment
                ? `Cobertura TxT completada en día de descanso (${p1.time} - ${p2.time})`
                : `Jornada extraordinaria completada en día de descanso (${p1.time} - ${p2.time})`,
            ],
          })
          i += 2
        } else {
          // Solo 1 checada en día de descanso
          const isMorningTime = timeToMinutes(p1.time) < 14 * 60
          blocks.push({
            shiftDate: date,
            shiftType: hasTxtCommitment ? "txt_cobertura" : "extraordinario",
            entryPunch: isMorningTime ? p1 : undefined,
            exitPunch: isMorningTime ? undefined : p1,
            status: isMorningTime ? "omision_salida" : "omision_entrada",
            isCoveringColleague: hasTxtCommitment,
            observations: [
              isMorningTime
                ? `Entrada en día de descanso a las ${p1.time} sin marcaje de salida`
                : `Salida en día de descanso a las ${p1.time} sin marcaje de entrada`,
            ],
          })
          i += 1
        }
      }
      continue
    }

    // ── CASO C: JORNADA REGULAR (Matutino, Vespertino, Sábado JA diurno) ──
    if (dayPunches.length === 0) {
      blocks.push({
        shiftDate: date,
        shiftType: patternDef.id,
        status: "ausencia",
        observations: ["Sin registros de asistencia en día programado"],
      })
      continue
    }

    // Si tiene 4 o más checadas en el mismo día (doblar turno / TxT + turno ordinario)
    if (dayPunches.length >= 4) {
      // Bloque 1: p0 y p1
      const p0 = dayPunches[0]
      const p1 = dayPunches[1]
      consumedPunches.add(punchKey(p0))
      consumedPunches.add(punchKey(p1))

      blocks.push({
        shiftDate: date,
        shiftType: patternDef.id,
        entryPunch: p0,
        exitPunch: p1,
        status: "completo",
        durationMinutes: timeToMinutes(p1.time) - timeToMinutes(p0.time),
        observations: [`Turno ordinario cubierto (${p0.time} a ${p1.time})`],
      })

      // Bloque 2: p2 y p3 (Segundo turno por cobertura o TE)
      const p2 = dayPunches[2]
      const p3 = dayPunches[3]
      consumedPunches.add(punchKey(p2))
      consumedPunches.add(punchKey(p3))

      const dur2 = timeToMinutes(p3.time) - timeToMinutes(p2.time)
      blocks.push({
        shiftDate: date,
        shiftType: hasTxtCommitment ? "txt_cobertura" : "tiempo_extra",
        entryPunch: p2,
        exitPunch: p3,
        status: "completo",
        durationMinutes: dur2 > 0 ? dur2 : dur2 + 1440,
        isCoveringColleague: hasTxtCommitment,
        overtimeEstimatedMinutes: hasOtCommitment || !hasTxtCommitment ? dur2 : undefined,
        observations: [
          hasTxtCommitment
            ? `Segundo turno cubierto por TxT (${p2.time} a ${p3.time})`
            : `Doblete de turno por tiempo extra (${p2.time} a ${p3.time})`,
        ],
      })
      continue
    }

    // Si tiene 2 checadas
    if (dayPunches.length === 2) {
      const pEntry = dayPunches[0]
      const pExit = dayPunches[1]
      consumedPunches.add(punchKey(pEntry))
      consumedPunches.add(punchKey(pExit))

      const entryMin = timeToMinutes(pEntry.time)
      const exitMin = timeToMinutes(pExit.time)
      const dur = exitMin - entryMin
      const expectedExitMin = timeToMinutes(patternDef.expectedExit)

      // Verificar si es una jornada prolongada con tiempo extra continuo
      const isExtended = exitMin >= expectedExitMin + 60
      const extraMinutes = isExtended ? exitMin - expectedExitMin : 0

      blocks.push({
        shiftDate: date,
        shiftType: patternDef.id,
        entryPunch: pEntry,
        exitPunch: pExit,
        status: "completo",
        durationMinutes: dur,
        isExtendedExit: isExtended,
        overtimeEstimatedMinutes: isExtended ? extraMinutes : undefined,
        observations: isExtended
          ? [
              `Jornada ordinaria completa con salida prolongada (+${Math.round(extraMinutes / 60)}h TE)`,
            ]
          : [`Jornada completa (${pEntry.time} a ${pExit.time})`],
      })
      continue
    }

    // Si tiene exactamente 1 checada (omisión real de entrada o salida)
    if (dayPunches.length === 1) {
      const single = dayPunches[0]
      consumedPunches.add(punchKey(single))
      const singleMin = timeToMinutes(single.time)
      const expectedEntryMin = timeToMinutes(patternDef.expectedEntry)
      const expectedExitMin = timeToMinutes(patternDef.expectedExit)

      // Si está más cerca de la hora de entrada que de la salida
      const distToEntry = Math.abs(singleMin - expectedEntryMin)
      const distToExit = Math.abs(singleMin - expectedExitMin)

      if (distToEntry <= distToExit) {
        // Es un marcaje de entrada, faltó checar la salida
        blocks.push({
          shiftDate: date,
          shiftType: patternDef.id,
          entryPunch: single,
          status: "omision_salida",
          observations: [`Entrada registrada a las ${single.time}, omisión de checada de salida`],
        })
      } else {
        // Es un marcaje de salida, faltó checar la entrada
        blocks.push({
          shiftDate: date,
          shiftType: patternDef.id,
          exitPunch: single,
          status: "omision_entrada",
          observations: [`Salida registrada a las ${single.time}, omisión de checada de entrada`],
        })
      }
      continue
    }

    // Si tiene 3 checadas (ej. entrada, salida ordinaria, entrada TE pero faltó salida TE)
    if (dayPunches.length === 3) {
      const p0 = dayPunches[0]
      const p1 = dayPunches[1]
      const p2 = dayPunches[2]
      consumedPunches.add(punchKey(p0))
      consumedPunches.add(punchKey(p1))
      consumedPunches.add(punchKey(p2))

      // Bloque 1 ordinario completo
      blocks.push({
        shiftDate: date,
        shiftType: patternDef.id,
        entryPunch: p0,
        exitPunch: p1,
        status: "completo",
        durationMinutes: timeToMinutes(p1.time) - timeToMinutes(p0.time),
        observations: [`Turno ordinario cubierto (${p0.time} a ${p1.time})`],
      })

      // Bloque 2 con omisión de salida
      blocks.push({
        shiftDate: date,
        shiftType: hasTxtCommitment ? "txt_cobertura" : "tiempo_extra",
        entryPunch: p2,
        status: "omision_salida",
        isCoveringColleague: hasTxtCommitment,
        observations: [`Entrada a segundo turno a las ${p2.time}, omisión de marcaje de salida`],
      })
      continue
    }
  }

  // 4. Calcular métricas resumidas
  const completeShifts = blocks.filter((b) => b.status === "completo").length
  const omisionesEntrada = blocks.filter((b) => b.status === "omision_entrada").length
  const omisionesSalida = blocks.filter((b) => b.status === "omision_salida").length
  const ausencias = blocks.filter((b) => b.status === "ausencia").length
  const turnosExtraordinarios = blocks.filter(
    (b) => b.shiftType === "extraordinario" || b.shiftType === "txt_cobertura" || b.shiftType === "tiempo_extra",
  ).length
  const totalShiftsScheduled = blocks.filter((b) => b.status !== "descanso").length

  return {
    totalShiftsScheduled,
    completeShifts,
    omisionesEntrada,
    omisionesSalida,
    ausencias,
    turnosExtraordinarios,
    detectedShift,
    blocks,
  }
}

/**
 * Convierte registros crudos del portal (BiometricRecord o filas con columnas heterogéneas)
 * a `RawPunch[]` normalizado para el motor de auditoría.
 */
export function convertBiometricRecordsToPunches(
  records: Array<{ fields?: Record<string, unknown> } | Record<string, unknown>>,
): RawPunch[] {
  const punches: RawPunch[] = []

  for (const item of records) {
    const fields = (item && "fields" in item && item.fields ? item.fields : item) as Record<string, unknown>
    if (!fields || typeof fields !== "object") continue

    let rawDate = ""
    let rawTime = ""

    for (const [k, v] of Object.entries(fields)) {
      const val = String(v || "").trim()
      const keyLower = k.toLowerCase()

      if (
        !rawDate &&
        (keyLower.includes("fecha") ||
          keyLower.includes("date") ||
          /\b\d{4}-\d{2}-\d{2}\b/.test(val) ||
          /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(val))
      ) {
        rawDate = val
      }
      if (
        !rawTime &&
        (keyLower.includes("hora") ||
          keyLower.includes("time") ||
          /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(val))
      ) {
        rawTime = val
      }
    }

    if (!rawDate && !rawTime) continue

    // Normalizar fecha a YYYY-MM-DD
    let normalizedDate = ""
    if (/\b\d{4}-\d{2}-\d{2}\b/.test(rawDate)) {
      normalizedDate = rawDate.match(/\b\d{4}-\d{2}-\d{2}\b/)![0]
    } else if (/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.test(rawDate)) {
      const m = rawDate.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)!
      const day = m[1].padStart(2, "0")
      const month = m[2].padStart(2, "0")
      const year = m[3]
      normalizedDate = `${year}-${month}-${day}`
    }

    // Normalizar hora a HH:mm
    let normalizedTime = ""
    if (/\b(\d{1,2}):(\d{2})\b/.test(rawTime)) {
      const m = rawTime.match(/\b(\d{1,2}):(\d{2})\b/)!
      normalizedTime = `${m[1].padStart(2, "0")}:${m[2]}`
    }

    if (normalizedDate && normalizedTime) {
      punches.push({ date: normalizedDate, time: normalizedTime })
    }
  }

  return punches
}

