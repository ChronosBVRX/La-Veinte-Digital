"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/shared/components/ui/Button"
import { useBackLayer } from "@/shared/navigation/useBackLayer"
import { dataUrlToBlob, saveBlobResource, deleteBlobResource } from "../services/escritos-indexeddb"

interface SignaturePadModalProps {
  userId: string
  escritoId: string
  previousFirmaRef?: string
  isOpen: boolean
  onClose: () => void
  onSave: (firmaRef: string, previewUrl: string) => void
}

export function SignaturePadModal({
  userId,
  escritoId,
  previousFirmaRef,
  isOpen,
  onClose,
  onSave,
}: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokeWidth, setStrokeWidth] = useState(2.5)
  const [hasContent, setHasContent] = useState(false)
  const [history, setHistory] = useState<ImageData[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement | null>(null)

  // Capa transitoria canónica: Atrás cierra el pad (mismo onClose que Escape).
  useBackLayer(isOpen, onClose, "signature-pad")

  useEffect(() => {
    if (!isOpen) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Ajustar resolución del canvas para pantallas retina / móviles
    const ratio = window.devicePixelRatio || 1
    const width = Math.max(240, Math.min(window.innerWidth - 72, 480))
    const height = Math.min(200, Math.max(160, Math.round(width * 0.5)))

    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = `${width}px`
    canvas.style.maxWidth = "100%"
    canvas.style.height = `${height}px`

    ctx.scale(ratio, ratio)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0f172a"
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)

    setHasContent(false)
    setHistory([])

    // Focus inicial
    modalRef.current?.focus()

    // Manejador Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    if ("touches" in e) {
      const touch = e.touches[0]
      if (!touch) return { x: 0, y: 0 }
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    }
  }

  const saveHistorySnapshot = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setHistory((prev) => [...prev.slice(-15), snapshot])
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    saveHistorySnapshot()
    setIsDrawing(true)
    setHasContent(true)

    const coords = getCoordinates(e)
    ctx.lineWidth = strokeWidth
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const coords = getCoordinates(e)
    ctx.lineWidth = strokeWidth
    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const ratio = window.devicePixelRatio || 1

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#0f172a"

    setHasContent(false)
    setHistory([])
  }

  const undoLastStroke = () => {
    const canvas = canvasRef.current
    if (!canvas || history.length === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const newHistory = [...history]
    const last = newHistory.pop()
    setHistory(newHistory)

    if (last) {
      ctx.putImageData(last, 0, 0)
      if (newHistory.length === 0) {
        setHasContent(false)
      }
    }
  }

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasContent) return
    setIsSaving(true)

    try {
      const dataUrl = canvas.toDataURL("image/png")
      const blob = dataUrlToBlob(dataUrl)
      const storageRef = await saveBlobResource(
        userId,
        escritoId,
        "firma",
        `sig_${Date.now()}`,
        blob
      )
      if (previousFirmaRef && previousFirmaRef !== storageRef) {
        await deleteBlobResource(userId, previousFirmaRef).catch(() => {})
      }
      const previewUrl = URL.createObjectURL(blob)
      onSave(storageRef, previewUrl)
      onClose()
    } catch (err) {
      console.error("Error guardando firma en IndexedDB:", err)
      alert("No se pudo guardar la firma digital. Intenta nuevamente.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signature-title"
      ref={modalRef}
      tabIndex={-1}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "0.75rem",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "var(--card)",
          borderRadius: "1rem",
          padding: "clamp(0.875rem, 3vw, 1.5rem)",
          maxWidth: "500px",
          width: "100%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          border: "1px solid var(--border)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h3 id="signature-title" style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "var(--fg)" }}>
              ✍️ Firma Digitalizada
            </h3>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
              Dibuja tu firma con tu dedo o puntero para insertarla en el oficio.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal de firma"
            style={{
              background: "none",
              border: "none",
              fontSize: "1.25rem",
              cursor: "pointer",
              color: "var(--muted)",
              padding: "0.25rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Lienzo */}
        <div
          style={{
            border: "2px dashed var(--border)",
            borderRadius: "0.75rem",
            overflow: "hidden",
            background: "#ffffff",
            touchAction: "none",
            display: "flex",
            justifyContent: "center",
            marginBottom: "1rem",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ cursor: "crosshair", display: "block", touchAction: "none", maxWidth: "100%" }}
          />
        </div>

        {/* Controles de trazo y acciones */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Grosor:</span>
            {[1.5, 2.5, 4].map((width) => (
              <button
                key={width}
                type="button"
                onClick={() => setStrokeWidth(width)}
                style={{
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.75rem",
                  borderRadius: "0.375rem",
                  border: strokeWidth === width ? "2px solid var(--primary)" : "1px solid var(--border)",
                  background: strokeWidth === width ? "var(--accent)" : "transparent",
                  color: "var(--fg)",
                  cursor: "pointer",
                }}
              >
                {width === 1.5 ? "Fino" : width === 2.5 ? "Normal" : "Grueso"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.375rem" }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={undoLastStroke}
              disabled={history.length === 0}
            >
              ↩ Deshacer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCanvas}
              disabled={!hasContent}
            >
              🗑 Limpiar
            </Button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "0.5rem" }}>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!hasContent || isSaving}
            loading={isSaving}
          >
            Guardar Firma
          </Button>
        </div>
      </div>
    </div>
  )
}
