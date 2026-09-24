"use client"

/**
 * Paso de captura web: cámara en vivo con visor integrado a pantalla completa,
 * respaldo de galería, feedback visual inmediato al capturar y manejo robusto de fotogramas.
 *
 * Se usa únicamente cuando el escáner nativo ML Kit no está disponible.
 * La foto se procesa 100% en el dispositivo: nunca se sube a un servidor.
 *
 * La Veinte Digital
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, ImageSquare, GearSix, WarningCircle, ArrowsClockwise } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import { useWebCamera, type UseWebCameraResult } from "../hooks/useWebCamera"

export type CaptureProcessingPhase = "idle" | "capturing" | "processing" | "detecting"

export interface ScanCaptureStepProps {
  title: string
  hint?: string
  busy?: boolean
  error?: string | null
  processingPhase?: CaptureProcessingPhase
  onCapture: (blob: Blob) => Promise<void> | void
  onCancel?: () => void
  cameraOverride?: UseWebCameraResult
}

export function ScanCaptureStep({
  title,
  hint,
  busy = false,
  error,
  processingPhase = "idle",
  onCapture,
  onCancel,
  cameraOverride,
}: ScanCaptureStepProps) {
  const internalCamera = useWebCamera()
  const camera = cameraOverride ?? internalCamera
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const attachVideo = camera.attachVideo

  const [localPhase, setLocalPhase] = useState<CaptureProcessingPhase>("idle")
  const [frozenPreviewUrl, setFrozenPreviewUrl] = useState<string | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [flashActive, setFlashActive] = useState(false)

  const frozenUrlRef = useRef<string | null>(null)
  useEffect(() => {
    frozenUrlRef.current = frozenPreviewUrl
  }, [frozenPreviewUrl])

  useEffect(() => {
    return () => {
      if (frozenUrlRef.current) {
        URL.revokeObjectURL(frozenUrlRef.current)
      }
    }
  }, [])

  const setVideoElement = useCallback(
    (element: HTMLVideoElement | null) => {
      attachVideo(element)
    },
    [attachVideo]
  )

  const activePhase: CaptureProcessingPhase =
    processingPhase !== "idle" ? processingPhase : localPhase

  const isCapturingOrProcessing = activePhase !== "idle" || busy

  const handleShutter = useCallback(async () => {
    if (isCapturingOrProcessing) return
    setCaptureError(null)
    setLocalPhase("capturing")

    // Feedback táctil instantáneo (si el dispositivo lo soporta)
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(30)
      }
    } catch {
      // Ignorar fallos de vibración en navegadores que no lo soportan
    }

    // Flash visual breve para confirmar captura física
    setFlashActive(true)
    setTimeout(() => setFlashActive(false), 160)

    const result = await camera.capture()
    if (!result.ok) {
      setLocalPhase("idle")
      setCaptureError(result.error)
      // La cámara permanece activa para permitir reintentar sin fricción
      return
    }

    // Congelar fotograma capturado de inmediato
    const previewUrl = URL.createObjectURL(result.blob)
    setFrozenPreviewUrl(previewUrl)
    setLocalPhase("processing")
    camera.stop()

    try {
      await onCapture(result.blob)
    } catch (err) {
      setLocalPhase("idle")
      setCaptureError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al procesar la captura. Inténtalo nuevamente."
      )
    }
  }, [camera, isCapturingOrProcessing, onCapture])

  const handleFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file || isCapturingOrProcessing) return

      setCaptureError(null)
      const previewUrl = URL.createObjectURL(file)
      setFrozenPreviewUrl(previewUrl)
      setLocalPhase("processing")
      camera.stop()

      try {
        await onCapture(file)
      } catch (err) {
        setLocalPhase("idle")
        setCaptureError(
          err instanceof Error
            ? err.message
            : "No se pudo procesar el archivo seleccionado."
        )
      }
    },
    [camera, isCapturingOrProcessing, onCapture]
  )

  const showCamera = camera.status === "ready" && !frozenPreviewUrl
  const cameraUnavailable = camera.status === "denied" || camera.status === "error"
  const displayedError = error || captureError

  const processingMessage =
    activePhase === "capturing"
      ? "Capturando…"
      : activePhase === "detecting"
      ? "Detectando bordes…"
      : "Procesando foto…"

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
      {/* Barra contextual superior */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          padding: "0.25rem 0.25rem 0.5rem",
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            fontSize: "0.9375rem",
            fontWeight: 700,
            margin: 0,
            color: "var(--fg)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          {title}
        </h2>
        {hint && (
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--muted)",
              margin: 0,
              lineHeight: 1.35,
            }}
          >
            {hint}
          </p>
        )}
      </div>

      {/* Visor central flexible (ocupa todo el espacio vertical disponible) */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          width: "100%",
          borderRadius: "0.875rem",
          overflow: "hidden",
          background: "#020617",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "inset 0 0 40px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Video en vivo (ajustado sin recortes indeseados) */}
        <video
          ref={setVideoElement}
          playsInline
          muted
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            display: showCamera ? "block" : "none",
          }}
        />

        {/* Guías de encuadre documental sutiles sobre el video activo */}
        {showCamera && (
          <div
            style={{
              position: "absolute",
              inset: "1rem",
              pointerEvents: "none",
              border: "1.5px dashed rgba(255, 255, 255, 0.4)",
              borderRadius: "0.5rem",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.25)",
            }}
          />
        )}

        {/* Flash de captura */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#ffffff",
            opacity: flashActive ? 0.92 : 0,
            transition: "opacity 160ms ease-out",
            pointerEvents: "none",
            zIndex: 30,
          }}
        />

        {/* Fotograma congelado o procesamiento en curso */}
        {(frozenPreviewUrl || activePhase !== "idle") && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#020617",
              zIndex: 20,
            }}
          >
            {frozenPreviewUrl && (
              /* eslint-disable-next-line @next/next/no-img-element -- frame local temporal */
              <img
                src={frozenPreviewUrl}
                alt="Fotograma capturado"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  width: "auto",
                  height: "auto",
                  objectFit: "contain",
                  filter: "brightness(0.75)",
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                background: "rgba(15, 23, 42, 0.88)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "0.875rem",
                padding: "1rem 1.5rem",
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <LoadingSpinner text={processingMessage} />
            </div>
          </div>
        )}

        {/* Estado previo a cámara activa (idle, solicitando o error) */}
        {!showCamera && !frozenPreviewUrl && activePhase === "idle" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.875rem",
              padding: "1.5rem",
              textAlign: "center",
              color: "#cbd5e1",
              maxWidth: "340px",
            }}
          >
            {cameraUnavailable ? (
              <WarningCircle size={40} weight="duotone" style={{ color: "#f87171" }} />
            ) : (
              <Camera size={40} weight="duotone" style={{ color: "#38bdf8" }} />
            )}
            <span style={{ fontSize: "0.875rem", lineHeight: 1.45 }}>
              {camera.error ??
                (camera.status === "idle"
                  ? "Abre la cámara para escanear el documento con tu celular."
                  : "Preparando cámara…")}
            </span>
            {(cameraUnavailable || camera.status === "idle") && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  if (camera.permanentlyDenied) {
                    window.LaVeinteApp?.openAppSettings?.()
                    return
                  }
                  void camera.start()
                }}
              >
                {cameraUnavailable ? <GearSix size={18} /> : <Camera size={18} />}
                {camera.permanentlyDenied ? "Abrir ajustes" : "Abrir cámara"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Alerta de error controlada (no fatal) */}
      {displayedError && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            borderRadius: "0.625rem",
            padding: "0.5rem 0.75rem",
            fontSize: "0.75rem",
            marginTop: "0.5rem",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          <span>{displayedError}</span>
          {captureError && (
            <button
              type="button"
              onClick={() => setCaptureError(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#991b1b",
                fontWeight: 600,
                fontSize: "0.75rem",
                cursor: "pointer",
                padding: "2px 4px",
              }}
            >
              Cerrar
            </button>
          )}
        </div>
      )}

      {/* Input nativo oculto para selección de galería */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => void handleFile(e)}
      />

      {/* Barra de acción inferior permanente (siempre accesible sin scroll) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 0.25rem 0",
          gap: "0.75rem",
          flexShrink: 0,
          boxSizing: "border-box",
        }}
      >
        {/* Opción 1: Galería */}
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCapturingOrProcessing}
            style={{
              padding: "0.5rem 0.75rem",
              fontSize: "0.8125rem",
              color: "var(--fg)",
            }}
          >
            <ImageSquare size={20} weight="duotone" />
            <span>Foto de galería</span>
          </Button>
        </div>

        {/* Opción 2: Disparador circular táctil principal */}
        <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <button
            type="button"
            aria-label={activePhase === "capturing" ? "Capturando…" : "Capturar"}
            disabled={!showCamera || isCapturingOrProcessing}
            onClick={() => void handleShutter()}
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              border: "3.5px solid rgba(255, 255, 255, 0.95)",
              background: "transparent",
              padding: 4,
              cursor: showCamera && !isCapturingOrProcessing ? "pointer" : "not-allowed",
              opacity: showCamera && !isCapturingOrProcessing ? 1 : 0.45,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 120ms ease, opacity 150ms ease",
              transform: activePhase === "capturing" ? "scale(0.92)" : "scale(1)",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.35)",
              outline: "none",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: activePhase === "capturing" ? "var(--primary)" : "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 150ms ease",
              }}
            >
              {activePhase === "capturing" ? (
                <ArrowsClockwise size={22} color="#ffffff" className="animate-spin" />
              ) : (
                <Camera size={26} weight="fill" color="#0f172a" />
              )}
            </div>
          </button>
        </div>

        {/* Opción 3: Acción secundaria / Reintentar si falló la cámara */}
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
          {cameraUnavailable ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void camera.start()}
              disabled={isCapturingOrProcessing}
            >
              Reintentar
            </Button>
          ) : onCancel ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isCapturingOrProcessing}
              style={{ color: "var(--muted)", fontSize: "0.8125rem" }}
            >
              Cancelar
            </Button>
          ) : (
            <div style={{ width: 40 }} />
          )}
        </div>
      </div>
    </div>
  )
}
