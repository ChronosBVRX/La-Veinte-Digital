"use client"

/**
 * Editor interactivo de las cuatro esquinas del documento.
 *
 * Ajustado a pantalla completa móvil (100dvh): el lienzo escala dentro del workspace
 * sin desbordar el viewport y manteniendo la barra de acciones ("Aplicar recorte")
 * siempre visible e interactiva.
 *
 * Mantiene alineación matemática 1:1 entre coordenadas de raster, visuales, SVG y handles.
 *
 * La Veinte Digital
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowsClockwise, Check, MagicWand, WarningCircle } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { orderCorners } from "../lib/geometry"
import { canRetryOpenCv } from "../lib/opencv-loader"
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

const HANDLE_SIZE = 28

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
        // Ignorar fallos de captura de puntero en navegadores antiguos
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
      // Ignorar fallos de liberación de puntero
    }
  }, [])

  const orderedCorners = useMemo(() => orderCorners(corners), [corners])
  const polygonPoints = orderedCorners.map((corner) => `${corner.x},${corner.y}`).join(" ")

  const isLowConfidenceOrFallback =
    !detected || !detected.confidence || detected.confidence < 0.45

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 0,
        boxSizing: "border-box",
      }}
    >
      {/* Título contextual compacto */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          padding: "0.25rem 0.25rem 0.375rem",
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            margin: 0,
            color: "var(--fg)",
          }}
        >
          Ajusta las esquinas
        </h2>
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--muted)",
            margin: 0,
            lineHeight: 1.35,
          }}
        >
          Arrastra los 4 puntos azules para encuadrar los bordes del documento.
        </p>
      </div>

      {/* Espacio visual central: El lienzo escala dentro de él sin forzar scroll */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: "0.25rem 0",
        }}
      >
        {/* Mensaje amable no fatal si la detección automática requirió asistencia */}
        {isLowConfidenceOrFallback && (
          <div
            style={{
              fontSize: "0.75rem",
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#e2e8f0",
              padding: "0.25rem 0.75rem",
              borderRadius: "999px",
              marginBottom: "0.375rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              zIndex: 10,
              flexShrink: 0,
            }}
          >
            <WarningCircle size={14} color="#f59e0b" weight="fill" />
            <span>No detectamos bien los bordes. Ajusta las esquinas con los puntos.</span>
          </div>
        )}

        {/* Contenedor exacto del documento: Mantiene la relación de aspecto del raster */}
        <div
          style={{
            position: "relative",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: `${analysis.raster.width} / ${analysis.raster.height}`,
            borderRadius: "0.75rem",
            overflow: "hidden",
            background: "#0f172a",
            border: "1px solid var(--border)",
            touchAction: "none",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <canvas
            ref={canvasRef}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "contain",
              touchAction: "none",
            }}
          />

          <svg
            viewBox={`0 0 ${analysis.raster.width} ${analysis.raster.height}`}
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            <polygon
              points={polygonPoints}
              fill="rgba(37, 99, 235, 0.2)"
              stroke="#38bdf8"
              strokeWidth={Math.max(2, analysis.raster.width * 0.005)}
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
                boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                cursor: "grab",
                padding: 0,
                touchAction: "none",
                zIndex: 20,
              }}
            />
          ))}
        </div>
      </div>

      {/* Controles secundarios compactos (Reintentar automático / Reiniciar) */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          justifyContent: "center",
          alignItems: "center",
          padding: "0.375rem 0",
          flexShrink: 0,
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onRedetect}
          disabled={busy}
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
        >
          <MagicWand size={15} />
          {canRetryOpenCv() ? "Reintentar automático" : "Automático"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCorners(defaultCorners(analysis, detected))}
          disabled={busy}
          style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
        >
          <ArrowsClockwise size={15} />
          Reiniciar
        </Button>
      </div>

      {/* Barra de acción inferior permanente (Siempre visible) */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          padding: "0.625rem 0 0",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="md"
          loading={busy}
          onClick={() => onConfirm(orderedCorners)}
        >
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
