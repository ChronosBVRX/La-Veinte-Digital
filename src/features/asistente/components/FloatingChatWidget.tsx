"use client"

import React, { useState, useRef, useEffect } from "react"
import { Sparkle, X, Minus, ArrowsOutSimple, DotsSixVertical } from "@phosphor-icons/react"
import { useFloatingChat, type ChatPosition } from "../context/FloatingChatContext"
import { ChatAssistant } from "./ChatAssistant"
import { Z_INDEX } from "@/shared/constants/z-index"
import { useBackLayer } from "@/shared/navigation/useBackLayer"

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

  // Integración canónica con el botón Atrás (Android/navegador)
  useBackLayer(isOpen, closeChat, "floating-chat")

  // Estado interno para arrastrar la burbuja o la ventana
  const [isDragging, setIsDragging] = useState(false)
  const [bubblePos, setBubblePos] = useState<ChatPosition | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const isPointerDownRef = useRef(false)
  const isDraggingRef = useRef(false)
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

  const DRAG_THRESHOLD = 8

  // Detectar viewport móvil respetando el breakpoint canónico del sistema (768px)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
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

  // Drag handler: solo inicia arrastre tras superar el umbral de movimiento (DRAG_THRESHOLD)
  // para permitir clics nativos sin interferencias en web y móvil.
  const handlePointerDown = (e: React.PointerEvent<HTMLElement>, targetType: "bubble" | "window") => {
    if (e.button !== 0) return

    const target = e.target as HTMLElement
    // Si se hizo click en un botón interactivo dentro del header (ej. cerrar o minimizar), no interferir
    if (target.closest("button") && !target.closest(".chat-bubble-toggle")) {
      return
    }

    // En móviles la ventana no se arrastra para evitar desfasarla de la pantalla
    if (targetType === "window" && isMobile) {
      return
    }

    const currentElem = targetType === "bubble" ? bubbleRef.current : widgetRef.current
    if (!currentElem) return

    isPointerDownRef.current = true
    isDraggingRef.current = false
    hasMovedRef.current = false
    dragTargetRef.current = targetType

    const rect = currentElem.getBoundingClientRect()
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPosX: rect.left,
      initPosY: rect.top,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!isPointerDownRef.current) return

    const deltaX = e.clientX - dragStartRef.current.startX
    const deltaY = e.clientY - dragStartRef.current.startY
    const distance = Math.hypot(deltaX, deltaY)

    // Solo capturar puntero y marcar arrastre si se supera el umbral de píxeles
    if (!isDraggingRef.current && distance > DRAG_THRESHOLD) {
      isDraggingRef.current = true
      hasMovedRef.current = true
      setIsDragging(true)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {}
    }

    if (!isDraggingRef.current) return

    const isTargetBubble = dragTargetRef.current === "bubble"
    const currentElem = isTargetBubble ? bubbleRef.current : widgetRef.current
    const targetWidth = currentElem?.offsetWidth || (isTargetBubble ? 64 : 384)
    const targetHeight = currentElem?.offsetHeight || (isTargetBubble ? 64 : 520)

    const rawX = dragStartRef.current.initPosX + deltaX
    const rawY = dragStartRef.current.initPosY + deltaY

    const maxX = Math.max(10, window.innerWidth - targetWidth - 10)
    const maxY = Math.max(10, window.innerHeight - targetHeight - 10)

    const safeX = Math.max(10, Math.min(maxX, rawX))
    const safeY = Math.max(10, Math.min(maxY, rawY))

    if (isTargetBubble) {
      setBubblePos({ x: safeX, y: safeY })
    } else {
      setPosition({ x: safeX, y: safeY })
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false

    if (isDraggingRef.current) {
      isDraggingRef.current = false
      setIsDragging(false)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {}
      setTimeout(() => {
        hasMovedRef.current = false
      }, 60)
      return
    }

    hasMovedRef.current = false
  }

  // Manejador del click en la burbuja: abrir si está cerrado, cerrar si está abierto
  const handleBubbleClick = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (hasMovedRef.current || isDraggingRef.current) {
      return
    }
    if (isOpen) {
      closeChat()
    } else {
      openChat()
    }
  }

  const bottomNavOffset = isMobile ? 76 : 24
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
            zIndex: Z_INDEX.sheet + 10,
            display: "flex",
            flexDirection: "column",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg, 1rem)",
            boxShadow: "0 20px 48px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.08)",
            overflow: "hidden",
            touchAction: "pan-y",
            transformOrigin: isMobile ? "bottom center" : "bottom right",
            animation: "messengerBubblePop 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
            ...(isMobile
              ? {
                  left: "10px",
                  right: "10px",
                  maxWidth: "480px",
                  margin: "0 auto",
                  bottom: `${bottomNavOffset + 68}px`,
                  maxHeight: `calc(var(--visual-viewport-height, 100dvh) - ${bottomNavOffset + 76}px - max(12px, env(safe-area-inset-top, 12px)))`,
                  height: `min(540px, calc(var(--visual-viewport-height, 100dvh) - ${bottomNavOffset + 76}px - max(12px, env(safe-area-inset-top, 12px))))`,
                }
              : position
              ? {
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  width: "384px",
                  maxWidth: "calc(100vw - 20px)",
                  maxHeight: "calc(100vh - 40px)",
                  height: "min(560px, calc(100vh - 120px))",
                }
              : {
                  right: `${rightOffset}px`,
                  bottom: "96px",
                  width: "384px",
                  maxWidth: "calc(100vw - 32px)",
                  maxHeight: "calc(100vh - 120px)",
                  height: "min(560px, calc(100vh - 120px))",
                }),
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
              cursor: isMobile ? "default" : isDragging ? "grabbing" : "grab",
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
            zIndex: Z_INDEX.sheet + 10,
            touchAction: "none",
            userSelect: "none",
            animation: "messengerBubblePop 0.18s ease-out",
            ...(isMobile
              ? {
                  right: `${rightOffset}px`,
                  bottom: `${bottomNavOffset + 68}px`,
                  width: "min(260px, calc(100vw - 32px))",
                  maxWidth: "calc(100vw - 32px)",
                }
              : position
              ? {
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  width: 260,
                  maxWidth: "calc(100vw - 32px)",
                }
              : {
                  right: `${rightOffset}px`,
                  bottom: "96px",
                  width: 260,
                  maxWidth: "calc(100vw - 32px)",
                }),
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
          zIndex: Z_INDEX.sheet + 15,
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
            width: isMobile ? 58 : 64,
            height: isMobile ? 58 : 64,
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
                  fontSize: isMobile ? "0.58rem" : "0.62rem",
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
