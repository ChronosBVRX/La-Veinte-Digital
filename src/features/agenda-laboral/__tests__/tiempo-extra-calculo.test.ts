import { describe, it, expect } from "vitest"
import {
  calculateAgendaTiempoExtra,
  getDurationMinutes,
} from "../lib/tiempo-extra-calculo"

describe("tiempo-extra-calculo: Cálculo normativo de tiempo extra en Agenda Laboral", () => {
  it("calcula duración en minutos correctamente, incluyendo cruce de medianoche", () => {
    expect(getDurationMinutes("08:00", "12:00")).toBe(240)
    expect(getDurationMinutes("14:00", "14:30")).toBe(30)
    // Cruza medianoche: de 22:00 a 04:00 = 6 horas = 360 minutos
    expect(getDurationMinutes("22:00", "04:00")).toBe(360)
  })

  it("redondea minutos conforme a Cláusula 33 del CCT", () => {
    // 2 horas y 15 minutos (135 min) -> redondea a 2.5 h
    const res1 = calculateAgendaTiempoExtra({
      startTime: "08:00",
      endTime: "10:15",
      baseSalaryFortnightly: 12000,
      jornada: 8,
    })
    expect(res1.hoursCalculated).toBe(2.5)

    // 2 horas y 45 minutos (165 min) -> redondea a 3.0 h
    const res2 = calculateAgendaTiempoExtra({
      startTime: "08:00",
      endTime: "10:45",
      baseSalaryFortnightly: 12000,
      jornada: 8,
    })
    expect(res2.hoursCalculated).toBe(3.0)
  })

  it("calcula importe estimado al doble para tiempo extra ordinario", () => {
    // Sueldo base quincenal: $12,000. Jornada: 8h. Horas periodo: 8 * 15 = 120h.
    // Valor hora ordinaria: 12,000 / 120 = $100.00/h.
    // 4 horas dobles (factor 2): 4 * 100 * 2 = $800.00.
    const res = calculateAgendaTiempoExtra({
      startTime: "16:00",
      endTime: "20:00",
      baseSalaryFortnightly: 12000,
      jornada: 8,
      isHolidayOrRestDay: false,
    })

    expect(res.status).toBe("calculated")
    expect(res.hoursCalculated).toBe(4)
    expect(res.hourlyRate).toBe(100)
    expect(res.factor).toBe(2)
    expect(res.estimatedEarnings).toBe(800)
  })

  it("calcula importe estimado al triple para labor en descanso o festivo", () => {
    // Sueldo base: $12,000, Jornada: 8h ($100/h).
    // 4 horas al triple (factor 3): 4 * 100 * 3 = $1,200.00.
    const res = calculateAgendaTiempoExtra({
      startTime: "08:00",
      endTime: "12:00",
      baseSalaryFortnightly: 12000,
      jornada: 8,
      isHolidayOrRestDay: true,
    })

    expect(res.status).toBe("calculated")
    expect(res.factor).toBe(3)
    expect(res.estimatedEarnings).toBe(1200)
  })

  it("retorna estado pending con mensaje amigable cuando falta sueldo base", () => {
    const res = calculateAgendaTiempoExtra({
      startTime: "14:00",
      endTime: "18:00",
      baseSalaryFortnightly: null,
      jornada: 8,
    })

    expect(res.status).toBe("pending")
    expect(res.hoursCalculated).toBe(4)
    expect(res.estimatedEarnings).toBeUndefined()
    expect(res.missingDataReason).toContain("sueldo base")
  })
})
