"use client"

import React, { useState, useRef, useEffect } from "react"
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

  // Estado interno para arrastrar la burbuja o la ventana
  const [isDragging, setIsDragging] = useState(false)
  const [bubblePos, setBubblePos] = useState<ChatPosition | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const dragStartRef = useRef<{ startX: number; startY: number; initPosX: number; initPosY: number }>({
    startX: 0,
    startY: 0,
    initPosX: 0,
    initPosY: 0,
  })
  const hasMovedRef = useRef(false)
  const dragTargetRef = useRef<"bubble" | "window">("bubble")
  const widgetRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)

  // Detectar viewport móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeChat()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, closeChat])

  // Drag handler para la burbuja o el header
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, targetType: "bubble" | "window") => {
    const target = e.target as HTMLElement
    if (target.closest("button") && !target.closest(".chat-bubble-toggle")) {
      return
    }

    const currentTarget = e.currentTarget
    try {
      currentTarget.setPointerCapture(e.pointerId)
    } catch {}

    setIsDragging(true)
    hasMovedRef.current = false
    dragTargetRef.current = targetType

    const rect = currentTarget.getBoundingClientRect()
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPosX: rect.left,
      initPosY: rect.top,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return

    const deltaX = e.clientX - dragStartRef.current.startX
    const deltaY = e.clientY - dragStartRef.current.startY

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      hasMovedRef.current = true
    }

    const isTargetBubble = dragTargetRef.current === "bubble"
    const currentElem = isTargetBubble ? bubbleRef.current : widgetRef.current
    const targetWidth = currentElem?.offsetWidth || (isTargetBubble ? 64 : 380)
    const targetHeight = currentElem?.offsetHeight || (isTargetBubble ? 64 : 520)

    const rawX = dragStartRef.current.initPosX + deltaX
    const rawY = dragStartRef.current.initPosY + deltaY

    const maxX = Math.max(0, window.innerWidth - targetWidth - 10)
    const maxY = Math.max(0, window.innerHeight - targetHeight - 10)

    const safeX = Math.max(10, Math.min(maxX, rawX))
    const safeY = Math.max(10, Math.min(maxY, rawY))

    if (isTargetBubble) {
      setBubblePos({ x: safeX, y: safeY })
    } else {
      setPosition({ x: safeX, y: safeY })
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }

  // Manejador del click en la burbuja: abrir si está cerrado, cerrar si está abierto
  const handleBubbleClick = () => {
    if (!hasMovedRef.current) {
      if (isOpen) {
        closeChat()
      } else {
        openChat()
      }
    }
  }

  const bottomNavOffset = isMobile ? 84 : 24
  const rightOffset = isMobile ? 16 : 24

  return (
    <>
      <style>{`
        @keyframes messengerBubblePop {
          0% {
            opacity: 0;
            transform: scale(0.85) translateY(12px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>

      {/* 1. Ventana Flotante del Asistente (abierta) */}
      {isOpen && !isMinimized && (
        <div
          ref={widgetRef}
          role="dialog"
          aria-label="Ventana del asistente laboral"
          style={{
            position: "fixed",
            ...(position
              ? { left: `${position.x}px`, top: `${position.y}px` }
              : isMobile
              ? {
                  left: "12px",
                  right: "12px",
                  bottom: "156px",
                  maxHeight: "calc(100dvh - 176px)",
                }
              : {
                  right: `${rightOffset}px`,
                  bottom: "96px",
                  width: "384px",
                  maxHeight: "calc(100vh - 120px)",
                }),
            height: isMobile ? "min(520px, calc(100dvh - 176px))" : "min(560px, calc(100vh - 120px))",
            zIndex: 49,
            display: "flex",
            flexDirection: "column",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 1rem)",
            boxShadow: "0 20px 48px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.08)",
            overflow: "hidden",
            touchAction: "pan-y",
            transformOrigin: "bottom right",
            animation: "messengerBubblePop 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Cabecera / Drag Handle */}
          <div
            onPointerDown={(e) => handlePointerDown(e, "window")}
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
      )}

      {/* 2. Pastilla Minimizada */}
      {isOpen && isMinimized && (
        <div
          ref={widgetRef}
          onPointerDown={(e) => handlePointerDown(e, "window")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            position: "fixed",
            ...(position
              ? { left: `${position.x}px`, top: `${position.y}px` }
              : isMobile
              ? { right: `${rightOffset}px`, bottom: "156px" }
              : { right: `${rightOffset}px`, bottom: "96px" }),
            width: 260,
            zIndex: 49,
            touchAction: "none",
            userSelect: "none",
            animation: "messengerBubblePop 0.18s ease-out",
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
      )}

      {/* 3. Burbuja Estilo Messenger (Permanece visible en su lugar, se abre y cierra sobre ella misma) */}
      <div
        ref={bubbleRef}
        onPointerDown={(e) => handlePointerDown(e, "bubble")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: "fixed",
          ...(bubblePos
            ? { left: `${bubblePos.x}px`, top: `${bubblePos.y}px` }
            : { right: `${rightOffset}px`, bottom: `${bottomNavOffset}px` }),
          zIndex: 55,
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <button
          onClick={handleBubbleClick}
          aria-label={isOpen ? "Cerrar asistente de derechos" : "Abrir asistente de derechos"}
          title={isOpen ? "Cerrar asistente" : "Abrir asistente de derechos"}
          className="chat-bubble-toggle pressable hover-lift"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            padding: "4px",
            background: isOpen
              ? "linear-gradient(135deg, #1e293b, #0f172a)"
              : "linear-gradient(135deg, var(--primary), #6366f1)",
            color: "#ffffff",
            border: isOpen
              ? "1.5px solid rgba(255, 255, 255, 0.22)"
              : "1.5px solid rgba(255, 255, 255, 0.28)",
            borderRadius: "50%",
            boxShadow: isOpen
              ? "0 8px 24px rgba(0, 0, 0, 0.38), 0 2px 6px rgba(0, 0, 0, 0.2)"
              : "0 8px 24px rgba(37, 99, 235, 0.42), 0 2px 6px rgba(0, 0, 0, 0.16)",
            cursor: isDragging ? "grabbing" : "pointer",
            transition: isDragging
              ? "none"
              : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease, box-shadow 0.2s ease",
            transform: isDragging ? "scale(1.06)" : "scale(1)",
            gap: "2px",
          }}
        >
          {isOpen ? (
            <X size={26} weight="bold" color="#ffffff" style={{ flexShrink: 0 }} />
          ) : (
            <>
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
            </>
          )}
        </button>
      </div>
    </>
  )
}
