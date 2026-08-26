"use client"

import { useState, useRef, useCallback } from "react"
import { consultarBot, botErrorMessage, BotError, type BotMessage } from "../services/bot"

export function useChat(initialMessages: BotMessage[]) {
  const [messages, setMessages] = useState<BotMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sendingRef = useRef(false)

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading || sendingRef.current) return

    const last = messages[messages.length - 1]
    if (last && last.role === "user" && last.content === msg) return

    sendingRef.current = true
    const userMsg: BotMessage = { role: "user", content: msg }
    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setInput("")
    setLoading(true)

    try {
      const { respuesta, fuentes, chips } = await consultarBot(updatedHistory)
      setMessages((prev) => [...prev, { role: "assistant", content: respuesta, fuentes, chips }])
    } catch (err) {
      const code = err instanceof BotError ? err.code : "server"
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${botErrorMessage(code)}` },
      ])
    } finally {
      sendingRef.current = false
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, messages])

  return { messages, setMessages, input, setInput, loading, send, inputRef }
}
