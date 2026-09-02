import { describe, expect, it } from "vitest"
import {
  getImssMandatoryRestDays,
  getImssMandatoryRestDaysForMonth,
  getMandatoryRestDayByDate,
  getEasterSunday,
  getNthDayOfWeek,
  VERSIONED_ELECTORAL_HOLIDAYS,
} from "../domain/mandatory-rest-days"

describe("Días de Descanso Obligatorio IMSS — Cláusula 46 Fracción III CCT 2025-2027", () => {
  it("genera exactamente las 12 fechas de control para 2026 sin duplicados", () => {
    const days2026 = getImssMandatoryRestDays(2026)
    expect(days2026).toHaveLength(12)

    const expectedDates2026 = [
      "2026-01-01", // Año Nuevo
      "2026-02-02", // 1er lunes de febrero (5 de febrero)
      "2026-03-16", // 3er lunes de marzo (21 de marzo)
      "2026-04-02", // Jueves Santo
      "2026-04-03", // Viernes Santo
      "2026-04-04", // Sábado Santo
      "2026-05-01", // 1 de mayo (Día del Trabajo)
      "2026-05-10", // 10 de mayo (Día de las Madres)
      "2026-09-15", // 15 de septiembre
      "2026-09-16", // 16 de septiembre
      "2026-11-16", // 3er lunes de noviembre (20 de noviembre)
      "2026-12-25", // 25 de diciembre (Navidad)
    ]

    const actualDates = days2026.map((d) => d.date)
    expect(actualDates).toEqual(expectedDates2026)

    // IDs únicos sin duplicados
    const ids = new Set(days2026.map((d) => d.id))
    expect(ids.size).toBe(12)
  })

  it("excluye el 1 de octubre en 2026 y no inventa elecciones en 2026", () => {
    const days2026 = getImssMandatoryRestDays(2026)
    expect(days2026.some((d) => d.date === "2026-10-01")).toBe(false)
    expect(days2026.some((d) => d.id.includes("electoral"))).toBe(false)
  })

  it("calcula correctamente el 1er lunes de febrero en distintos años", () => {
    // 2024: 1 de feb fue jueves -> 1er lunes es 5 de feb
    const d2024 = getImssMandatoryRestDays(2024).find((d) => d.month === 1 && d.id.includes("02-lunes1"))
    expect(d2024?.date).toBe("2024-02-05")

    // 2025: 1 de feb fue sábado -> 1er lunes es 3 de feb
    const d2025 = getImssMandatoryRestDays(2025).find((d) => d.month === 1 && d.id.includes("02-lunes1"))
    expect(d2025?.date).toBe("2025-02-03")

    // 2026: 1 de feb es domingo -> 1er lunes es 2 de feb
    const d2026 = getImssMandatoryRestDays(2026).find((d) => d.month === 1 && d.id.includes("02-lunes1"))
    expect(d2026?.date).toBe("2026-02-02")

    // 2027: 1 de feb es lunes -> 1er lunes es 1 de feb
    const d2027 = getImssMandatoryRestDays(2027).find((d) => d.month === 1 && d.id.includes("02-lunes1"))
    expect(d2027?.date).toBe("2027-02-01")
  })

  it("calcula correctamente el 3er lunes de marzo en distintos años", () => {
    // 2024: 1er lunes 4, 2do lunes 11, 3er lunes 18
    const d2024 = getImssMandatoryRestDays(2024).find((d) => d.month === 2 && d.id.includes("03-lunes3"))
    expect(d2024?.date).toBe("2024-03-18")

    // 2025: 1er lunes 3, 2do lunes 10, 3er lunes 17
    const d2025 = getImssMandatoryRestDays(2025).find((d) => d.month === 2 && d.id.includes("03-lunes3"))
    expect(d2025?.date).toBe("2025-03-17")

    // 2026: 1er lunes 2, 2do lunes 9, 3er lunes 16
    const d2026 = getImssMandatoryRestDays(2026).find((d) => d.month === 2 && d.id.includes("03-lunes3"))
    expect(d2026?.date).toBe("2026-03-16")
  })

  it("calcula correctamente el 3er lunes de noviembre en distintos años", () => {
    // 2024: 1er lunes 4, 2do lunes 11, 3er lunes 18
    const d2024 = getImssMandatoryRestDays(2024).find((d) => d.month === 10 && d.id.includes("11-lunes3"))
    expect(d2024?.date).toBe("2024-11-18")

    // 2025: 1er lunes 3, 2do lunes 10, 3er lunes 17
    const d2025 = getImssMandatoryRestDays(2025).find((d) => d.month === 10 && d.id.includes("11-lunes3"))
    expect(d2025?.date).toBe("2025-11-17")

    // 2026: 1er lunes 2, 2do lunes 9, 3er lunes 16
    const d2026 = getImssMandatoryRestDays(2026).find((d) => d.month === 10 && d.id.includes("11-lunes3"))
    expect(d2026?.date).toBe("2026-11-16")
  })

  it("calcula correctamente Semana Santa (Jueves, Viernes y Sábado Santo)", () => {
    // 2025: Pascua es 20 de abril de 2025
    const easter2025 = getEasterSunday(2025)
    expect(easter2025).toEqual({ month: 3, day: 20 }) // Abril (month=3)
    const days2025 = getImssMandatoryRestDays(2025)
    expect(days2025.find((d) => d.id.includes("jueves-santo"))?.date).toBe("2025-04-17")
    expect(days2025.find((d) => d.id.includes("viernes-santo"))?.date).toBe("2025-04-18")
    expect(days2025.find((d) => d.id.includes("sabado-santo"))?.date).toBe("2025-04-19")

    // 2026: Pascua es 5 de abril de 2026
    const easter2026 = getEasterSunday(2026)
    expect(easter2026).toEqual({ month: 3, day: 5 })
    const days2026 = getImssMandatoryRestDays(2026)
    expect(days2026.find((d) => d.id.includes("jueves-santo"))?.date).toBe("2026-04-02")
    expect(days2026.find((d) => d.id.includes("viernes-santo"))?.date).toBe("2026-04-03")
    expect(days2026.find((d) => d.id.includes("sabado-santo"))?.date).toBe("2026-04-04")

    // 2027: Pascua es 28 de marzo de 2027 (Jueves 25, Viernes 26, Sábado 27 de marzo)
    const easter2027 = getEasterSunday(2027)
    expect(easter2027).toEqual({ month: 2, day: 28 }) // Marzo (month=2)
    const days2027 = getImssMandatoryRestDays(2027)
    expect(days2027.find((d) => d.id.includes("jueves-santo"))?.date).toBe("2027-03-25")
    expect(days2027.find((d) => d.id.includes("viernes-santo"))?.date).toBe("2027-03-26")
    expect(days2027.find((d) => d.id.includes("sabado-santo"))?.date).toBe("2027-03-27")
  })

  it("aplica la regla sexenal del 1 de octubre (transmisión Poder Ejecutivo Federal)", () => {
    // 2024: SÍ aplica (transmisión 1 de octubre de 2024)
    const days2024 = getImssMandatoryRestDays(2024)
    expect(days2024.some((d) => d.date === "2024-10-01")).toBe(true)

    // 2025, 2026, 2027, 2028, 2029: NO aplica
    for (const yr of [2025, 2026, 2027, 2028, 2029]) {
      const days = getImssMandatoryRestDays(yr)
      expect(days.some((d) => d.date === `${yr}-10-01`)).toBe(false)
    }

    // 2030: SÍ aplica
    const days2030 = getImssMandatoryRestDays(2030)
    expect(days2030.some((d) => d.date === "2030-10-01")).toBe(true)

    // 2036: SÍ aplica
    const days2036 = getImssMandatoryRestDays(2036)
    expect(days2036.some((d) => d.date === "2036-10-01")).toBe(true)
  })

  it("admite jornadas electorales mediante configuración oficial versionada", () => {
    // 2024 tiene elección federal el 2 de junio de 2024 registrada
    const days2024 = getImssMandatoryRestDays(2024)
    const elec2024 = days2024.find((d) => d.date === "2024-06-02")
    expect(elec2024).toBeDefined()
    expect(elec2024?.title).toContain("Electoral")

    // Con opción personalizada por jurisdicción
    const customOptions = {
      electoralDates: [
        {
          date: "2027-06-06",
          jurisdiction: "federal",
          title: "Elecciones Federales Intermedias 2027",
        },
        {
          date: "2027-07-04",
          jurisdiction: "cdmx",
          title: "Elección Local CDMX 2027",
        },
      ],
      jurisdiction: "cdmx",
    }
    const days2027 = getImssMandatoryRestDays(2027, customOptions)
    expect(days2027.some((d) => d.date === "2027-06-06")).toBe(true) // federal siempre aplica
    expect(days2027.some((d) => d.date === "2027-07-04")).toBe(true) // cdmx aplica para usuario cdmx
  })

  it("garantiza que todos los días contractuales tienen assignedGuard = false por defecto", () => {
    const days = getImssMandatoryRestDays(2026)
    for (const d of days) {
      expect(d.assignedGuard).toBe(false)
      expect(d.guardEligible).toBe(true)
      expect(d.contractual).toBe(true)
      expect(d.clause).toBe("46-III")
      expect(d.source).toBe("CCT_IMSS_SNTSS_2025_2027")
      expect(d.legalBasis).toContain("Cláusula 46")
    }
  })

  it("filtra correctamente por mes con getImssMandatoryRestDaysForMonth", () => {
    const mayo2026 = getImssMandatoryRestDaysForMonth(2026, 4) // Mayo (month 4)
    expect(mayo2026).toHaveLength(2)
    expect(mayo2026.map((d) => d.date)).toEqual(["2026-05-01", "2026-05-10"])

    const septiembre2026 = getImssMandatoryRestDaysForMonth(2026, 8) // Septiembre (month 8)
    expect(septiembre2026).toHaveLength(2)
    expect(septiembre2026.map((d) => d.date)).toEqual(["2026-09-15", "2026-09-16"])
  })

  it("busca correctamente por fecha con getMandatoryRestDayByDate", () => {
    const d1 = getMandatoryRestDayByDate("2026-05-10")
    expect(d1).toBeDefined()
    expect(d1?.title).toBe("Día de las Madres")

    const dNone = getMandatoryRestDayByDate("2026-05-11")
    expect(dNone).toBeUndefined()
  })
})
