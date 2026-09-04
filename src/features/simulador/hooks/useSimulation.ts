"use client"

import { useState, useCallback } from "react"
import { consultarSimulador, analizarDesempeno, type SimMessage, type AnalysisResult } from "../services/bot"
import { SIMULADOR_SCENARIOS, type SimuladorScenarioId } from "@/shared/contracts/simulador"

export type Phase = "disclaimer" | "setup" | "simulation" | "report"

export interface Scenario {
  id: SimuladorScenarioId
  nombre: string
  descripcion: string
  contexto: string
  clausulas: string[]
}

export const SCENARIOS: Scenario[] = SIMULADOR_SCENARIOS.map((id) => {
  const def: Record<string, Omit<Scenario, "id">> = {
    faltas: {
      nombre: "Faltas Injustificadas",
      descripcion: "Se te acusa de haber faltado sin justificación durante 3 días.",
      contexto: "Investigación por ausencias no justificadas.",
      clausulas: ["Cláusula 47 CCT", "Art. 51 Reglamento"],
    },
    maltrato: {
      nombre: "Presunto Maltrato",
      descripcion: "Un compañero presentó queja formal por maltrato verbal.",
      contexto: "Investigación por queja de maltrato.",
      clausulas: ["Cláusula 9 CCT", "Art. 48 Reglamento"],
    },
    incumplimiento: {
      nombre: "Incumplimiento de Funciones",
      descripcion: "Se te señala por no realizar funciones según tu profesiograma.",
      contexto: "Investigación por omisión de funciones laborales.",
      clausulas: ["Cláusula 3 CCT", "Cláusula 45 CCT"],
    },
    extravio: {
      nombre: "Extravío de Insumos",
      descripcion: "Se te responsabiliza por pérdida de materiales ($15,000 aprox).",
      contexto: "Investigación por faltante en inventario bajo tu resguardo.",
      clausulas: ["Cláusula 38 CCT", "Cláusula 52 CCT"],
    },
    retardo: {
      nombre: "Retardos Frecuentes",
      descripcion: "Se te acusa de retardos recurrentes en tu turno.",
      contexto: "Investigación por retardos acumulados.",
      clausulas: ["Cláusula 47 CCT", "Reglamento Interior"],
    },
    confidencialidad: {
      nombre: "Violación de Confidencialidad",
      descripcion: "Presunta divulgación de información sensible del IMSS.",
      contexto: "Investigación por queja anónima sobre filtración de datos.",
      clausulas: ["Cláusula 8 CCT", "Cláusula 42 CCT"],
    },
  }
  return { id, ...def[id] }
})

const INITIAL_INQUISITOR_MSG = "..."

export type SimulationStatus =
  | "connecting"
  | "inquisitor_preparing"
  | "question_ready"
  | "reading"
  | "responding"
  | "evaluating"
  | "error_recoverable"

export function getScenarioDurationSec(scenarioId: SimuladorScenarioId, difficulty: 1 | 2): number {
  if (difficulty === 2) {
    return scenarioId === "extravio" || scenarioId === "confidencialidad" ? 300 : 180
  }
  return scenarioId === "extravio" || scenarioId === "confidencialidad" ? 420 : 300
}

