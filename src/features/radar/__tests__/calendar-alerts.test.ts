import { describe, it, expect } from "vitest"
import { evaluateCalendarDate, getUpcomingCalendarAlerts } from "../services/calendar-alerts-service"

describe("Calendar Alerts Service", () => {
  it("detects Santander / Scotiabank payment date correctly (Enero 12, 2026)", () => {
    const res = evaluateCalendarDate(2026, 0, 12)
    expect(res.hasEvents).toBe(true)
    const santander = res.alerts.find((a) => a.kind === "pago_santander")
    expect(santander).toBeDefined()
    expect(santander?.title).toBe("Hoy pagan en Santander y Scotiabank")
    expect(res.pushPayload?.title).toBe("Hoy pagan en Santander y Scotiabank")
  })

  it("detects Banamex, Banorte, BBVA payment date correctly (Enero 13, 2026)", () => {
    const res = evaluateCalendarDate(2026, 0, 13)
    expect(res.hasEvents).toBe(true)
    const otros = res.alerts.find((a) => a.kind === "pago_otros_bancos")
    expect(otros).toBeDefined()
    expect(otros?.title).toBe("Hoy pagan en Banamex, Banorte, BBVA y demás bancos")
  })

  it("detects cheque payment date (Enero 14, 2026)", () => {
    const res = evaluateCalendarDate(2026, 0, 14)
    expect(res.hasEvents).toBe(true)
    const cheque = res.alerts.find((a) => a.kind === "pago_cheque")
    expect(cheque).toBeDefined()
    expect(cheque?.title).toBe("Hoy es el día de pago con cheque")
  })

  it("detects vacation start date (Enero 16, 2026)", () => {
    const res = evaluateCalendarDate(2026, 0, 16)
    expect(res.hasEvents).toBe(true)
    const vacacional = res.alerts.find((a) => a.kind === "inicio_vacaciones")
    expect(vacacional).toBeDefined()
    expect(vacacional?.title).toBe("Hoy inicia periodo vacacional")
  })

  it("detects start of interactive period on day 1 (Enero 1, 2026)", () => {
    const res = evaluateCalendarDate(2026, 0, 1)
    expect(res.hasEvents).toBe(true)
    const inicioInteractivo = res.alerts.find((a) => a.kind === "inicio_interactivo")
    expect(inicioInteractivo).toBeDefined()
    expect(inicioInteractivo?.title).toBe("Hoy inicia periodo de interactivo")
  })

  it("detects end of interactive period on day 7 (Enero 7, 2026)", () => {
    const res = evaluateCalendarDate(2026, 0, 7)
    expect(res.hasEvents).toBe(true)
    const finInteractivo = res.alerts.find((a) => a.kind === "fin_interactivo")
    expect(finInteractivo).toBeDefined()
    expect(finInteractivo?.title).toBe("Hoy termina periodo de interactivo")
  })

  it("detects retirees payment date (Enero 31, 2026)", () => {
    const res = evaluateCalendarDate(2026, 0, 31)
    expect(res.hasEvents).toBe(true)
    const jub = res.alerts.find((a) => a.kind === "pago_jubilados")
    expect(jub).toBeDefined()
    expect(jub?.title).toBe("Hoy pagan a jubilados y pensionados")
  })

  it("returns multiple events combined in pushPayload when on same day", () => {
    // Enero 16 has vacacional (16) AND interactivo (16 is start of [16..23])
    const res = evaluateCalendarDate(2026, 0, 16)
    expect(res.alerts.length).toBeGreaterThanOrEqual(2)
    expect(res.pushPayload?.title).toBe("Avisos de Nómina y Calendario Laboral")
    expect(res.pushPayload?.body).toContain("Hoy inicia periodo vacacional")
    expect(res.pushPayload?.body).toContain("Hoy inicia periodo de interactivo")
  })

  it("projects upcoming calendar alerts for next days", () => {
    const fromDate = new Date(2026, 0, 10) // Enero 10, 2026
    const upcoming = getUpcomingCalendarAlerts(7, fromDate)
    expect(upcoming.length).toBeGreaterThan(0)
    const dates = upcoming.map((u) => u.date)
    expect(dates).toContain("2026-01-12") // Santander
    expect(dates).toContain("2026-01-13") // Otros bancos
  })
})
