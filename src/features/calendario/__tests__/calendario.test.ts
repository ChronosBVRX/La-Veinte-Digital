import { describe, expect, it } from "vitest"
import { generateICS, hasCalendar, isValidMonthIndex } from "@/features/calendario/services/calendarioData"
import { CALENDARIOS } from "@/shared/data/calendario"

describe("calendario institucional", () => {
  it("solo publica el año con calendario oficial (2026)", () => {
    expect(hasCalendar(2026)).toBe(true)
    expect(hasCalendar(2027)).toBe(false)
    expect(hasCalendar(1999)).toBe(false)
  })

  it("2027 no es una copia de 2026", () => {
    expect(CALENDARIOS[2027]).toBeUndefined()
  })

  it("isValidMonthIndex acepta solo 0-11 enteros", () => {
    expect(isValidMonthIndex(0)).toBe(true)
    expect(isValidMonthIndex(11)).toBe(true)
    expect(isValidMonthIndex(12)).toBe(false)
    expect(isValidMonthIndex(-1)).toBe(false)
    expect(isValidMonthIndex(2.5)).toBe(false)
    expect(isValidMonthIndex(NaN)).toBe(false)
  })

  it("generateICS devuelve vacío para año sin calendario", () => {
    expect(generateICS(2027)).toBe("")
    expect(generateICS(1900)).toBe("")
  })

  it("generateICS incluye UID y DTSTAMP en cada evento", () => {
    const ics = generateICS(2026, 0)
    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("UID:imss-2026-01")
    expect(ics.match(/UID:/g)).not.toBeNull()
    expect(ics.match(/DTSTAMP:/g)).not.toBeNull()
    expect(ics.match(/UID:/g)!.length).toBe(ics.match(/DTSTAMP:/g)!.length)
  })

  it("los UID son estables entre generaciones (mismos eventos)", () => {
    const a = generateICS(2026, 3)
    const b = generateICS(2026, 3)
    const uids = (s: string) => s.split("\r\n").filter((l) => l.startsWith("UID:")).sort()
    expect(uids(a)).toEqual(uids(b))
  })
})
