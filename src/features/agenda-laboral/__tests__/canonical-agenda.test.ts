import { describe, it, expect } from "vitest"
import {
  getLocalDateString,
  formatLocalTime,
  formatHumanCommitmentDate,
  isCommitmentOnLocalDate,
  getCommitmentsForLocalDate,
  getTodayCommitments,
  isCommitmentInProgress,
  getCommitmentDayRelation,
  getNextCommitment,
  getCommitmentDisplayTitle,
  getCommitmentDisplayIcon,
  getCommitmentDetailLines,
  getCommitmentScheduleLabel,
  DEFAULT_AGENDA_TIMEZONE,
} from "../lib/commitment-calendar"
import type { WorkerCommitment } from "../types"

function createCommitment(overrides: Partial<WorkerCommitment> = {}): WorkerCommitment {
  const startAt = overrides.startAt ?? "2026-09-05T16:00:00.000Z"
  const endAt =
    overrides.endAt ??
    new Date(new Date(startAt).getTime() + 4 * 60 * 60 * 1000).toISOString()

  return {
    id: overrides.id ?? "comm-1",
    userId: overrides.userId ?? "user-123",
    type: overrides.type ?? "overtime",
    title: overrides.title ?? "Tiempo extra",
    startAt,
    endAt,
    workplace: overrides.workplace ?? "HGR 1",
    service: overrides.service ?? "Urgencias",
    substituteWorkerName: overrides.substituteWorkerName ?? "",
    notes: overrides.notes ?? "",
    details: overrides.details,
    reminder: overrides.reminder ?? { dayBefore: true, hoursBefore: true, atStart: false },
    status: overrides.status ?? "active",
    createdAt: overrides.createdAt ?? "2026-09-01T12:00:00.000Z",
  }
}

describe("Canonical Agenda: Regresión del Bug Real (2026-09-05)", () => {
  // Bug real:
  // Fecha: 2026-09-05
  // Compromiso: 10:00 a 14:00 (2026-09-05T16:00:00.000Z a 20:00:00.000Z)
  // Hora actual: 18:36 (2026-09-06T00:36:00.000Z en UTC / 2026-09-05T18:36:00 en CDMX)
  const pastMorningCommitment = createCommitment({
    id: "comm-morning",
    title: "Tiempo extra matutino",
    startAt: "2026-09-05T16:00:00.000Z", // 10:00 CDMX
    endAt: "2026-09-05T20:00:00.000Z",   // 14:00 CDMX
    status: "active",
  })

  const eveningCommitment = createCommitment({
    id: "comm-evening",
    title: "Tiempo extra nocturno",
    startAt: "2026-09-06T02:00:00.000Z", // 20:00 CDMX
    endAt: "2026-09-06T04:00:00.000Z",   // 22:00 CDMX
    status: "active",
  })

  // 18:36 en CDMX el 5 de septiembre de 2026
  const nowAt1836 = new Date("2026-09-06T00:36:00.000Z")

  it("sigue perteneciendo a los compromisos del 5 de septiembre", () => {
    const belongsToSept5 = isCommitmentOnLocalDate(pastMorningCommitment, "2026-09-05", DEFAULT_AGENDA_TIMEZONE)
    expect(belongsToSept5).toBe(true)
  })

  it("sigue apareciendo en Agenda si está seleccionado el día 5", () => {
    const commitmentsOnSept5 = getCommitmentsForLocalDate(
      [pastMorningCommitment, eveningCommitment],
      "2026-09-05",
      DEFAULT_AGENDA_TIMEZONE,
    )
    expect(commitmentsOnSept5.map((c) => c.id)).toContain("comm-morning")
    expect(commitmentsOnSept5.length).toBe(2)
  })

  it("NO tiene que considerarse próximo si ya terminó su horario", () => {
    const nextOnlyMorning = getNextCommitment([pastMorningCommitment], nowAt1836)
    // Ya terminó y no hay más eventos: no hay próximo compromiso
    expect(nextOnlyMorning).toBeNull()
  })

  it("WelcomeCard muestra el siguiente compromiso futuro si existe", () => {
    const nextWithEvening = getNextCommitment([pastMorningCommitment, eveningCommitment], nowAt1836)
    expect(nextWithEvening).not.toBeNull()
    expect(nextWithEvening?.commitment.id).toBe("comm-evening")
    expect(nextWithEvening?.inProgress).toBe(false)
  })

  it("Home y Agenda no se contradicen (Home sabe que hoy hubo 2 compromisos y Agenda los muestra ambos)", () => {
    const todayCommitments = getTodayCommitments([pastMorningCommitment, eveningCommitment], nowAt1836)
    const agendaListForDay5 = getCommitmentsForLocalDate(
      [pastMorningCommitment, eveningCommitment],
      "2026-09-05",
      DEFAULT_AGENDA_TIMEZONE,
    )
    expect(todayCommitments.length).toBe(2)
    expect(agendaListForDay5.length).toBe(2)
    expect(todayCommitments).toEqual(agendaListForDay5)
  })
})

