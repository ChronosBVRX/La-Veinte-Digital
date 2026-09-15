"use client"

/**
 * Editor manual de las cuatro esquinas del documento.
 *
 * Es obligatorio en el flujo web: la detección automática puede fallar y el
 * usuario debe poder ajustar el recorte con el dedo o el ratón.
 *
 * La Veinte Digital
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowsClockwise, Check, MagicWand } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { orderCorners } from "../lib/geometry"
import type { AnalysisImage } from "../services/web-document-scanner"
import type { DetectedQuad, Point, Quad } from "../types/scanner-types"

export interface ScanCornerEditorProps {
  analysis: AnalysisImage
  detected: DetectedQuad | null
  busy?: boolean
  onCancel: () => void
  onConfirm: (corners: Quad) => void
  onRedetect: () => void
}

const HANDLE_SIZE = 26

export function ScanCornerEditor({
  analysis,
  detected,
  busy = false,
  onCancel,
  onConfirm,
  onRedetect,
}: ScanCornerEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [corners, setCorners] = useState<Quad>(() => defaultCorners(analysis, detected))
  const draggingRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = analysis.raster.width
    canvas.height = analysis.raster.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const imageData = new ImageData(
      new Uint8ClampedArray(analysis.raster.data),
      analysis.raster.width,
      analysis.raster.height
    )
    ctx.putImageData(imageData, 0, 0)
  }, [analysis])

  const toCanvasPoint = useCallback(
    (event: React.PointerEvent): Point => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      const scaleX = analysis.raster.width / Math.max(1, rect.width)
      const scaleY = analysis.raster.height / Math.max(1, rect.height)
      return {
        x: Math.min(Math.max((event.clientX - rect.left) * scaleX, 0), analysis.raster.width),
        y: Math.min(Math.max((event.clientY - rect.top) * scaleY, 0), analysis.raster.height),
      }
    },
    [analysis]
  )

  const handlePointerDown = useCallback(
    (index: number) => (event: React.PointerEvent) => {
      event.preventDefault()
      event.stopPropagation()
      draggingRef.current = index
      try {
        ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
      } catch {
        // ignore
      }
    },
    []
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (draggingRef.current === null) return
      event.preventDefault()
      const point = toCanvasPoint(event)
      setCorners((prev) => {
        const next = [...prev] as Quad
        next[draggingRef.current as number] = point
        return next
      })
    },
    [toCanvasPoint]
  )

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    if (draggingRef.current === null) return
    draggingRef.current = null
    try {
      ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }
  }, [])

  const orderedCorners = useMemo(() => orderCorners(corners), [corners])
  const polygonPoints = orderedCorners.map((corner) => `${corner.x},${corner.y}`).join(" ")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      <div>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
          Ajusta las esquinas
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0", lineHeight: 1.45 }}>
          Arrastra los puntos para enmarcar solo el documento. Si la detección automática falló, también puedes
          reencuadrar por completo.
        </p>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          borderRadius: "0.875rem",
          overflow: "hidden",
          background: "#0f172a",
          border: "1px solid var(--border)",
          touchAction: "none",
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "auto", touchAction: "none" }}
        />
        <svg
          viewBox={`0 0 ${analysis.raster.width} ${analysis.raster.height}`}
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        >
          <polygon
            points={polygonPoints}
            fill="rgba(37, 99, 235, 0.18)"
            stroke="#38bdf8"
            strokeWidth={Math.max(2, analysis.raster.width * 0.004)}
          />
        </svg>

        {corners.map((corner, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Esquina ${index + 1}`}
            onPointerDown={handlePointerDown(index)}
            style={{
              position: "absolute",
              left: `${(corner.x / analysis.raster.width) * 100}%`,
              top: `${(corner.y / analysis.raster.height) * 100}%`,
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              marginLeft: -HANDLE_SIZE / 2,
              marginTop: -HANDLE_SIZE / 2,
              borderRadius: "50%",
              border: "3px solid #ffffff",
              background: "#2563eb",
              boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
              cursor: "grab",
              padding: 0,
              touchAction: "none",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Button variant="secondary" size="sm" onClick={onRedetect} disabled={busy}>
          <MagicWand size={16} />
          Reintentar automático
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCorners(defaultCorners(analysis, detected))}
          disabled={busy}
        >
          <ArrowsClockwise size={16} />
          Reiniciar
        </Button>
      </div>

      <div style={{ display: "flex", gap: "0.625rem", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="primary" size="md" loading={busy} onClick={() => onConfirm(orderedCorners)}>
          <Check size={18} />
          Aplicar recorte
        </Button>
      </div>
    </div>
  )
}

function defaultCorners(analysis: AnalysisImage, detected: DetectedQuad | null): Quad {
  if (detected) return detected.quad
  const { width, height } = analysis.raster
  const insetX = width * 0.08
  const insetY = height * 0.08
  return [
    { x: insetX, y: insetY },
    { x: width - insetX, y: insetY },
    { x: width - insetX, y: height - insetY },
    { x: insetX, y: height - insetY },
  ]
}
