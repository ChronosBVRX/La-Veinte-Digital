import { afterEach, describe, expect, it, vi } from "vitest"
import { consultarBot, botErrorMessage, BotError } from "../services/bot"

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response
}

describe("bot service", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("devuelve la respuesta del servidor junto con sus fuentes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { respuesta: "Hola", fuentes: [{ documento: "CCT" }], chips: ["Ayúdame"] })))
    await expect(consultarBot([{ role: "user", content: "hola" }])).resolves.toEqual({
      respuesta: "Hola",
      fuentes: [{ documento: "CCT" }],
      chips: ["Ayúdame"],
    })
  })

  it("fuentes ausentes se normalizan a arreglo vacío", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { respuesta: "Hola" })))
    await expect(consultarBot([{ role: "user", content: "hola" }])).resolves.toEqual({
      respuesta: "Hola",
      fuentes: [],
      chips: [],
    })
  })

  it("clasifica 429 como cuota agotada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(429, {})))
    await expect(consultarBot([])).rejects.toBeInstanceOf(BotError)
    await expect(consultarBot([])).rejects.toMatchObject({ code: "quota" })
  })

  it("clasifica errores 5xx como del servidor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(503, "unavailable")))
    await expect(consultarBot([])).rejects.toMatchObject({ code: "server" })
  })

  it("clasifica fallos de red como network", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
    await expect(consultarBot([])).rejects.toMatchObject({ code: "network" })
  })

  it("clasifica respuestas sin contenido como empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {})))
    await expect(consultarBot([])).rejects.toMatchObject({ code: "empty" })
  })

  it("botErrorMessage cubre todos los códigos", () => {
    const codes = ["network", "quota", "server", "empty"] as const
    for (const code of codes) {
      expect(botErrorMessage(code).length).toBeGreaterThan(10)
    }
  })
})
