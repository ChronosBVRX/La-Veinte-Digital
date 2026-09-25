"use client"

import { useRef, useState, useEffect, useCallback, useSyncExternalStore } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Modal } from "@/shared/components/ui/Modal"
import { FullscreenPortal } from "@/shared/components/ui/FullscreenPortal"
import { ArrowLeft, X } from "@phosphor-icons/react"
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

const emptySubscribe = () => () => {}

function useIsMobile(query = "(max-width: 768px)"): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return emptySubscribe()
      const mql = window.matchMedia(query)
      mql.addEventListener("change", callback)
      return () => mql.removeEventListener("change", callback)
    },
    [query]
  )

  const getSnapshot = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false
    return window.matchMedia(query).matches
  }

  const getServerSnapshot = () => false

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function SignaturePadModal({
  userId,
  escritoId,
  previousFirmaRef,
  isOpen,
  onClose,
  onSave,
}: SignaturePadModalProps) {
  const isMobile = useIsMobile()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokeWidth, setStrokeWidth] = useState(2.5)
  const [hasContent, setHasContent] = useState(false)
  const [history, setHistory] = useState<ImageData[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Capa transitoria canónica: Atrás cierra el pad en Android/móvil
  useBackLayer(isOpen, onClose, "signature-pad")

  useEffect(() => {
    if (!isOpen) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const ratio = window.devicePixelRatio || 1
    // En móvil pantalla completa ofrecemos un canvas mucho más amplio para trazos cómodos con dedo/stylus
    const width = isMobile
      ? Math.max(280, Math.min(window.innerWidth - 32, 600))
      : Math.max(280, Math.min(window.innerWidth - 72, 540))
    const height = isMobile
      ? Math.min(320, Math.max(200, Math.round(window.innerHeight * 0.38)))
      : 220

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
  }, [isOpen, isMobile])

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
    setHistory((prev) => [...prev.slice(-10), snapshot])
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    saveHistorySnapshot()
    setIsDrawing(true)
    const { x, y } = getCoordinates(e)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.beginPath()
    ctx.lineWidth = strokeWidth
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    const { x, y } = getCoordinates(e)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasContent(true)
  }

  const stopDrawing = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    if (e && e.cancelable) e.preventDefault()
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.closePath()
  }

  const undoLastStroke = () => {
    const canvas = canvasRef.current
    if (!canvas || history.length === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const lastSnapshot = history[history.length - 1]
    ctx.putImageData(lastSnapshot, 0, 0)
    setHistory((prev) => prev.slice(0, -1))
    if (history.length <= 1) {
      setHasContent(false)
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    saveHistorySnapshot()
    const ratio = window.devicePixelRatio || 1
    const width = canvas.width / ratio
    const height = canvas.height / ratio
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
    setHasContent(false)
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

  const signatureControls = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.5rem",
      }}
    >
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
  )

  const canvasNode = (
    <div
      style={{
        border: "2px dashed var(--border)",
        borderRadius: "0.75rem",
        overflow: "hidden",
        background: "#ffffff",
        touchAction: "none",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
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
        style={{
          cursor: "crosshair",
          display: "block",
          touchAction: "none",
          maxWidth: "100%",
        }}
      />
    </div>
  )

  // En móvil: pantalla completa para máxima comodidad al firmar con el dedo o stylus
  if (isMobile) {
    return (
      <FullscreenPortal open={isOpen} onClose={onClose} ariaLabel="Firma Digitalizada">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            background: "var(--bg)",
            boxSizing: "border-box",
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {/* Header móvil */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.875rem 1rem",
              background: "var(--card)",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={onClose}
                aria-label="Volver"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: "0.25rem",
                  color: "var(--fg)",
                }}
              >
                <ArrowLeft size={20} weight="bold" />
              </button>
              <div>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
                  ✍️ Firma Digitalizada
                </h2>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                  Dibuja tu firma con tu dedo o puntero
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              style={{
                background: "var(--accent)",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--muted)",
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Cuerpo móvil con canvas expandido */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              padding: "1rem",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            {canvasNode}
            {signatureControls}
          </div>

          {/* Footer móvil sticky */}
          <div
            style={{
              padding: "0.875rem 1rem",
              background: "var(--card)",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              flexShrink: 0,
            }}
          >
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
      </FullscreenPortal>
    )
  }

  // En desktop: diálogo centrado amplio
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="✍️ Firma Digitalizada"
      description="Dibuja tu firma con tu puntero o stylus para insertarla en el oficio."
      size="md"
      footer={
        <>
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
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {canvasNode}
        {signatureControls}
      </div>
    </Modal>
  )
}
