export interface SimMessage {
  role: "user" | "assistant"
  content: string
  presion?: number
  estado?: InquisitorState
  timestamp: number
}

export type InquisitorState = "neutral" | "inquisitivo" | "presionando" | "desaprobando"

export interface AnalysisResult {
  puntajeCalma: number
  puntajeFirmeza: number
  erroresTacticos: string[]
  fortalezas: string[]
  articulosRelevantes: string[]
  resumen: string
}

export async function consultarSimulador(
  history: SimMessage[],
  scenario: string,
  difficulty: number
): Promise<{ respuesta: string; presion: number; estado: InquisitorState }> {
  const res = await fetch("/api/simulador", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "chat", history, scenario, difficulty }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Simulador API error (${res.status}): ${err}`)
  }

  const data = await res.json()
  return {
    respuesta: data.respuesta ?? "Error al obtener respuesta del inquisidor.",
    presion: data.presion ?? 5,
    estado: data.estado ?? "neutral",
  }
}

export async function analizarDesempeno(history: SimMessage[]): Promise<AnalysisResult> {
  const res = await fetch("/api/simulador", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "analyze", history }),
  })

  if (!res.ok) {
    throw new Error(`Análisis API error (${res.status})`)
  }

  return res.json()
}
