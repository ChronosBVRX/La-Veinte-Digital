"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { ArrowsClockwise, FileText, GearSix, Printer, WarningCircle } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { uploadTransferFile } from "@/features/transferir/services/transfer"
import { extractTransferToken, formatBytes } from "@/features/transferir/lib/transfer"
import { requestCameraGate } from "@/features/transferir/components/camera"
import { waitForLaVeinteNativeBridge } from "@/features/transferir/components/native"
import { describeScannerError, type ScannerErrorContext } from "@/features/transferir/components/scannerError"

type Status = "starting" | "scanning" | "denied" | "uploading" | "sent" | "error"

export interface SendPrintModalProps {
  open: boolean
  docName: string
  getFile: () => Promise<File | null>
  onClose: () => void
  onDirectPrint?: () => void
}

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  color: "#94a3b8",
  fontSize: "0.875rem",
  background: "rgba(15,23,42,0.7)",
}

/**
 * Flujo de envío a imprimir (escáner QR de la computadora + subida del archivo elegido),
 * reutilizando exactamente el mecanismo de transferencia de la app.
 */
export function SendPrintModal({ open, docName, getFile, onClose, onDirectPrint }: SendPrintModalProps) {
  const [status, setStatus] = useState<Status>("starting")
  const [message, setMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [permanentlyDenied, setPermanentlyDenied] = useState(false)
  const [uploadedSize, setUploadedSize] = useState<number | null>(null)
  const ctxRef = useRef<ScannerErrorContext>({ bridgeReady: false, nativeShell: false })
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledRef = useRef(false)

  useEffect(() => {
    if (!open) return
    handledRef.current = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el flujo al abrir el modal
    setStatus("starting")
    setMessage(null)
    setUploadedSize(null)

    let cancelled = false

    const run = async () => {
      const bridge = await waitForLaVeinteNativeBridge()
      if (cancelled) return
      ctxRef.current = { bridgeReady: bridge.ready, nativeShell: bridge.isNative }

      const gate = await requestCameraGate()
      if (cancelled) return
      if (!gate.granted) {
        setPermanentlyDenied(gate.permanentlyDenied)
        setStatus("denied")
        return
      }
      setPermanentlyDenied(false)

      const scanner = new Html5Qrcode("send-print-qr-reader", false)
      scannerRef.current = scanner
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 280 } },
          onQr,
          () => {},
        )
        .then(() => {
          if (!cancelled) {
            setStatus("scanning")
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setStatus("error")
            setMessage(describeScannerError(error, ctxRef.current))
          }
        })
    }

    const onQr = async (decodedText: string) => {
      if (handledRef.current) return
      const token = extractTransferToken(decodedText)
      if (!token) {
        setMessage("Ese código no es válido para recibir. Escanea el código de 'Recibir' de la computadora.")
        return
      }
      handledRef.current = true
      setStatus("uploading")
      try {
        const file = await getFile()
        if (!file) {
          setStatus("error")
          setMessage("No se puedo leer el documento. Inténtalo de nuevo.")
          return
        }
        const meta = await uploadTransferFile(token, file)
        setUploadedSize(meta.sizeBytes)
        setStatus("sent")
      } catch (e) {
        setStatus("error")
        setMessage(e instanceof Error ? e.message : "No se pudo enviar el documento.")
      }
    }

    run()

    return () => {
      cancelled = true
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {})
          }
          scannerRef.current.clear()
        } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attempt])

  useEffect(() => {
    if (!open) {
      handledRef.current = true
    }
  }, [open])

  if (!open) return null

  const handleModalClose = () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {})
        }
        scannerRef.current.clear()
      } catch {}
    }
    onClose()
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 15, 25, 0.98)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 1100,
        padding: "1.25rem",
        overflow: "auto",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleModalClose() }}
    >
      <div style={{
        background: "#1e293b",
        borderRadius: "1.25rem",
        width: "100%",
        maxWidth: 460,
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        marginTop: "6vh",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Printer size={30} style={{ color: "var(--primary)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: "1rem", color: "#fff" }}>Enviar a imprimir</strong>
            <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Escanea el código de la computadora.</span>
          </div>
          <button
            onClick={handleModalClose}
            aria-label="Cerrar"
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "1.1rem",
              lineHeight: 1,
              padding: "0.25rem",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          padding: "0.625rem 0.75rem",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          background: "#0f172a",
        }}>
          <FileText size={20} style={{ color: "var(--primary)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {docName}
            </p>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
              Documento a enviar
            </p>
          </div>
        </div>

        {(status === "starting" || status === "scanning") && (
          <>
            <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, textAlign: "center" }}>
              En la computadora, abre <strong>“Recibir”</strong> y muestra su código QR.
            </p>
            <div
              style={{
                position: "relative",
                borderRadius: "var(--radius)",
                overflow: "hidden",
                background: "#0f172a",
                minHeight: 240,
              }}
            >
              <div id="send-print-qr-reader" style={{ width: "100%", minHeight: 240 }} />
              {status === "starting" && (
                <div style={{ ...overlayStyle }}>Preparando cámara…</div>
              )}
              {status === "scanning" && (
                <div style={{ ...overlayStyle }}>Apunta la cámara al código QR…</div>
              )}
            </div>

            {onDirectPrint && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: "0.25rem" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onClose()
                    onDirectPrint()
                  }}
                  style={{ color: "#94a3b8", fontSize: "0.8125rem" }}
                >
                  🖨 Imprimir directamente en este equipo
                </Button>
              </div>
            )}
          </>
        )}

        {status === "uploading" && (
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0, textAlign: "center" }}>
            Enviando documento…
          </p>
        )}

        {status === "sent" && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            padding: "0.625rem 0.75rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            background: "#0f172a",
          }}>
            <span style={{ color: "#16a34a", fontSize: "1.25rem", flexShrink: 0 }}>✓</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, color: "#f1f5f9" }}>
                Enviado: {docName}
              </p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                {uploadedSize ? `${formatBytes(uploadedSize)} · ` : ""}Imprímelo desde la computadora.
              </p>
            </div>
          </div>
        )}

        {status === "denied" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: 0, textAlign: "center" }}>
              Necesitamos acceso a la cámara para escanear el código.
            </p>
            {permanentlyDenied && (
              <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: 0, textAlign: "center" }}>
                Lo denegaste permanentemente. Actívala desde Ajustes del dispositivo.
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
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
              {onDirectPrint && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onClose()
                    onDirectPrint()
                  }}
                >
                  🖨 Imprimir en este equipo
                </Button>
              )}
            </div>
          </div>
        )}

        {status === "error" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" }}>
            <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#ef4444", fontSize: "0.8125rem", margin: 0, textAlign: "center" }}>
              <WarningCircle size={16} style={{ flexShrink: 0 }} />
              <span>{message}</span>
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setStatus("starting")
                  setMessage(null)
                  setAttempt((a) => a + 1)
                }}
              >
                <ArrowsClockwise size={14} /> Reintentar
              </Button>
              {onDirectPrint && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onClose()
                    onDirectPrint()
                  }}
                >
                  🖨 Imprimir en este equipo
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
