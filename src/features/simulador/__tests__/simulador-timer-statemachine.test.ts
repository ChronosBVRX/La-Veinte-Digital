// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSimulation, SCENARIOS } from "../hooks/useSimulation"
import * as botService from "../services/bot"

describe("Simulador de audiencia: Máquina de 7 estados y tiempos humanos", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("Escenario 1: Transición correcta de estados en inicio de investigación (connecting -> inquisitor_preparing -> question_ready -> reading)", async () => {
    vi.spyOn(botService, "consultarSimulador").mockResolvedValueOnce({
      respuesta: "Lic. Mendoza: Se le cita por faltas injustificadas. ¿Reconoce los hechos?",
      presion: 3,
      estado: "neutral",
    })

    const { result } = renderHook(() => useSimulation())

    expect(result.current.status).toBe("connecting")

    act(() => {
      result.current.startSimulation(SCENARIOS[0], 1)
    })

    // Debe entrar en inquisitor_preparing mientras espera respuesta
    expect(result.current.status).toBe("inquisitor_preparing")
    expect(result.current.loading).toBe(true)

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.status).toBe("question_ready")

    // Tras un breve instante pasa a reading (lectura pausada)
    act(() => {
      vi.advanceTimersByTime(350)
    })

    expect(result.current.status).toBe("reading")
    expect(result.current.loading).toBe(false)
    expect(result.current.messages[0].content).toContain("Lic. Mendoza")
  })

  it("Escenario 2: Tiempos humanos por dificultad (3 min para dif 2, 5 min para dif 1, 7 min configurable)", () => {
    const { result } = renderHook(() => useSimulation())

    act(() => {
      result.current.startSimulation(SCENARIOS[0], 1) // Dificultad 1
    })
    expect(result.current.timerDuration).toBe(300) // 5 minutos = 300s

    act(() => {
      result.current.startSimulation(SCENARIOS[0], 2) // Dificultad 2
    })
    expect(result.current.timerDuration).toBe(180) // 3 minutos = 180s

    act(() => {
      result.current.startSimulation(SCENARIOS[0], 1, 420) // 7 minutos configurable
    })
    expect(result.current.timerDuration).toBe(420) // 7 minutos = 420s
  })

  it("Escenario 3: El trabajador pasa de reading a responding al iniciar respuesta, activando el temporizador", async () => {
    vi.spyOn(botService, "consultarSimulador").mockResolvedValueOnce({
      respuesta: "¿Tiene justificante médico?",
      presion: 4,
      estado: "inquisitivo",
    })

    const { result } = renderHook(() => useSimulation())

    act(() => {
      result.current.startSimulation(SCENARIOS[0], 1)
    })
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      vi.advanceTimersByTime(350)
    })
    expect(result.current.status).toBe("reading")

    // Al dar clic en 'Comenzar respuesta'
    act(() => {
      result.current.startResponding()
    })

    expect(result.current.status).toBe("responding")
  })

  it("Escenario 4: Al enviar respuesta pasa a inquisitor_preparing y luego regresa a question_ready -> reading", async () => {
    vi.spyOn(botService, "consultarSimulador")
      .mockResolvedValueOnce({
        respuesta: "Pregunta inicial",
        presion: 2,
        estado: "neutral",
      })
      .mockResolvedValueOnce({
        respuesta: "Segunda pregunta incisiva",
        presion: 6,
        estado: "presionando",
      })

    const { result } = renderHook(() => useSimulation())

    act(() => {
      result.current.startSimulation(SCENARIOS[0], 1)
    })
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      vi.advanceTimersByTime(350)
    })

    act(() => {
      result.current.startResponding()
    })
    expect(result.current.status).toBe("responding")

    // Enviar respuesta
    act(() => {
      result.current.sendResponse("Estuve incapacitado por riesgo de trabajo")
    })

    expect(result.current.status).toBe("inquisitor_preparing")

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.status).toBe("question_ready")
    act(() => {
      vi.advanceTimersByTime(350)
    })
    expect(result.current.status).toBe("reading")
    expect(result.current.messages[result.current.messages.length - 1].content).toBe("Segunda pregunta incisiva")
  })

  it("Escenario 5: Error recuperable preserva el borrador y permite reintento", async () => {
    vi.spyOn(botService, "consultarSimulador").mockRejectedValueOnce(new Error("Network Error"))

    const { result } = renderHook(() => useSimulation())

    act(() => {
      result.current.startSimulation(SCENARIOS[0], 1)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.status).toBe("error_recoverable")
    expect(result.current.error).toContain("No se pudo conectar")
    expect(result.current.loading).toBe(false)

    // Reintento exitoso
    vi.spyOn(botService, "consultarSimulador").mockResolvedValueOnce({
      respuesta: "Pregunta recuperada",
      presion: 2,
      estado: "neutral",
    })

    act(() => {
      result.current.retryLastResponse("")
    })
    expect(result.current.status).toBe("inquisitor_preparing")

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.status).toBe("question_ready")
  })

  it("Escenario 6: Finalizar la simulación transiciona al estado evaluating y luego a phase report", async () => {
    vi.spyOn(botService, "analizarDesempeno").mockResolvedValueOnce({
      puntajeCalma: 85,
      puntajeFirmeza: 90,
      erroresTacticos: [],
      fortalezas: ["Excelente fundamentación sindical"],
      articulosRelevantes: ["Cláusula 47"],
      resumen: "Desempeño sobresaliente",
    })

    const { result } = renderHook(() => useSimulation())

    act(() => {
      result.current.finishSimulation()
    })

    expect(result.current.status).toBe("evaluating")
    expect(result.current.phase).toBe("report")
    expect(result.current.loading).toBe(true)

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.analysis?.puntajeCalma).toBe(85)
  })
})
