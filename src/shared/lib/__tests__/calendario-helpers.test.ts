import { describe, it, expect } from "vitest"
import { isBusinessDay, getNextTramiteDay, getInteractivoNotice } from "@/shared/lib/calendario-helpers"

// Septiembre 2026: 12 sábado, 13 domingo, 14 lunes.
// Interactivo: 1-4 y 17-23. Descanso obligatorio: 15 y 16.
describe("isBusinessDay", () => {
  it("sábado y domingo no son hábiles", () => {
    expect(isBusinessDay(new Date(2026, 8, 12))).toBe(false)
    expect(isBusinessDay(new Date(2026, 8, 13))).toBe(false)
  })

  it("lunes a viernes son hábiles si no hay descanso obligatorio", () => {
    expect(isBusinessDay(new Date(2026, 8, 11))).toBe(true)
    expect(isBusinessDay(new Date(2026, 8, 14))).toBe(true)
    expect(isBusinessDay(new Date(2026, 8, 18))).toBe(true)
  })

  it("un descanso obligatorio entre semana no es hábil", () => {
    expect(isBusinessDay(new Date(2026, 8, 15))).toBe(false)
    expect(isBusinessDay(new Date(2026, 8, 16))).toBe(false)
  })
})

describe("getNextTramiteDay", () => {
  it("desde sábado 12 regresa lunes 14", () => {
    const result = getNextTramiteDay(2026, 8, 12)
    expect(result?.date.getFullYear()).toBe(2026)
    expect(result?.date.getMonth()).toBe(8)
    expect(result?.date.getDate()).toBe(14)
  })

  it("desde domingo 13 regresa lunes 14", () => {
    expect(getNextTramiteDay(2026, 8, 13)?.date.getDate()).toBe(14)
  })

  it("salta descansos obligatorios e interactivo", () => {
    // Desde el martes 15 (descanso) y con interactivo 17-23, el siguiente
    // día hábil disponible es el jueves 24.
    expect(getNextTramiteDay(2026, 8, 15)?.date.getDate()).toBe(24)
  })
})

describe("getInteractivoNotice", () => {
  it("en interactivo devuelve kind interactive", () => {
    const notice = getInteractivoNotice(new Date(2026, 8, 17), true)
    expect(notice.kind).toBe("interactive")
  })

  it("sábado no interactivo indica fin de semana y el lunes 14", () => {
    const notice = getInteractivoNotice(new Date(2026, 8, 12), false)
    expect(notice.kind).toBe("non-business")
    expect(notice.reason).toBe("es fin de semana")
    expect(notice.nextTramiteLabel).toMatch(/lunes/i)
    expect(notice.nextTramiteLabel).toMatch(/14 de septiembre/i)
  })

  it("domingo no interactivo también apunta al lunes", () => {
    const notice = getInteractivoNotice(new Date(2026, 8, 13), false)
    expect(notice.kind).toBe("non-business")
    expect(notice.reason).toBe("es fin de semana")
    expect(notice.nextTramiteLabel).toMatch(/14 de septiembre/i)
  })

  it("viernes hábil devuelve kind free", () => {
    expect(getInteractivoNotice(new Date(2026, 8, 11), false).kind).toBe("free")
  })

  it("día de descanso obligatorio no se trata como fin de semana", () => {
    const notice = getInteractivoNotice(new Date(2026, 8, 16), false)
    expect(notice.kind).toBe("non-business")
    expect(notice.reason).toBe("es día de descanso obligatorio")
  })
})
