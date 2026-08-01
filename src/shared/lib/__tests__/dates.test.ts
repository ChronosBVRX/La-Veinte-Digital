import { describe, expect, it } from "vitest"
import {
  institutionalDateString,
  institutionalToday,
  todayForQueryParam,
} from "@/shared/lib/dates"

describe("fechas institucionales (America/Mexico_City)", () => {
  it("convierte un instante vespertino mexicano al mismo día institucional", () => {
    const instant = new Date("2026-07-31T20:17:00-06:00")
    expect(institutionalDateString(instant)).toBe("2026-07-31")
  })

  it("no salta al día siguiente durante la tarde-noche mexicana aunque el servidor esté en UTC", () => {
    const instant = new Date("2026-07-31T20:17:00-06:00")
    expect(institutionalDateString(instant)).toBe("2026-07-31")
    expect(institutionalDateString(instant)).not.toBe("2026-08-01")
  })

  it("usa la zona predeterminada sin argumento", () => {
    const utcNow = new Date()
    const expected = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(utcNow)
    expect(institutionalDateString()).toBe(expected)
  })

  it("todayForQueryParam devuelve la fecha institucional de hoy", () => {
    const utcNow = new Date()
    const expected = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(utcNow)
    expect(todayForQueryParam()).toBe(expected)
  })

  it("institutionalToday produce una fecha de medianoche local de México", () => {
    const today = institutionalToday()
    expect(institutionalDateString(today)).toBe(institutionalDateString())
  })

  it("institutionalToday devuelve la misma fecha civil al convertirla a ISO (sin retroceder un día)", () => {
    const today = institutionalToday()
    expect(today.toISOString().slice(0, 10)).toBe(institutionalDateString())
    const mexicoHour = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Mexico_City",
      hour: "2-digit",
    }).format(today)
    expect(mexicoHour).toBe("00")
  })
})
