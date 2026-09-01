"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/shared/components/ui/Button"

interface SignaturePadModalProps {
  open: boolean
  firmaActual?: string
  onSave: (dataUrl: string) => void
  onRemove?: () => void
  onClose: () => void
}

export function SignaturePadModal({
  open,
  firmaActual,
  onSave,
  onRemove,
  onClose,
}: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
    const rect = canvas.getBoundingClientRect()
    const width = rect.width || 400
    const height = rect.height || 180

    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)

    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0f172a"
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setupCanvas()
      setHasDrawn(false)
    }, 50)
    return () => clearTimeout(timer)
  }, [open, setupCanvas])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ("touches" in e) {
      const touch = e.touches[0]
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { x, y } = getCanvasCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
    setHasDrawn(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { x, y } = getCanvasCoords(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const handleLimpiar = () => {
    setupCanvas()
    setHasDrawn(false)
  }

  const handleGuardar = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    onSave(dataUrl)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signature-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 15, 25, 0.85)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "1rem",
          maxWidth: 520,
          width: "100%",
          padding: "1.5rem",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2
              id="signature-modal-title"
              style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}
            >
              ✍ Firma manuscrita
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
              Dibuja tu firma con el dedo o mouse para plasmarla en el documento impreso.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar ventana de firma"
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.25rem",
              color: "var(--muted)",
              cursor: "pointer",
              padding: "0.25rem",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            height: 180,
            background: "#ffffff",
            borderRadius: "0.5rem",
            border: "2px dashed var(--border)",
            overflow: "hidden",
            touchAction: "none",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", cursor: "crosshair", display: "block" }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {!hasDrawn && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                color: "#94a3b8",
                fontSize: "0.875rem",
                userSelect: "none",
              }}
            >
              Firma aquí
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button variant="ghost" size="sm" onClick={handleLimpiar}>
              Limpiar trazo
            </Button>
            {firmaActual && onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onRemove()
                  onClose()
                }}
                style={{ color: "#ef4444" }}
              >
                Quitar firma
              </Button>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleGuardar} disabled={!hasDrawn}>
              Aplicar firma
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
