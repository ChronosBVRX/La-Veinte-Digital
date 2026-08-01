export interface BotMessage {
  role: "user" | "assistant"
  content: string
}

export async function consultarBot(history: BotMessage[]): Promise<string> {
  const res = await fetch("/api/consulta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bot API error (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.respuesta ?? data.error ?? "Error al obtener respuesta"
}
