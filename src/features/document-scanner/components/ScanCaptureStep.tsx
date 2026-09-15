"use client"

/**
 * Paso de captura web: cámara en vivo (getUserMedia) con respaldo de galería.
 *
 * Usado únicamente cuando el escáner nativo ML Kit no está disponible.
 * La foto se procesa localmente: nunca se sube a un servidor.
 *
 * La Veinte Digital
 */

import { useCallback, useRef } from "react"
import { Camera, ImageSquare, GearSix, WarningCircle } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { useWebCamera } from "../hooks/useWebCamera"

export interface ScanCaptureStepProps {
  title: string
  hint?: string
  busy?: boolean
  error?: string | null
  onCapture: (blob: Blob) => void
  onCancel: () => void
}

export function ScanCaptureStep({ title, hint, busy = false, error, onCapture, onCancel }: ScanCaptureStepProps) {
  const camera = useWebCamera()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const attachVideo = camera.attachVideo

  const setVideoElement = useCallback(
    (element: HTMLVideoElement | null) => {
      attachVideo(element)
    },
    [attachVideo]
  )

  const handleShutter = useCallback(async () => {
    const blob = await camera.capture()
    if (!blob) return
    camera.stop()
    onCapture(blob)
  }, [camera, onCapture])

  const handleFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file) return
      camera.stop()
      onCapture(file)
    },
    [camera, onCapture]
  )

  const showCamera = camera.status === "ready"
  const cameraUnavailable = camera.status === "denied" || camera.status === "error"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      <div>
        <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>{title}</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0", lineHeight: 1.45 }}>
          {hint ?? "Coloca el documento sobre una superficie plana y bien iluminada."}
        </p>
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "3 / 4",
          maxHeight: "58vh",
          borderRadius: "0.875rem",
          overflow: "hidden",
          background: "#020617",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <video
          ref={setVideoElement}
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: showCamera ? "block" : "none",
          }}
        />

        {!showCamera && camera.status !== "requesting" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              padding: "1.5rem",
              textAlign: "center",
              color: "#cbd5e1",
            }}
          >
            {cameraUnavailable ? (
              <WarningCircle size={34} weight="duotone" style={{ color: "#f87171" }} />
            ) : (
              <Camera size={34} weight="duotone" style={{ color: "#38bdf8" }} />
            )}
            <span style={{ fontSize: "0.8125rem", lineHeight: 1.45 }}>
              {camera.error ??
                (camera.status === "idle"
                  ? "Abre la cámara para tomar la foto del documento."
                  : "Preparando cámara…")}
            </span>
            {(cameraUnavailable || camera.status === "idle") && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (camera.permanentlyDenied) {
                    window.LaVeinteApp?.openAppSettings?.()
                    return
                  }
                  void camera.start()
                }}
              >
                <GearSix size={16} />
                {camera.permanentlyDenied ? "Abrir ajustes" : "Abrir cámara"}
              </Button>
            )}
          </div>
        )}

        {showCamera && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              boxShadow: "inset 0 0 0 2px rgba(56,189,248,0.45)",
            }}
          />
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            borderRadius: "0.625rem",
            padding: "0.625rem 0.875rem",
            fontSize: "0.8125rem",
          }}
        >
          {error}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      <div style={{ display: "flex", gap: "0.625rem", justifyContent: "space-between", flexWrap: "wrap" }}>
        <Button variant="secondary" size="md" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button variant="ghost" size="md" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            <ImageSquare size={18} />
            Foto de galería
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={busy}
            disabled={!showCamera || busy}
            onClick={() => void handleShutter()}
          >
            <Camera size={18} weight="fill" />
            Capturar
          </Button>
        </div>
      </div>
    </div>
  )
}
