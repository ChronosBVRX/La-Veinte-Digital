import { describe, it, expect } from "vitest"
import {
  calculateVacationReturn,
  getPeriodGrossDays,
  formatCivilDateSpanish,
  formatCivilDateWithDayOfWeek,
  getDayOfWeekName,
} from "../domain/return-calculator"

describe("return-calculator: Pure Domain Engine", () => {
  describe("getPeriodGrossDays", () => {
    it("returns 8 days for 1st year (16 annual days / 2)", () => {
      const res = getPeriodGrossDays(1, "FIRST_PERIOD")
      expect(res.baseAnnualDays).toBe(16)
      expect(res.grossPeriodDays).toBe(8)
    })

    it("returns 10 days for 5+ years (20 annual days / 2)", () => {
      const res = getPeriodGrossDays(5, "FIRST_PERIOD")
      expect(res.baseAnnualDays).toBe(20)
      expect(res.grossPeriodDays).toBe(10)
    })

    it("returns second period division correctly", () => {
      // 17 days: floor(17/2)=8, ceil(17/2)=9
      const res1 = getPeriodGrossDays(2, "FIRST_PERIOD")
      const res2 = getPeriodGrossDays(2, "SECOND_PERIOD")
      expect(res1.grossPeriodDays).toBe(8)
      expect(res2.grossPeriodDays).toBe(9)
    })

    it("returns full cycle days for FULL_CYCLE (Marca 0)", () => {
      const res = getPeriodGrossDays(5, "FULL_CYCLE")
      expect(res.grossPeriodDays).toBe(20)
    })

    it("accepts custom days", () => {
      const res = getPeriodGrossDays(5, "CUSTOM", 12)
      expect(res.grossPeriodDays).toBe(12)
    })
  })

  describe("calculateVacationReturn - Escenarios Reales CCT IMSS", () => {
    it("Escenario estándar: 10 días hábiles iniciando lunes sin festivos (Sab/Dom descanso)", () => {
      const result = calculateVacationReturn({
        startDate: "2026-06-01", // Lunes
        seniorityYears: 5, // 10 días en 1er periodo
        periodSelection: "FIRST_PERIOD",
        weeklyRestDays: [5, 6], // Sábado y Domingo
      })

      // Semana 1: Lun 1 a Vie 5 (5 días). Sáb 6 y Dom 7 descanso.
      // Semana 2: Lun 8 a Vie 12 (5 días, acumulado 10).
      expect(result.netVacationDays).toBe(10)
      expect(result.lastVacationDate).toBe("2026-06-12")
      expect(result.lastVacationDayName).toBe("Viernes")

      // El sábado 13 y domingo 14 son descansos semanales
      // Reanudación de labores: Lunes 15 de junio
      expect(result.returnToWorkDate).toBe("2026-06-15")
      expect(result.returnDayName).toBe("Lunes")
      expect(result.weeklyRestDaysCount).toBe(4) // Sáb 6, Dom 7, Sáb 13, Dom 14
      expect(result.totalCalendarDays).toBe(14) // Del 1 al 14 de junio inclusive
    })

    it("Escenario con DÍAS A CUENTA DE VACACIONES: 10 días - 2 a cuenta = 8 días hábiles", () => {
      const result = calculateVacationReturn({
        startDate: "2026-06-01", // Lunes
        seniorityYears: 5,
        periodSelection: "FIRST_PERIOD",
        daysOnAccount: 2, // 2 días previamente solicitados / permisos
        weeklyRestDays: [5, 6],
      })

      // Semana 1: Lun 1 a Vie 5 = 5 días. Sáb 6 y Dom 7 descanso.
      // Semana 2: Lun 8, Mar 9, Mié 10 = 3 días (total 8 días netos consumidos).
      expect(result.grossPeriodDays).toBe(10)
      expect(result.daysOnAccount).toBe(2)
      expect(result.netVacationDays).toBe(8)
      expect(result.lastVacationDate).toBe("2026-06-10")
      expect(result.lastVacationDayName).toBe("Miércoles")

      // El jueves 11 es día laborable ordinario: ¡regrésale el jueves 11!
      expect(result.returnToWorkDate).toBe("2026-06-11")
      expect(result.returnDayName).toBe("Jueves")
    })

    it("Escenario Fiestas Patrias IMSS (15 y 16 de septiembre son descansos obligatorios Cl. 46)", () => {
      const result = calculateVacationReturn({
        startDate: "2026-09-14", // Lunes
        seniorityYears: 1, // 8 días en 1er periodo
        periodSelection: "FIRST_PERIOD",
        weeklyRestDays: [5, 6],
      })

      // Lun 14: Día vacacional 1
      // Mar 15: Descanso obligatorio (Grito de Independencia)
      // Mié 16: Descanso obligatorio (Independencia)
      // Jue 17: Día vacacional 2
      // Vie 18: Día vacacional 3
      // Sáb 19, Dom 20: Descanso semanal
      // Lun 21: Día vacacional 4
      // Mar 22: Día vacacional 5
      // Mié 23: Día vacacional 6
      // Jue 24: Día vacacional 7
      // Vie 25: Día vacacional 8 (Último día)
      // Sáb 26, Dom 27: Descanso semanal
      // Regreso: Lunes 28 de septiembre
      expect(result.netVacationDays).toBe(8)
      expect(result.mandatoryRestDaysCount).toBe(2)
      expect(result.mandatoryHolidaysInPeriod.map((h) => h.date)).toContain("2026-09-15")
      expect(result.mandatoryHolidaysInPeriod.map((h) => h.date)).toContain("2026-09-16")
      expect(result.lastVacationDate).toBe("2026-09-25")
      expect(result.lastVacationDayName).toBe("Viernes")
      expect(result.returnToWorkDate).toBe("2026-09-28")
      expect(result.returnDayName).toBe("Lunes")
    })

    it("Escenario Semana Santa IMSS (Jueves, Viernes y Sábado Santo no descuentan vacaciones)", () => {
      // En 2026, Pascua es 5 de abril.
      // Jueves Santo: 2026-04-02
      // Viernes Santo: 2026-04-03
      // Sábado Santo: 2026-04-04
      const result = calculateVacationReturn({
        startDate: "2026-03-30", // Lunes previo a Semana Santa
        customEntitlementDays: 5,
        periodSelection: "CUSTOM",
        weeklyRestDays: [5, 6],
      })

      // Lun 30 Mar: Día 1
      // Mar 31 Mar: Día 2
      // Mié 01 Abr: Día 3
      // Jue 02 Abr: Descanso obligatorio (Jueves Santo)
      // Vie 03 Abr: Descanso obligatorio (Viernes Santo)
      // Sáb 04 Abr: Descanso obligatorio / semanal (Sábado Santo)
      // Dom 05 Abr: Descanso semanal
      // Lun 06 Abr: Día 4
      // Mar 07 Abr: Día 5 (Último día de vacaciones)
      // Mié 08 Abr: Reanudación de labores
      expect(result.netVacationDays).toBe(5)
      expect(result.lastVacationDate).toBe("2026-04-07")
      expect(result.lastVacationDayName).toBe("Martes")
      expect(result.returnToWorkDate).toBe("2026-04-08")
      expect(result.returnDayName).toBe("Miércoles")
    })

    it("Escenario Puente Oficial de inicio de semana: Vacaciones terminan viernes antes de lunes festivo", () => {
      // 1er lunes de febrero 2026 (Constitución): 2026-02-02
      // Si el trabajador termina sus vacaciones el viernes 2026-01-30:
      // Sáb 31 Ene: Descanso semanal
      // Dom 01 Feb: Descanso semanal
      // Lun 02 Feb: Descanso obligatorio (Constitución)
      // Regreso: ¡Martes 3 de febrero!
      const result = calculateVacationReturn({
        startDate: "2026-01-26", // Lunes
        customEntitlementDays: 5, // Lun 26, Mar 27, Mié 28, Jue 29, Vie 30 (5 días)
        periodSelection: "CUSTOM",
        weeklyRestDays: [5, 6],
      })

      expect(result.lastVacationDate).toBe("2026-01-30")
      expect(result.lastVacationDayName).toBe("Viernes")
      expect(result.returnToWorkDate).toBe("2026-02-03")
      expect(result.returnDayName).toBe("Martes")
      expect(result.mandatoryHolidaysInPeriod.some((h) => h.date === "2026-02-02")).toBe(true)
    })

    it("Escenario de Rol Hospitalario: Descansos Domingo (6) y Lunes (0)", () => {
      // Trabajador descansa Domingo y Lunes, labora Martes a Sábado
      const result = calculateVacationReturn({
        startDate: "2026-06-02", // Martes (su primer día laborable)
        customEntitlementDays: 5,
        periodSelection: "CUSTOM",
        weeklyRestDays: [6, 0], // Domingo y Lunes
      })

      // Mar 2, Mié 3, Jue 4, Vie 5, Sáb 6 = 5 días laborables consumidos.
      // Último día de vacaciones: Sábado 6 de junio.
      // Dom 7: Descanso semanal.
      // Lun 8: Descanso semanal.
      // Regreso: ¡Martes 9 de junio!
      expect(result.lastVacationDate).toBe("2026-06-06")
      expect(result.lastVacationDayName).toBe("Sábado")
      expect(result.returnToWorkDate).toBe("2026-06-09")
      expect(result.returnDayName).toBe("Martes")
    })

    it("Caso borde: Días a cuenta igualan o superan los días del periodo", () => {
      const result = calculateVacationReturn({
        startDate: "2026-06-01",
        seniorityYears: 1, // 8 días
        periodSelection: "FIRST_PERIOD",
        daysOnAccount: 8, // Cubierto al 100%
        weeklyRestDays: [5, 6],
      })

      expect(result.netVacationDays).toBe(0)
      expect(result.daysOnAccount).toBe(8)
      expect(result.returnToWorkDate).toBeDefined()
      expect(result.summarySentence).toContain("cubiertos por días a cuenta")
    })

    it("Genera ficha de texto lista para copiar", () => {
      const result = calculateVacationReturn({
        startDate: "2026-06-01",
        seniorityYears: 5,
        periodSelection: "FIRST_PERIOD",
        daysOnAccount: 2,
        weeklyRestDays: [5, 6],
      })

      expect(result.copyableText).toContain("SOLICITUD DE PROGRAMACIÓN DE VACACIONES (IMSS CCT)")
      expect(result.copyableText).toContain("REANUDACIÓN DE LABORES (FECHA DE REGRESO)")
      expect(result.copyableText).toContain("Días a cuenta de vacaciones descontados: 2 días")
      expect(result.copyableText).toContain("8 días hábiles")
    })
  })

  describe("Formateadores en español", () => {
    it("formatCivilDateSpanish", () => {
      expect(formatCivilDateSpanish("2026-05-10")).toBe("10 de mayo de 2026")
      expect(formatCivilDateSpanish("2027-01-01")).toBe("1 de enero de 2027")
    })

    it("formatCivilDateWithDayOfWeek", () => {
      // 2026-05-10 es Domingo
      expect(formatCivilDateWithDayOfWeek("2026-05-10")).toBe("Domingo 10 de mayo de 2026")
      // 2026-06-01 es Lunes
      expect(formatCivilDateWithDayOfWeek("2026-06-01")).toBe("Lunes 1 de junio de 2026")
    })

    it("getDayOfWeekName", () => {
      expect(getDayOfWeekName("2026-06-01")).toBe("Lunes")
      expect(getDayOfWeekName("2026-06-05")).toBe("Viernes")
      expect(getDayOfWeekName("2026-06-06")).toBe("Sábado")
      expect(getDayOfWeekName("2026-06-07")).toBe("Domingo")
    })
  })
})
