import { describe, it, expect } from "vitest"
import {
  auditAttendancePunches,
  detectShiftPattern,
  timeToMinutes,
  minutesToTime,
  isTimeInWindow,
  convertBiometricRecordsToPunches,
  type RawPunch,
} from "../lib/omisiones-detector"

describe("omisiones-detector pure utilities", () => {
  it("convierte y formatea tiempo correctamente", () => {
    expect(timeToMinutes("07:00")).toBe(420)
    expect(timeToMinutes("20:30")).toBe(1230)
    expect(minutesToTime(420)).toBe("07:00")
    expect(minutesToTime(1230)).toBe("20:30")
  })

  it("evalúa ventanas de tiempo regulares y que cruzan medianoche", () => {
    expect(isTimeInWindow("07:05", "06:15", "08:00")).toBe(true)
    expect(isTimeInWindow("08:15", "06:15", "08:00")).toBe(false)
    // Cruce de medianoche: 22:00 a 02:00
    expect(isTimeInWindow("23:30", "22:00", "02:00")).toBe(true)
    expect(isTimeInWindow("01:15", "22:00", "02:00")).toBe(true)
    expect(isTimeInWindow("15:00", "22:00", "02:00")).toBe(false)
  })
})

describe("Auto-detección de patrones de turno", () => {
  it("detecta turno nocturno cuando hay checadas nocturnas repetidas", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-12", time: "20:25" },
      { date: "2026-10-13", time: "08:18" },
      { date: "2026-10-14", time: "20:30" },
      { date: "2026-10-15", time: "08:20" },
    ]
    expect(detectShiftPattern(punches)).toBe("nocturno")
  })

  it("detecta jornada acumulada cuando las checadas son en fin de semana", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-17", time: "07:55" }, // Sábado
      { date: "2026-10-17", time: "20:05" },
      { date: "2026-10-18", time: "07:50" }, // Domingo
      { date: "2026-10-18", time: "20:10" },
    ]
    expect(detectShiftPattern(punches)).toBe("jornada_acumulada_diurna")
  })

  it("detecta jornada acumulada nocturna (domingo cruza a lunes)", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-17", time: "07:55" }, // Sábado
      { date: "2026-10-17", time: "20:05" },
      { date: "2026-10-18", time: "20:00" }, // Domingo noche
      { date: "2026-10-19", time: "08:10" }, // Lunes mañana
    ]
    expect(detectShiftPattern(punches)).toBe("jornada_acumulada_nocturna")
  })

  it("detecta matutino 08:00 cuando el promedio de entradas es cercano a las 8", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-12", time: "07:55" },
      { date: "2026-10-12", time: "16:02" },
      { date: "2026-10-13", time: "08:03" },
      { date: "2026-10-13", time: "16:05" },
    ]
    expect(detectShiftPattern(punches)).toBe("matutino_8")
  })

  it("detecta vespertino cuando las entradas son a las 14:00", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-12", time: "13:58" },
      { date: "2026-10-12", time: "21:32" },
      { date: "2026-10-13", time: "14:05" },
      { date: "2026-10-13", time: "21:35" },
    ]
    expect(detectShiftPattern(punches)).toBe("vespertino_21_30")
  })
})

describe("Auditoría de Turno Nocturno (Cruce de medianoche)", () => {
  it("empareja entrada de noche con salida de la mañana siguiente sin falsas omisiones", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-12", time: "20:25" }, // Entrada Martes noche
      { date: "2026-10-13", time: "08:18" }, // Salida Miércoles mañana
    ]

    const result = auditAttendancePunches({
      punches,
      pattern: "nocturno",
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    })

    expect(result.completeShifts).toBe(1)
    expect(result.omisionesEntrada).toBe(0)
    expect(result.omisionesSalida).toBe(0)
    expect(result.blocks[0].shiftDate).toBe("2026-10-12")
    expect(result.blocks[0].status).toBe("completo")
    expect(result.blocks[0].entryPunch?.time).toBe("20:25")
    expect(result.blocks[0].exitPunch?.time).toBe("08:18")
  })

  it("detecta omisión de salida nocturna si checó entrada pero no checó al día siguiente", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-12", time: "20:30" }, // Entrada noche, sin salida a la mañana
    ]

    const result = auditAttendancePunches({
      punches,
      pattern: "nocturno",
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    })

    expect(result.completeShifts).toBe(0)
    expect(result.omisionesSalida).toBe(1)
    expect(result.blocks[0].status).toBe("omision_salida")
  })

  it("detecta omisión de entrada nocturna si solo checó salida a la mañana siguiente", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-13", time: "08:15" }, // Solo checó salida
    ]

    const result = auditAttendancePunches({
      punches,
      pattern: "nocturno",
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    })

    expect(result.completeShifts).toBe(0)
    expect(result.omisionesEntrada).toBe(1)
    expect(result.blocks[0].status).toBe("omision_entrada")
  })
})

