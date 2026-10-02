"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"

export interface ChatPosition {
  x: number
  y: number
}

interface FloatingChatContextType {
  isOpen: boolean
  isMinimized: boolean
  position: ChatPosition | null
  openChat: () => void
  closeChat: () => void
  minimizeChat: () => void
  restoreChat: () => void
  toggleChat: () => void
  setPosition: (pos: ChatPosition) => void
}

const FloatingChatContext = createContext<FloatingChatContextType | undefined>(undefined)

const STORAGE_KEY_POS = "lvd_floating_chat_pos"
const STORAGE_KEY_OPEN = "lvd_floating_chat_open"

function SearchParamsListener({ onOpen }: { onOpen: () => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    if (!searchParams) return
    const chatParam = searchParams.get("chat") || searchParams.get("asistente")
    if (chatParam === "open" || chatParam === "1" || chatParam === "true") {
      onOpen()
    }
  }, [searchParams, onOpen])
  return null
}

export function FloatingChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPositionState] = useState<ChatPosition | null>(() => {
    if (typeof window === "undefined") return null
    try {
      const savedPos = localStorage.getItem(STORAGE_KEY_POS)
      if (savedPos) {
        const parsed = JSON.parse(savedPos)
        if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
          const safeX = Math.max(10, Math.min(window.innerWidth - 80, parsed.x))
          const safeY = Math.max(10, Math.min(window.innerHeight - 80, parsed.y))
          return { x: safeX, y: safeY }
        }
      }
    } catch {
      // Ignorar errores de lectura
    }
    return null
  })

  const setPosition = useCallback((pos: ChatPosition) => {
    setPositionState(pos)
    try {
      localStorage.setItem(STORAGE_KEY_POS, JSON.stringify(pos))
    } catch {
      // Noop
    }
  }, [])

  const openChat = useCallback(() => {
    setIsOpen(true)
    setIsMinimized(false)
    try {
      localStorage.setItem(STORAGE_KEY_OPEN, "1")
    } catch {}
  }, [])

  const closeChat = useCallback(() => {
    setIsOpen(false)
    setIsMinimized(false)
    try {
      localStorage.removeItem(STORAGE_KEY_OPEN)
    } catch {}
  }, [])

  const minimizeChat = useCallback(() => {
    setIsMinimized(true)
  }, [])

  const restoreChat = useCallback(() => {
    setIsOpen(true)
    setIsMinimized(false)
  }, [])

  const toggleChat = useCallback(() => {
    if (!isOpen) {
      openChat()
    } else if (isMinimized) {
      restoreChat()
    } else {
      closeChat()
    }
  }, [isOpen, isMinimized, openChat, restoreChat, closeChat])

  return (
    <FloatingChatContext.Provider
      value={{
        isOpen,
        isMinimized,
        position,
        openChat,
        closeChat,
        minimizeChat,
        restoreChat,
        toggleChat,
        setPosition,
      }}
    >
      <React.Suspense fallback={null}>
        <SearchParamsListener onOpen={openChat} />
      </React.Suspense>
      {children}
    </FloatingChatContext.Provider>
  )
}

export function useFloatingChat(): FloatingChatContextType {
  const context = useContext(FloatingChatContext)
  if (!context) {
    throw new Error("useFloatingChat debe utilizarse dentro de un FloatingChatProvider")
  }
  return context
}
