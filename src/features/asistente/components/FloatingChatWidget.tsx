"use client"

import React, { useState, useRef, useCallback } from "react"
import { Sparkle, X, Minus, ArrowsOutSimple, DotsSixVertical } from "@phosphor-icons/react"
import { useFloatingChat, type ChatPosition } from "../context/FloatingChatContext"
import { ChatAssistant } from "./ChatAssistant"

export function FloatingChatWidget() {
  const {
    isOpen,
    isMinimized,
    position,
    openChat,
    closeChat,
    minimizeChat,
    restoreChat,
    setPosition,
  } = useFloatingChat()

  // Estado interno para arrastrar
  const [isDragging, setIsDragging] = useState(false)
  const [bubblePos, setBubblePos] = useState<ChatPosition | null>(null)
  const dragStartRef = useRef<{ startX: number; startY: number; initPosX: number; initPosY: number }>({
    startX: 0,
    startY: 0,
    initPosX: 0,
    initPosY: 0,
  })
  const hasMovedRef = useRef(false)
  const widgetRef = useRef<HTMLDivElement>(null)

  // Obtener posición inicial por defecto si no hay en localStorage
  const getDefaultPosition = useCallback((): ChatPosition => {
    if (typeof window === "undefined") return { x: 20, y: 80 }
    const isMobile = window.innerWidth < 640
    const w = isMobile ? Math.min(window.innerWidth - 20, 360) : 380
    const h = isMinimized ? 44 : 540
    // Ubicar en esquina inferior derecha
    const bottomNavOffset = isMobile ? 80 : 24
    return {
      x: Math.max(12, window.innerWidth - w - 16),
      y: Math.max(12, window.innerHeight - h - bottomNavOffset),
    }
  }, [isMinimized])

  // Inicializar o ajustar posición
  const currentPos = position ?? getDefaultPosition()

  // Manejador de inicio de arrastre (pointer down)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Si hace click en botones de control (minimizar, cerrar), no iniciar arrastre
    const target = e.target as HTMLElement
    if (target.closest("button") || target.closest("textarea") || target.closest("a")) {
      return
    }

    const currentTarget = e.currentTarget
    currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    hasMovedRef.current = false

    const rect = currentTarget.getBoundingClientRect()
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPosX: rect.left,
      initPosY: rect.top,
    }
  }

  // Manejador de movimiento durante arrastre
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return

    const deltaX = e.clientX - dragStartRef.current.startX
    const deltaY = e.clientY - dragStartRef.current.startY

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      hasMovedRef.current = true
    }

    const widgetWidth = widgetRef.current?.offsetWidth || (isOpen ? (isMinimized ? 240 : 380) : 64)
    const widgetHeight = widgetRef.current?.offsetHeight || (isOpen ? (isMinimized ? 44 : 520) : 64)

    const rawX = dragStartRef.current.initPosX + deltaX
    const rawY = dragStartRef.current.initPosY + deltaY

    // Clamping para que no se salga de los límites de la ventana
    const maxX = Math.max(0, window.innerWidth - widgetWidth - 10)
    const maxY = Math.max(0, window.innerHeight - widgetHeight - 10)

    const safeX = Math.max(10, Math.min(maxX, rawX))
    const safeY = Math.max(10, Math.min(maxY, rawY))

    if (!isOpen) {
      setBubblePos({ x: safeX, y: safeY })
    } else {
      setPosition({ x: safeX, y: safeY })
    }
  }

  // Manejador de finalización de arrastre
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }

  // Manejador de click en el FAB cerrado
  const handleFabClick = () => {
    // Si fue arrastrado intencionalmente, no abrir por error
    if (!hasMovedRef.current) {
      openChat()
    }
  }

  // Si está completamente cerrado -> Botón Flotante Redondo (Burbuja)
  if (!isOpen) {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640
    const bottomNavOffset = isMobile ? 84 : 24
    const rightOffset = isMobile ? 16 : 24

    return (
      <div
        ref={widgetRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: "fixed",
          ...(bubblePos
            ? { left: `${bubblePos.x}px`, top: `${bubblePos.y}px` }
            : { right: `${rightOffset}px`, bottom: `${bottomNavOffset}px` }),
          zIndex: 45,
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <button
          onClick={handleFabClick}
          aria-label="Abrir asistente de derechos"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            padding: "4px",
            background: "linear-gradient(135deg, var(--primary), #6366f1)",
            color: "#ffffff",
            border: "1.5px solid rgba(255, 255, 255, 0.28)",
            borderRadius: "50%",
            boxShadow: "0 8px 24px rgba(37, 99, 235, 0.42), 0 2px 6px rgba(0, 0, 0, 0.16)",
            cursor: isDragging ? "grabbing" : "pointer",
            transition: isDragging ? "none" : "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease",
            transform: isDragging ? "scale(1.06)" : "scale(1)",
            gap: "2px",
          }}
          className="pressable"
        >
          <Sparkle size={18} weight="duotone" color="#ffffff" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontSize: "0.62rem",
              fontWeight: 700,
              lineHeight: 1.15,
              textAlign: "center",
              letterSpacing: "-0.01em",
              color: "#ffffff",
              whiteSpace: "pre-line",
            }}
          >
            {"¿Necesitas\nayuda?"}
          </span>
        </button>
      </div>
    )
  }

  // Si está minimizado -> Pastilla compacta
  if (isMinimized) {
    return (
      <div
        ref={widgetRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: "fixed",
          left: `${currentPos.x}px`,
          top: `${currentPos.y}px`,
          width: 260,
          zIndex: 45,
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md, 0.75rem)",
            padding: "0.45rem 0.65rem",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.14)",
            cursor: isDragging ? "grabbing" : "grab",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
            <DotsSixVertical size={16} color="var(--muted)" />
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--fg)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Asistente laboral
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
            <button
              onClick={restoreChat}
              aria-label="Restaurar chat"
              title="Restaurar"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                padding: "0.25rem",
                borderRadius: "0.375rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowsOutSimple size={16} />
            </button>
            <button
              onClick={closeChat}
              aria-label="Cerrar chat"
              title="Cerrar"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                padding: "0.25rem",
                borderRadius: "0.375rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Estado abierto normal -> Ventana Flotante Interactiva
  return (
    <div
      ref={widgetRef}
      style={{
        position: "fixed",
        left: `${currentPos.x}px`,
        top: `${currentPos.y}px`,
        width: "min(390px, calc(100vw - 20px))",
        height: "min(550px, calc(100dvh - 36px))",
        zIndex: 45,
        display: "flex",
        flexDirection: "column",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg, 1rem)",
        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.08)",
        overflow: "hidden",
        touchAction: "pan-y",
      }}
    >
      {/* Cabecera / Drag Handle */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.65rem 0.85rem",
          background: "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(99,102,241,0.06))",
          borderBottom: "1px solid var(--border)",
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "0.45rem",
              background: "linear-gradient(135deg, var(--primary), #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Sparkle size={16} color="white" weight="duotone" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--fg)" }}>
                Asistente laboral
              </span>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22c55e",
                  display: "inline-block",
                }}
              />
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
              Pregunta sobre el CCT y tus derechos
            </div>
          </div>
        </div>

        {/* Acciones de ventana: Minimizar y Cerrar */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
          <button
            onClick={minimizeChat}
            aria-label="Minimizar chat"
            title="Minimizar"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              padding: "0.3rem",
              borderRadius: "0.375rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Minus size={16} />
          </button>
          <button
            onClick={closeChat}
            aria-label="Cerrar chat"
            title="Cerrar"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              padding: "0.3rem",
              borderRadius: "0.375rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Cuerpo del Asistente */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          padding: "0.75rem",
          overflow: "hidden",
        }}
      >
        <ChatAssistant showHeader={false} />
      </div>
    </div>
  )
}