describe("Auditoría de Jornada Acumulada (Sábado y Domingo)", () => {
  it("ignora lunes a viernes como días de descanso y audita fin de semana", () => {
    // 2026-10-17 es Sábado, 2026-10-18 es Domingo
    const punches: RawPunch[] = [
      { date: "2026-10-17", time: "07:55" }, // Sábado entrada
      { date: "2026-10-17", time: "20:05" }, // Sábado salida
      { date: "2026-10-18", time: "07:50" }, // Domingo entrada
      { date: "2026-10-18", time: "20:00" }, // Domingo salida
    ]

    const result = auditAttendancePunches({
      punches,
      pattern: "jornada_acumulada_diurna",
      startDate: "2026-10-12", // Inicia en lunes
      endDate: "2026-10-18",   // Termina en domingo
    })

    // De lunes a viernes (12 al 16) no debe haber alertas ni faltas
    expect(result.omisionesEntrada).toBe(0)
    expect(result.omisionesSalida).toBe(0)
    expect(result.ausencias).toBe(0)
    expect(result.completeShifts).toBe(2)
  })

  it("detecta jornada acumulada especial con salida el lunes a las 08:00", () => {
    // 2026-10-18 (Dom) entra a las 08:00, 2026-10-19 (Lun) sale a las 08:05
    const punches: RawPunch[] = [
      { date: "2026-10-18", time: "08:00" },
      { date: "2026-10-19", time: "08:05" },
    ]

    const result = auditAttendancePunches({
      punches,
      pattern: "jornada_acumulada_nocturna",
      startDate: "2026-10-18",
      endDate: "2026-10-18",
    })

    expect(result.completeShifts).toBe(1)
    expect(result.omisionesSalida).toBe(0)
    expect(result.blocks[0].shiftDate).toBe("2026-10-18")
    expect(result.blocks[0].status).toBe("completo")
  })
})

describe("Auditoría de Turnos Diurnos (Matutino y Vespertino con variantes)", () => {
  it("audita turno matutino 07:00 a 15:00 completo", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-12", time: "06:58" },
      { date: "2026-10-12", time: "15:02" },
    ]

    const result = auditAttendancePunches({
      punches,
      pattern: "matutino_7",
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    })

    expect(result.completeShifts).toBe(1)
    expect(result.omisionesEntrada).toBe(0)
    expect(result.omisionesSalida).toBe(0)
  })

  it("detecta omisión de salida en turno matutino con solo una checada de entrada", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-12", time: "06:55" },
    ]

    const result = auditAttendancePunches({
      punches,
      pattern: "matutino_7",
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    })

    expect(result.omisionesSalida).toBe(1)
    expect(result.blocks[0].status).toBe("omision_salida")
  })

  it("detecta omisión de entrada en turno vespertino si solo checó a las 21:30", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-12", time: "21:35" },
    ]

    const result = auditAttendancePunches({
      punches,
      pattern: "vespertino_21_30",
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    })

    expect(result.omisionesEntrada).toBe(1)
    expect(result.blocks[0].status).toBe("omision_entrada")
  })
})

describe("Auditoría de TxT y Tiempos Extra", () => {
  it("soporta doblete de turno con 4 checadas (matutino + vespertino cubierto) sin omisiones", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-12", time: "06:58" }, // Entrada Matutino
      { date: "2026-10-12", time: "15:02" }, // Salida Matutino
      { date: "2026-10-12", time: "15:06" }, // Entrada Vespertino (TxT / TE)
      { date: "2026-10-12", time: "22:04" }, // Salida Vespertino
    ]

    const result = auditAttendancePunches({
      punches,
      pattern: "matutino_7",
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    })

    expect(result.completeShifts).toBe(2)
    expect(result.omisionesEntrada).toBe(0)
    expect(result.omisionesSalida).toBe(0)
    expect(result.turnosExtraordinarios).toBe(1)
  })

  it("reconoce salida prolongada como jornada completa con tiempo extra estimado", () => {
    const punches: RawPunch[] = [
      { date: "2026-10-12", time: "06:55" }, // Entrada regular
      { date: "2026-10-12", time: "19:30" }, // Salida tardía con 4.5h extras
    ]

    const result = auditAttendancePunches({
      punches,
      pattern: "matutino_7",
      startDate: "2026-10-12",
      endDate: "2026-10-12",
    })

    expect(result.completeShifts).toBe(1)
    expect(result.omisionesSalida).toBe(0)
    expect(result.blocks[0].isExtendedExit).toBe(true)
    expect(result.blocks[0].overtimeEstimatedMinutes).toBe(270) // 4.5 horas
  })

  it("reconoce cobertura TxT en día de descanso sin considerarlo error", () => {
    // 2026-10-17 es Sábado (día de descanso para trabajador de Lunes a Viernes)
    const punches: RawPunch[] = [
      { date: "2026-10-17", time: "13:58" },
      { date: "2026-10-17", time: "21:35" },
    ]

    const result = auditAttendancePunches({
      punches,
      pattern: "matutino_7",
      commitments: [
        {
          id: "com-1",
          userId: "user-1",
          type: "txt_substitution",
          title: "TxT con Morales",
          startAt: "2026-10-17T14:00:00Z",
          endAt: "2026-10-17T21:30:00Z",
          workplace: "HGZ 1",
          service: "Urgencias",
          substituteWorkerName: "Morales",
          notes: "",
          reminder: { dayBefore: false, hoursBefore: false, atStart: false },
          status: "active",
          createdAt: "2026-10-10T00:00:00Z",
        },
      ],
      startDate: "2026-10-17",
      endDate: "2026-10-17",
    })

    expect(result.completeShifts).toBe(1)
    expect(result.omisionesEntrada).toBe(0)
    expect(result.omisionesSalida).toBe(0)
    expect(result.blocks[0].isCoveringColleague).toBe(true)
    expect(result.blocks[0].shiftType).toBe("txt_cobertura")
  })
})

describe("convertBiometricRecordsToPunches", () => {
  it("convierte registros de portal con estructura genérica a RawPunch normalizado", () => {
    const rawPortalRecords = [
      { fields: { col_0: "12/10/2026", col_1: "06:55:00", tipo: "Entrada" } },
      { fields: { fecha: "2026-10-12", hora: "15:02", tipo: "Salida" } },
    ]

    const punches = convertBiometricRecordsToPunches(rawPortalRecords)
    expect(punches).toHaveLength(2)
    expect(punches[0]).toEqual({ date: "2026-10-12", time: "06:55" })
    expect(punches[1]).toEqual({ date: "2026-10-12", time: "15:02" })
  })
})