describe("Canonical Agenda: Casos Obligatorios 1 a 14", () => {
  const referenceNow = new Date("2026-09-05T18:00:00.000Z") // 12:00 CDMX el 5 de septiembre

  it("1. compromiso futuro hoy", () => {
    const futureToday = createCommitment({
      id: "c-future-today",
      startAt: "2026-09-05T21:00:00.000Z", // 15:00 CDMX
      endAt: "2026-09-05T23:00:00.000Z",
    })
    const relation = getCommitmentDayRelation(futureToday, referenceNow)
    expect(relation).toBe("today")

    const next = getNextCommitment([futureToday], referenceNow)
    expect(next?.commitment.id).toBe("c-future-today")
    expect(next?.inProgress).toBe(false)
  })

  it("2. compromiso pasado hoy", () => {
    const pastToday = createCommitment({
      id: "c-past-today",
      startAt: "2026-09-05T14:00:00.000Z", // 08:00 CDMX
      endAt: "2026-09-05T16:00:00.000Z",   // 10:00 CDMX
    })
    // Pertenece a hoy
    expect(isCommitmentOnLocalDate(pastToday, "2026-09-05")).toBe(true)
    // Pero ya no está en curso ni es próximo
    expect(isCommitmentInProgress(pastToday, referenceNow)).toBe(false)
    expect(getNextCommitment([pastToday], referenceNow)).toBeNull()
  })

  it("3. compromiso actualmente en curso", () => {
    const inProgress = createCommitment({
      id: "c-in-progress",
      startAt: "2026-09-05T17:00:00.000Z", // 11:00 CDMX
      endAt: "2026-09-05T20:00:00.000Z",   // 14:00 CDMX
    })
    expect(isCommitmentInProgress(inProgress, referenceNow)).toBe(true)

    // Tiene prioridad sobre cualquier compromiso futuro
    const futureLater = createCommitment({
      id: "c-future-later",
      startAt: "2026-09-05T22:00:00.000Z",
      endAt: "2026-09-05T23:00:00.000Z",
    })
    const next = getNextCommitment([futureLater, inProgress], referenceNow)
    expect(next?.commitment.id).toBe("c-in-progress")
    expect(next?.inProgress).toBe(true)
  })

  it("4. compromiso mañana", () => {
    const tomorrowCommitment = createCommitment({
      id: "c-tomorrow",
      startAt: "2026-09-06T13:00:00.000Z", // 07:00 CDMX mañana
      endAt: "2026-09-06T21:00:00.000Z",
    })
    expect(getCommitmentDayRelation(tomorrowCommitment, referenceNow)).toBe("tomorrow")
    expect(formatHumanCommitmentDate(tomorrowCommitment.startAt, referenceNow)).toBe("Mañana")
  })

  it("5. compromiso dentro de una semana", () => {
    const inAWeek = createCommitment({
      id: "c-week",
      startAt: "2026-09-12T14:00:00.000Z",
      endAt: "2026-09-12T22:00:00.000Z",
    })
    expect(getCommitmentDayRelation(inAWeek, referenceNow)).toBe("future")
    const humanLabel = formatHumanCommitmentDate(inAWeek.startAt, referenceNow)
    expect(humanLabel.toLowerCase()).toContain("12")
  })

  it("6. varios compromisos hoy", () => {
    const c1 = createCommitment({ id: "c-1", startAt: "2026-09-05T14:00:00.000Z" })
    const c2 = createCommitment({ id: "c-2", startAt: "2026-09-05T19:00:00.000Z" })
    const c3 = createCommitment({ id: "c-3", startAt: "2026-09-05T23:00:00.000Z" })

    const list = getTodayCommitments([c3, c1, c2], referenceNow)
    expect(list.length).toBe(3)
    // Debe ordenar cronológicamente
    expect(list[0].id).toBe("c-1")
    expect(list[1].id).toBe("c-2")
    expect(list[2].id).toBe("c-3")
  })

  it("7. varios mañana", () => {
    const m1 = createCommitment({ id: "m-1", startAt: "2026-09-06T13:00:00.000Z" })
    const m2 = createCommitment({ id: "m-2", startAt: "2026-09-06T20:00:00.000Z" })

    const list = getCommitmentsForLocalDate([m2, m1], "2026-09-06")
    expect(list.length).toBe(2)
    expect(list[0].id).toBe("m-1")
    expect(list[1].id).toBe("m-2")
  })

  it("8. cancelado (status=cancelled nunca se muestra como activo)", () => {
    const cancelled = createCommitment({
      id: "c-cancelled",
      status: "cancelled",
      startAt: "2026-09-05T20:00:00.000Z",
    })
    expect(isCommitmentOnLocalDate(cancelled, "2026-09-05")).toBe(false)
    expect(getTodayCommitments([cancelled], referenceNow)).toHaveLength(0)
    expect(getNextCommitment([cancelled], referenceNow)).toBeNull()
  })

  it("9. completed (status=completed no aparece en próximos)", () => {
    const completed = createCommitment({
      id: "c-completed",
      status: "completed",
      startAt: "2026-09-05T20:00:00.000Z",
    })
    expect(getNextCommitment([completed], referenceNow)).toBeNull()
  })

  it("10. evento nocturno (22:00 -> 06:00 del día siguiente)", () => {
    // 22:00 CDMX el 5 de sep = 2026-09-06T04:00:00.000Z
    // 06:00 CDMX el 6 de sep = 2026-09-06T12:00:00.000Z
    const nightShift = createCommitment({
      id: "c-night",
      title: "Guardia nocturna",
      startAt: "2026-09-06T04:00:00.000Z",
      endAt: "2026-09-06T12:00:00.000Z",
    })

    // Pertenece a la fecha de inicio (5 de sep)
    expect(isCommitmentOnLocalDate(nightShift, "2026-09-05")).toBe(true)
    // También cubre horas del día siguiente (6 de sep)
    expect(isCommitmentOnLocalDate(nightShift, "2026-09-06")).toBe(true)

    // A las 02:00 AM del 6 de sep (08:00 UTC), está en curso
    const duringNight = new Date("2026-09-06T08:00:00.000Z")
    expect(isCommitmentInProgress(nightShift, duringNight)).toBe(true)
  })

  it("11. cambio de fecha al consultar", () => {
    const cSept5 = createCommitment({ id: "c-5", startAt: "2026-09-05T18:00:00.000Z" })
    const cSept8 = createCommitment({ id: "c-8", startAt: "2026-09-08T18:00:00.000Z" })

    const list5 = getCommitmentsForLocalDate([cSept5, cSept8], "2026-09-05")
    const list8 = getCommitmentsForLocalDate([cSept5, cSept8], "2026-09-08")

    expect(list5.map((c) => c.id)).toEqual(["c-5"])
    expect(list8.map((c) => c.id)).toEqual(["c-8"])
  })

  it("12. frontera 23:59 -> 00:00", () => {
    // 23:59 del 5 de sep = 2026-09-06T05:59:00.000Z
    const lateNight = createCommitment({
      id: "c-late",
      startAt: "2026-09-06T05:59:00.000Z",
      endAt: "2026-09-06T07:00:00.000Z",
    })
    expect(getLocalDateString(lateNight.startAt)).toBe("2026-09-05")
    expect(formatLocalTime(lateNight.startAt)).toBe("23:59")

    // 00:00 del 6 de sep = 2026-09-06T06:00:00.000Z
    const midnight = createCommitment({
      id: "c-midnight",
      startAt: "2026-09-06T06:00:00.000Z",
      endAt: "2026-09-06T08:00:00.000Z",
    })
    expect(getLocalDateString(midnight.startAt)).toBe("2026-09-06")
    expect(formatLocalTime(midnight.startAt)).toBe("00:00")
  })

  it("13. cambio por UTC (no altera la fecha local de México)", () => {
    // 20:00 en CDMX es 02:00 del día siguiente en UTC
    const eveningCdMx = "2026-09-06T02:00:00.000Z"
    expect(getLocalDateString(eveningCdMx, "America/Mexico_City")).toBe("2026-09-05")

    // 01:00 en CDMX es 07:00 del mismo día en UTC
    const morningCdMx = "2026-09-05T07:00:00.000Z"
    expect(getLocalDateString(morningCdMx, "America/Mexico_City")).toBe("2026-09-05")
  })

  it("14. type=other con title personalizado", () => {
    const customCommitment = createCommitment({
      id: "c-custom",
      type: "other",
      title: "Deporte y activación física",
    })
    expect(getCommitmentDisplayTitle(customCommitment)).toBe("Deporte y activación física")
    expect(getCommitmentDisplayIcon(customCommitment.type)).toBe("📌")

    // Si no tiene title personalizado, usa fallback
    const noTitleOther = createCommitment({
      id: "c-no-title",
      type: "other",
      title: "",
    })
    expect(getCommitmentDisplayTitle(noTitleOther)).toBe("Otro compromiso")
  })

  it("conserva la lectura de cambios de turno históricos aunque ya no se ofrezcan para altas", () => {
    const historicalShiftChange = createCommitment({
      type: "shift_change",
      title: "Cambio de turno",
    })
    expect(getCommitmentDisplayTitle(historicalShiftChange)).toBe("Cambio de turno")
    expect(getCommitmentDisplayIcon(historicalShiftChange.type)).toBe("🔀")
  })

  it("presenta los datos específicos y el horario de los nuevos registros", () => {
    const absence = createCommitment({
      type: "falta_injustificada",
      details: {
        allDay: true,
        affectedShift: "afternoon",
        fortnightLabel: "1ª quincena (1–15 de septiembre de 2026)",
        calculationStatus: "calculated",
        baseSalaryUsed: 6000,
        dailySalary: 400,
        estimatedDeduction: 400,
        deductionFormula: "$6,000.00 (sueldo base quincenal) ÷ 15 días = $400.00 por día",
      },
    })
    expect(getCommitmentScheduleLabel(absence)).toBe("Todo el día")
    expect(getCommitmentDetailLines(absence)).toEqual([
      "Turno afectado: Vespertino",
      "Quincena afectada: 1ª quincena (1–15 de septiembre de 2026)",
      "Salario base utilizado: $6,000.00 quincenal",
      "Fórmula: $6,000.00 (sueldo base quincenal) ÷ 15 días = $400.00 por día",
      "Descuento estimado: $400.00",
    ])

    const claim = createCommitment({
      type: "no_pagado",
      details: {
        claimFiledDate: "2026-09-01",
        claimReference: "OF-123",
        responsibleArea: "Nómina",
        claimStatus: "en_seguimiento",
      },
    })
    expect(getCommitmentDetailLines(claim)).toEqual([
      "Solicitud presentada: 01/09/2026",
      "Folio: OF-123",
      "Seguimiento con: Nómina",
      "Estado: En seguimiento",
    ])

    const txt = createCommitment({
      type: "txt_substitution",
      substituteWorkerName: "María López",
      details: {
        affectedShift: "morning",
        paidStatus: "si",
      },
    })
    expect(getCommitmentDetailLines(txt)).toEqual([
      "Sustituye a: María López",
      "Turno: Matutino",
      "Estatus de pago: Sí (pagado)",
    ])

    const reminder = createCommitment({
      type: "general_reminder",
      details: {
        priority: "urgente",
        recurrence: "weekly",
        location: "Dirección General",
      },
    })
    expect(getCommitmentDetailLines(reminder)).toEqual([
      "Prioridad: Urgente",
      "Repetición: Semanal",
      "Ubicación: Dirección General",
    ])
  })
})
