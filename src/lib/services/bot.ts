const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL ?? ""

export interface BotMessage {
  role: "user" | "assistant"
  content: string
}

export async function consultarBot(history: BotMessage[]): Promise<string> {
  const url = BOT_API_URL ? `${BOT_API_URL}/consulta` : "/api/consulta"
  const res = await fetch(url, {
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
