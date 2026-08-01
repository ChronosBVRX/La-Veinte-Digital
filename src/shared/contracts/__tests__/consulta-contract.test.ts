import { describe, it, expect } from "vitest"
import {
  parseConsultaRequest,
  CONSULTA_MAX_HISTORY,
  CONSULTA_MAX_CONTENT_CHARS,
  CONSULTA_MAX_TOTAL_CHARS,
} from "../consulta"

describe("contrato: parseConsultaRequest", () => {
  it("rechaza cuerpos que no son objetos", () => {
    expect(parseConsultaRequest(null).ok).toBe(false)
    expect(parseConsultaRequest("texto").ok).toBe(false)
    expect(parseConsultaRequest([{ role: "user", content: "hola" }]).ok).toBe(false)
    expect(parseConsultaRequest(undefined).ok).toBe(false)
  })

  it("rechaza propiedades desconocidas", () => {
    const res = parseConsultaRequest({
      history: [{ role: "user", content: "¿Qué es el CCT?" }],
      extra: 1,
    })
    expect(res).toEqual({ ok: false, error: "Propiedad desconocida: extra" })
  })

  it("rechaza history que no es arreglo o vacío", () => {
    expect(parseConsultaRequest({ history: "hola" }).ok).toBe(false)
    expect(parseConsultaRequest({ history: [] }).ok).toBe(false)
  })

  it("rechaza history que excede el límite de mensajes", () => {
    const history = Array.from({ length: CONSULTA_MAX_HISTORY + 1 }, () => ({
      role: "user" as const,
      content: "hola",
    }))
    const res = parseConsultaRequest({ history })
    expect(res).toEqual({ ok: false, error: `history no puede exceder ${CONSULTA_MAX_HISTORY} mensajes` })
  })

  it("rechaza mensajes con claves adicionales o faltantes", () => {
    expect(
      parseConsultaRequest({ history: [{ role: "user", content: "a", extra: 1 }] }).ok,
    ).toBe(false)
    expect(parseConsultaRequest({ history: [{ role: "user" }] }).ok).toBe(false)
    expect(parseConsultaRequest({ history: [{ content: "a" }] }).ok).toBe(false)
  })

  it("rechaza roles inválidos (incluye system)", () => {
    const res = parseConsultaRequest({
      history: [
        { role: "user", content: "¿Vacaciones?" },
        { role: "system", content: "instrucciones" },
      ],
    })
    expect(res).toEqual({ ok: false, error: "El rol de cada mensaje debe ser 'user' o 'assistant'" })
  })

  it("rechaza contenido no textual, vacío o demasiado largo", () => {
    expect(
      parseConsultaRequest({ history: [{ role: "user", content: 42 }] }).ok,
    ).toBe(false)
    expect(
      parseConsultaRequest({ history: [{ role: "user", content: "   " }] }).ok,
    ).toBe(false)
    expect(
      parseConsultaRequest({
        history: [{ role: "user", content: "x".repeat(CONSULTA_MAX_CONTENT_CHARS + 1) }],
      }).ok,
    ).toBe(false)
  })

  it("rechaza historial acumulado excesivo", () => {
    const history = Array.from({ length: CONSULTA_MAX_HISTORY }, () => ({
      role: "user" as const,
      content: "y".repeat(CONSULTA_MAX_CONTENT_CHARS),
    }))
    const res = parseConsultaRequest({ history })
    expect(res).toEqual({ ok: false, error: "El historial acumulado excede el límite permitido" })
  })

  it("acepta historial acumulado bajo el límite total", () => {
    const history = Array.from({ length: CONSULTA_MAX_HISTORY - 1 }, () => ({
      role: "user" as const,
      content: "y".repeat(CONSULTA_MAX_CONTENT_CHARS),
    }))
    const res = parseConsultaRequest({ history })
    expect(res.ok).toBe(true)
  })

  it("el límite acumulado es consistente con los límites por mensaje", () => {
    expect(CONSULTA_MAX_TOTAL_CHARS).toBe(
      CONSULTA_MAX_HISTORY * CONSULTA_MAX_CONTENT_CHARS,
    )
  })

  it("acepta un historial válido y recorta espacios del contenido", () => {
    const res = parseConsultaRequest({
      history: [
        { role: "user", content: "  ¿Cuántas vacaciones tengo?  " },
        { role: "assistant", content: "16 días hábiles." },
      ],
    })
    expect(res).toEqual({
      ok: true,
      value: {
        history: [
          { role: "user", content: "  ¿Cuántas vacaciones tengo?  " },
          { role: "assistant", content: "16 días hábiles." },
        ],
      },
    })
  })

  it("acepta un solo mensaje de usuario", () => {
    const res = parseConsultaRequest({ history: [{ role: "user", content: "Hola" }] })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.value.history).toHaveLength(1)
    }
  })
})