export function useSimulation() {
  const [phase, setPhase] = useState<Phase>("disclaimer")
  const [scenario, setScenarioState] = useState<Scenario>(SCENARIOS[0])
  const [difficulty, setDifficultyState] = useState<1 | 2>(1)
  const [status, setStatus] = useState<SimulationStatus>("connecting")
  const [timerDuration, setTimerDuration] = useState<number>(300) // 5 min default
  const [messages, setMessages] = useState<SimMessage[]>([
    { role: "assistant", content: INITIAL_INQUISITOR_MSG, presion: 1, estado: "neutral", timestamp: 0 },
  ])
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startSimulation = useCallback(async (
    selectedScenario: Scenario,
    selectedDifficulty: 1 | 2,
    customDurationSec?: number,
  ) => {
    setScenarioState(selectedScenario)
    setDifficultyState(selectedDifficulty)
    const duration = customDurationSec ?? getScenarioDurationSec(selectedScenario.id, selectedDifficulty)
    setTimerDuration(duration)
    setPhase("simulation")
    setStatus("connecting")
    setLoading(true)
    setError(null)

    const initialMsg: SimMessage = { role: "assistant", content: "...", presion: 1, estado: "neutral", timestamp: Date.now() }
    setMessages([initialMsg])
    setStatus("inquisitor_preparing")

    try {
      const res = await consultarSimulador(
        [{ role: "user", content: `Iniciar investigación: ${selectedScenario.nombre}`, timestamp: Date.now() }],
        selectedScenario.id,
        selectedDifficulty
      )
      setMessages([
        {
          role: "assistant",
          content: res.respuesta,
          presion: res.presion,
          estado: res.estado,
          timestamp: Date.now(),
        },
      ])
      setStatus("question_ready")
      // Automáticamente pasa a lectura (reloj detenido)
      setTimeout(() => {
        setStatus((curr) => (curr === "question_ready" ? "reading" : curr))
      }, 300)
    } catch {
      setError("No se pudo conectar con el simulador. Verifica que el servicio esté activo.")
      setStatus("error_recoverable")
    } finally {
      setLoading(false)
    }
  }, [])

  const startResponding = useCallback(() => {
    setStatus((curr) => (curr === "reading" || curr === "question_ready" ? "responding" : curr))
  }, [])

  const sendResponse = useCallback(async (text: string) => {
    if (!text.trim() || status === "inquisitor_preparing" || status === "evaluating") return

    const userMsg: SimMessage = { role: "user", content: text.trim(), timestamp: Date.now() }
    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setStatus("inquisitor_preparing")
    setLoading(true)
    setError(null)

    try {
      const res = await consultarSimulador(updatedHistory, scenario.id, difficulty)
      const aiMsg: SimMessage = {
        role: "assistant",
        content: res.respuesta,
        presion: res.presion,
        estado: res.estado,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, aiMsg])
      setStatus("question_ready")
      setTimeout(() => {
        setStatus((curr) => (curr === "question_ready" ? "reading" : curr))
      }, 300)
    } catch {
      setError("Error al comunicarse con el evaluador.")
      setStatus("error_recoverable")
    } finally {
      setLoading(false)
    }
  }, [status, messages, scenario.id, difficulty])

  const retryLastResponse = useCallback(async (text: string) => {
    setError(null)
    if (messages.length <= 1) {
      await startSimulation(scenario, difficulty, timerDuration)
    } else {
      await sendResponse(text)
    }
  }, [messages.length, scenario, difficulty, timerDuration, startSimulation, sendResponse])

  const finishSimulation = useCallback(async () => {
    setStatus("evaluating")
    setLoading(true)
    setPhase("report")

    try {
      const result = await analizarDesempeno(messages, scenario.id)
      setAnalysis(result)
    } catch {
      setAnalysis({
        puntajeCalma: 50,
        puntajeFirmeza: 50,
        erroresTacticos: ["No se pudo completar el análisis automático."],
        fortalezas: ["Finalizaste la simulación."],
        articulosRelevantes: ["Revisa el CCT aplicable con tu representante sindical."],
        resumen: "No se pudo generar el análisis. Consulta a tu representante sindical para retroalimentación personalizada.",
      })
    } finally {
      setLoading(false)
    }
  }, [messages, scenario.id])

  const reset = useCallback(() => {
    setPhase("setup")
    setStatus("connecting")
    setMessages([{ role: "assistant", content: INITIAL_INQUISITOR_MSG, presion: 1, estado: "neutral", timestamp: 0 }])
    setAnalysis(null)
    setError(null)
    setLoading(false)
  }, [])

  return {
    phase, setPhase,
    status, setStatus,
    timerDuration, setTimerDuration,
    scenario, difficulty,
    messages, loading, error, analysis,
    startSimulation, startResponding, sendResponse, retryLastResponse, finishSimulation, reset,
    setScenario: setScenarioState,
    setDifficulty: setDifficultyState,
  }
}
