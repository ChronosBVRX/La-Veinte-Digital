"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import {
  ArrowsClockwise,
  Camera,
  Image as ImageIcon,
  GearSix,
  WarningCircle,
} from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { extractUploadUrl } from "@/features/transferir/lib/transfer"
import { requestCameraGate } from "./camera"
import { waitForLaVeinteNativeBridge } from "./native"
import { describeScannerError } from "./scannerError"
import type { ScannerErrorContext } from "./scannerError"

const STEP_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "flex-start",
}

const STEP_NUM: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: "50%",
  background: "var(--primary)",
  color: "var(--primary-fg)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.75rem",
  fontWeight: 700,
  flexShrink: 0,
  marginTop: 1,
}

export function SendPanel() {
  const [status, setStatus] = useState<"starting" | "scanning" | "denied" | "error">("starting")
  const [message, setMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [permanentlyDenied, setPermanentlyDenied] = useState(false)
  const ctxRef = useRef<ScannerErrorContext>({ bridgeReady: false, nativeShell: false })
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    handledRef.current = false

    let cancelled = false
    const scanner = new Html5Qrcode("transfer-qr-reader", false)
    scannerRef.current = scanner

    const onSuccess = (decodedText: string) => {
      if (cancelled || handledRef.current) return
      const target = extractUploadUrl(decodedText)
      if (!target) {
        setMessage(
          "Ese código no es válido para enviar. Escanea el código de 'Recibir' de la otra computadora.",
        )
        return
      }
      handledRef.current = true
      console.log("PRINT_FLOW qr_valid")
      window.location.assign(target)
    }

    const startScanner = () =>
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          onSuccess,
          () => {},
        )
        .then(() => {
          if (!cancelled) setStatus("scanning")
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setStatus("error")
            setMessage(describeScannerError(error, ctxRef.current))
          }
        })

    const run = async () => {
      // Wait for the native bridge — never treat a temporarily-absent bridge as browser.
      const bridge = await waitForLaVeinteNativeBridge()
      if (cancelled) return
      ctxRef.current = { bridgeReady: bridge.ready, nativeShell: bridge.isNative }
      // Gate camera permission BEFORE getUserMedia so the OS prompt is answered first.
      const gate = await requestCameraGate()
      if (cancelled) return
      if (!gate.granted) {
        setPermanentlyDenied(gate.permanentlyDenied)
        setStatus("denied")
        return
      }
      startScanner()
    }
    run()

    return () => {
      cancelled = true
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {})
    }
  }, [attempt])

  const handleImageFile = useCallback(async (file: File | undefined) => {
    if (!file || !scannerRef.current) return
    try {
      const text = await scannerRef.current.scanFile(file, false)
      const target = extractUploadUrl(text)
      if (target) {
        handledRef.current = true
        window.location.assign(target)
      } else {
        setMessage("No se detectó un código válido en la imagen. Inténtalo de nuevo.")
      }
    } catch {
      setMessage("No se detectó un código válido en la imagen. Inténtalo de nuevo.")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={STEP_STYLE}>
          <span style={STEP_NUM}>1</span>
          <span style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
            En la otra computadora o teléfono, elige <strong>Recibir</strong>.
          </span>
        </div>
        <div style={STEP_STYLE}>
          <span style={STEP_NUM}>2</span>
          <span style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
            Apunta esta cámara al código QR que aparece ahí.
          </span>
        </div>
        <div style={STEP_STYLE}>
          <span style={STEP_NUM}>3</span>
          <span style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
            Al escanearlo, elige el documento que quieres enviar.
          </span>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          background: "#0f172a",
          minHeight: 260,
        }}
      >
        <div id="transfer-qr-reader" style={{ width: "100%", minHeight: 260 }} />
        {status === "starting" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              fontSize: "0.875rem",
              background: "#0f172a",
            }}
          >
            Iniciando cámara…
          </div>
        )}
      </div>

      {status === "denied" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--state-error-bg)",
              color: "var(--error)",
            }}
          >
            <Camera size={24} />
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, textAlign: "center" }}>
            Necesitamos acceso a la cámara para escanear el código.
          </p>
          {permanentlyDenied ? (
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: 0, textAlign: "center" }}>
              Lo denegaste permanentemente. Actívala desde Ajustes del dispositivo.
            </p>
          ) : null}
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              if (permanentlyDenied) {
                window.LaVeinteApp?.openAppSettings?.()
                return
              }
              setAttempt((a) => a + 1)
            }}
          >
            <GearSix size={14} />
            {permanentlyDenied ? "Abrir ajustes" : "Permitir cámara"}
          </Button>
        </div>
      )}

      {status === "error" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" }}>
          <p
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--error)",
              fontSize: "0.8125rem",
              margin: 0,
              textAlign: "center",
            }}
          >
            <WarningCircle size={16} style={{ flexShrink: 0 }} />
            <span>{message}</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setStatus("starting")
              setMessage(null)
              setAttempt((a) => a + 1)
            }}
          >
            <ArrowsClockwise size={14} /> Reintentar cámara
          </Button>
        </div>
      )}

      {status === "scanning" && message && (
        <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, textAlign: "center" }}>
          {message}
        </p>
      )}

      <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} style={{ alignSelf: "center" }}>
        <ImageIcon size={14} /> ¿Sin cámara? Sube una foto del código
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleImageFile(e.target.files?.[0])}
      />
    </div>
  )
}
