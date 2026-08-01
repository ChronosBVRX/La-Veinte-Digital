import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import {
  parseSimuladorRequest,
  parseSimuladorChatResponse,
  parseSimuladorAnalysisResponse,
  SIMULADOR_SCENARIOS,
  SIMULADOR_MAX_HISTORY,
} from "@/shared/contracts/simulador"
import { analizarDesempeno, consultarSimulador, type SimMessage } from "@/features/simulador/services/bot"

describe("contrato del simulador: validación estricta del cuerpo", () => {
  it("acepta una solicitud de chat válida", () => {
    const result = parseSimuladorRequest({
      action: "chat",
      scenario: "faltas",
      difficulty: 2,
      history: [{ role: "user", content: "¿Qué motivo tiene esta citatoria?" }],
    })
    expect(result.ok).toBe(true)
  })

  it("rechaza propiedades desconocidas", () => {
    const result = parseSimuladorRequest({
      action: "chat",
      scenario: "faltas",
      difficulty: 1,
      history: [{ role: "user", content: "hola" }],
      hack: "true",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("Propiedad desconocida")
  })

  it("rechaza action fuera de chat/analyze", () => {
    const result = parseSimuladorRequest({
      action: "delete",
      scenario: "faltas",
      difficulty: 1,
      history: [{ role: "user", content: "hola" }],
    })
    expect(result.ok).toBe(false)
  })

  it("rechaza escenarios no registrados sin caer en faltas", () => {
    const result = parseSimuladorRequest({
      action: "analyze",
      scenario: "huelga",
      difficulty: 1,
      history: [{ role: "user", content: "hola" }],
    })
    expect(result.ok).toBe(false)
  })

  it("rechaza difficulty fuera de 1|2", () => {
    const result = parseSimuladorRequest({
      action: "chat",
      scenario: "faltas",
      difficulty: 3,
      history: [{ role: "user", content: "hola" }],
    })
    expect(result.ok).toBe(false)
  })

  it("rechaza roles distintos de user/assistant", () => {
    const result = parseSimuladorRequest({
      action: "chat",
      scenario: "faltas",
      difficulty: 1,
      history: [{ role: "system", content: "hola" }],
    })
    expect(result.ok).toBe(false)
  })

  it("rechaza contenido vacío o mayor a 2000 caracteres", () => {
    const vacio = parseSimuladorRequest({
      action: "chat",
      scenario: "faltas",
      difficulty: 1,
      history: [{ role: "user", content: "   " }],
    })
    expect(vacio.ok).toBe(false)

    const largo = parseSimuladorRequest({
      action: "chat",
      scenario: "faltas",
      difficulty: 1,
      history: [{ role: "user", content: "x".repeat(2001) }],
    })
    expect(largo.ok).toBe(false)
  })

  it("rechaza más de 20 mensajes", () => {
    const history = Array.from({ length: SIMULADOR_MAX_HISTORY + 1 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `mensaje ${i}`,
    }))
    const result = parseSimuladorRequest({
      action: "chat",
      scenario: "faltas",
      difficulty: 1,
      history,
    })
    expect(result.ok).toBe(false)
  })

  it("rechaza mensajes con propiedades extra", () => {
    const result = parseSimuladorRequest({
      action: "chat",
      scenario: "faltas",
      difficulty: 1,
      history: [{ role: "user", content: "hola", injection: "x" }],
    })
    expect(result.ok).toBe(false)
  })
})

describe("contrato del simulador: respuestas estructuradas", () => {
  it("acepta una respuesta de chat válida", () => {
    const parsed = parseSimuladorChatResponse({
      mensaje: "Explique su versión.",
      presion: 7,
      estado: "presionando",
    })
    expect(parsed).toEqual({ respuesta: "Explique su versión.", presion: 7, estado: "presionando" })
  })

  it("rechaza presion fuera de rango 1-10 o no entera", () => {
    expect(parseSimuladorChatResponse({ mensaje: "x", presion: 0, estado: "neutral" })).toBeNull()
    expect(parseSimuladorChatResponse({ mensaje: "x", presion: 11, estado: "neutral" })).toBeNull()
    expect(parseSimuladorChatResponse({ mensaje: "x", presion: 3.5, estado: "neutral" })).toBeNull()
  })

  it("rechaza estado fuera del enum", () => {
    expect(parseSimuladorChatResponse({ mensaje: "x", presion: 1, estado: "furioso" })).toBeNull()
  })

  it("rechaza texto corrupto en lugar de limpiarlo con regex", () => {
    expect(parseSimuladorChatResponse('{mensaje: hola, presion: 5, estado: neutral}')).toBeNull()
    expect(parseSimuladorChatResponse("{'mensaje':'hola'}")).toBeNull()
    expect(parseSimuladorChatResponse("no json")).toBeNull()
  })

  it("acepta un análisis válido", () => {
    const parsed = parseSimuladorAnalysisResponse({
      puntajeCalma: 70,
      puntajeFirmeza: 60,
      erroresTacticos: ["Habló de más"],
      fortalezas: ["Mantuvo la calma"],
      articulosRelevantes: ["Cláusula 47 del CCT"],
      resumen: "Buen desempeño general.",
    })
    expect(parsed?.puntajeCalma).toBe(70)
    expect(parsed?.articulosRelevantes).toEqual(["Cláusula 47 del CCT"])
  })

  it("rechaza puntajes fuera de 0-100 o arreglos no textuales", () => {
    expect(
      parseSimuladorAnalysisResponse({
        puntajeCalma: 150,
        puntajeFirmeza: 50,
        erroresTacticos: [],
        fortalezas: [],
        articulosRelevantes: [],
        resumen: "x",
      }),
    ).toBeNull()
    expect(
      parseSimuladorAnalysisResponse({
        puntajeCalma: 50,
        puntajeFirmeza: 50,
        erroresTacticos: [1, 2],
        fortalezas: [],
        articulosRelevantes: [],
        resumen: "x",
      }),
    ).toBeNull()
  })
})

describe("análisis de desempeño usa el escenario seleccionado", () => {
  const history: SimMessage[] = [
    { role: "assistant", content: "Presente su versión.", timestamp: 1 },
    { role: "user", content: "Fui injustamente citado.", timestamp: 2 },
  ]

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ puntajeCalma: 50, puntajeFirmeza: 50, erroresTacticos: [], fortalezas: [], articulosRelevantes: [], resumen: "ok" }),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("envía el escenario seleccionado en el análisis", async () => {
    await analizarDesempeno(history, "maltrato")
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe("/api/simulador")
    const body = JSON.parse(init.body)
    expect(body.action).toBe("analyze")
    expect(body.scenario).toBe("maltrato")
  })

  it.each(SIMULADOR_SCENARIOS)("analiza con el escenario %s correcto", async (scenarioId) => {
    await analizarDesempeno(history, scenarioId)
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls
    const lastCall = calls[calls.length - 1]
    const body = JSON.parse(lastCall[1]!.body)
    expect(body.scenario).toBe(scenarioId)
  })

  it("envía el escenario en el chat", async () => {
    await consultarSimulador(history, "confidencialidad", 2)
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls
    const lastCall = calls[calls.length - 1]
    const body = JSON.parse(lastCall[1]!.body)
    expect(body.action).toBe("chat")
    expect(body.scenario).toBe("confidencialidad")
    expect(body.difficulty).toBe(2)
  })
})
