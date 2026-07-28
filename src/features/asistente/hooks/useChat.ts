"use client"

import { useState, useRef, useCallback } from "react"
import { consultarBot, type BotMessage } from "../services/bot"

export function useChat(initialMessages: BotMessage[]) {
  const [messages, setMessages] = useState<BotMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return

    const userMsg: BotMessage = { role: "user", content: msg }
    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setInput("")
    setLoading(true)

    try {
      const respuesta = await consultarBot(updatedHistory)
      setMessages((prev) => [...prev, { role: "assistant", content: respuesta }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ No pude conectar con el servidor. Verifica que el servicio esté activo e intenta de nuevo." },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, messages])

  return { messages, setMessages, input, setInput, loading, send, inputRef }
}
