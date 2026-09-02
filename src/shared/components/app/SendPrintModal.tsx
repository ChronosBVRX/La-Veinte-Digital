"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Html5Qrcode } from "html5-qrcode"
import {
  ArrowLeft, X, FileText, CheckCircle, WarningCircle,
  GearSix, ArrowsClockwise, QrCode, SpinnerGap,
} from "@phosphor-icons/react"
import { FullscreenPortal } from "@/shared/components/ui/FullscreenPortal"
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

export function SendPrintModal({ open, docName, getFile, onClose, onDirectPrint }: SendPrintModalProps) {
  if (!open) return null
  return (
    <FullscreenPortal open={open} onClose={onClose} ariaLabel="Enviar a imprimir por código QR">
      <SendPrintModalContent
        open={open}
        docName={docName}
        getFile={getFile}
        onClose={onClose}
        onDirectPrint={onDirectPrint}
      />
    </FullscreenPortal>
  )
}

function SendPrintModalContent({ open, docName, getFile, onClose, onDirectPrint }: SendPrintModalProps) {
  const [status, setStatus] = useState<Status>("starting")
  const [message, setMessage] = useState<string | null>(null)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [permanentlyDenied, setPermanentlyDenied] = useState(false)
  const [uploadedSize, setUploadedSize] = useState<number | null>(null)
  const [cachedFile, setCachedFile] = useState<File | null>(null)
  const [lastValidToken, setLastValidToken] = useState<string | null>(null)

  const ctxRef = useRef<ScannerErrorContext>({ bridgeReady: false, nativeShell: false })
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledRef = useRef(false)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cargar el archivo del documento
  useEffect(() => {
    let cancelled = false
    getFile().then((file) => {
      if (!cancelled && file) {
        setCachedFile(file)
      }
    })
    return () => {
      cancelled = true
    }
  }, [getFile])

  const triggerHaptic = (type: "scan" | "success") => {
    try {
      if (typeof window !== "undefined" && window.LaVeinteApp?.haptic) {
        window.LaVeinteApp.haptic()
      } else if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(type === "success" ? [50, 50, 100] : 40)
      }
    } catch {}
  }

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop()
        }
        scannerRef.current.clear()
      } catch {}
      scannerRef.current = null
    }
  }, [])

  const handleModalClose = useCallback(async () => {
    await stopScanner()
    onClose()
  }, [stopScanner, onClose])

  // Iniciar flujo y escáner de cámara
  useEffect(() => {
    if (!open) return
    handledRef.current = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia el flujo al abrir el modal
    setStatus("starting")
    setMessage(null)
    setWarningMessage(null)
    setUploadedSize(null)

    let cancelled = false

    const run = async () => {
      const bridge = await waitForLaVeinteNativeBridge()
      if (cancelled) return
      ctxRef.current = { bridgeReady: bridge.ready, nativeShell: bridge.isNative }

      // Solicitar permiso de cámara
      const gate = await requestCameraGate()
      if (cancelled) return
      if (!gate.granted) {
        setPermanentlyDenied(gate.permanentlyDenied)
        setStatus("denied")
        return
      }
      setPermanentlyDenied(false)

      try {
        const scanner = new Html5Qrcode("send-print-qr-reader", false)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onQr,
          () => {}
        )
        if (!cancelled) {
          setStatus("scanning")
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setStatus("error")
          setMessage(describeScannerError(error, ctxRef.current))
        }
      }
    }

    const onQr = async (decodedText: string) => {
      if (handledRef.current) return
      const token = extractTransferToken(decodedText)
      if (!token) {
        triggerHaptic("scan")
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
        setWarningMessage("Código no válido. Escanea la pantalla de “Recibir” de la oficina.")
        warningTimerRef.current = setTimeout(() => setWarningMessage(null), 3500)
        return
      }

      // Token válido detectado
      handledRef.current = true
      setLastValidToken(token)
      triggerHaptic("scan")
      await stopScanner()
      setStatus("uploading")

      try {
        const file = cachedFile || (await getFile())
        if (!file) {
          setStatus("error")
          setMessage("No se pudo leer el archivo del documento. Inténtalo nuevamente.")
          return
        }
        const meta = await uploadTransferFile(token, file)
        setUploadedSize(meta.sizeBytes)
        setStatus("sent")
        triggerHaptic("success")

        // Limpiar PendingPrint en Android si existía
        if (typeof window !== "undefined" && window.LaVeinteApp?.clearPendingPrintDoc) {
          window.LaVeinteApp.clearPendingPrintDoc()
        }

        // Auto-cierre suave después de confirmar
        setTimeout(() => {
          handleModalClose()
        }, 3200)
      } catch (e) {
        setStatus("error")
        setMessage(e instanceof Error ? e.message : "No se pudo transferir el documento a la computadora.")
      }
    }

    void run()

    return () => {
      cancelled = true
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      void stopScanner()
    }
  }, [open, attempt, cachedFile, getFile, handleModalClose, stopScanner])

  const retryUploadWithCachedToken = async () => {
    if (!lastValidToken) {
      setStatus("starting")
      setMessage(null)
      setAttempt((a) => a + 1)
      return
    }

    setStatus("uploading")
    setMessage(null)
    try {
      const file = cachedFile || (await getFile())
      if (!file) {
        setStatus("error")
        setMessage("No se pudo leer el archivo del documento.")
        return
      }
      const meta = await uploadTransferFile(lastValidToken, file)
      setUploadedSize(meta.sizeBytes)
      setStatus("sent")
      triggerHaptic("success")
      setTimeout(() => {
        handleModalClose()
      }, 3000)
    } catch (e) {
      setStatus("error")
      setMessage(e instanceof Error ? e.message : "No se pudo transferir el documento.")
    }
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0a0f1d",
        color: "#f8fafc",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes scanGlow {
          0%, 100% { opacity: 0.4; transform: translateY(-100%); }
          50% { opacity: 0.9; transform: translateY(100%); }
        }
        .qr-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, var(--primary, #2563eb), transparent);
          box-shadow: 0 0 12px var(--primary, #2563eb);
          animation: scanGlow 2.4s ease-in-out infinite;
        }
        .qr-corner {
          position: absolute;
          width: 24px;
          height: 24px;
          border-color: #38bdf8;
          border-style: solid;
        }
        .qr-corner-tl { top: 12px; left: 12px; border-width: 3px 0 0 3px; border-top-left-radius: 6px; }
        .qr-corner-tr { top: 12px; right: 12px; border-width: 3px 3px 0 0; border-top-right-radius: 6px; }
        .qr-corner-bl { bottom: 12px; left: 12px; border-width: 0 0 3px 3px; border-bottom-left-radius: 6px; }
        .qr-corner-br { bottom: 12px; right: 12px; border-width: 0 3px 3px 0; border-bottom-right-radius: 6px; }
        #send-print-qr-reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 1rem;
        }
        #send-print-qr-reader {
          border: none !important;
        }
      `}</style>

      {/* Barra Superior */}
      <header
        style={{
          width: "100%",
          padding: "max(0.75rem, env(safe-area-inset-top, 0px)) 1rem 0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(8px)",
          zIndex: 20,
        }}
      >
        <button
          onClick={handleModalClose}
          aria-label="Regresar"
          title="Regresar"
          style={{
            background: "none",
            border: "none",
            color: "#f8fafc",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.35rem",
            fontSize: "0.875rem",
          }}
        >
          <ArrowLeft size={20} weight="bold" />
          <span style={{ fontWeight: 600 }}>Volver</span>
        </button>

        <div style={{ textAlign: "center", minWidth: 0, flex: 1, padding: "0 0.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "#ffffff" }}>
            Enviar a imprimir
          </h1>
          <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>Oficina Sindical</span>
        </div>

        <button
          onClick={handleModalClose}
          aria-label="Cerrar"
          title="Cerrar"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            width: 32,
            height: 32,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          <X size={18} weight="bold" />
        </button>
      </header>

      {/* Contenido Principal */}
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "480px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1rem max(1.5rem, env(safe-area-inset-bottom, 0px))",
          boxSizing: "border-box",
          overflowY: "auto",
        }}
      >
        {/* Tarjeta de Contexto del Documento */}
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            background: "rgba(30, 41, 59, 0.7)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "0.75rem",
            boxSizing: "border-box",
            marginBottom: "0.75rem",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "0.5rem",
              background: "rgba(37, 99, 235, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#60a5fa",
              flexShrink: 0,
            }}
          >
            <FileText size={22} weight="duotone" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "#f8fafc",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={docName}
            >
              {docName}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.125rem" }}>
              {cachedFile?.size ? `${formatBytes(cachedFile.size)} · ` : ""}Documento listo para transferir
            </div>
          </div>
        </div>

        {/* Notificación flotante de advertencia (QR no válido) */}
        {warningMessage && (
          <div
            style={{
              width: "100%",
              padding: "0.625rem 0.875rem",
              background: "rgba(245, 158, 11, 0.2)",
              border: "1px solid rgba(245, 158, 11, 0.5)",
              borderRadius: "0.5rem",
              color: "#fef08a",
              fontSize: "0.8125rem",
              textAlign: "center",
              marginBottom: "0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <WarningCircle size={18} weight="bold" />
            <span>{warningMessage}</span>
          </div>
        )}

        {/* Visor de Escáner de Cámara */}
        {(status === "starting" || status === "scanning") && (
          <div
            style={{
              width: "100%",
              flex: 1,
              minHeight: 280,
              maxHeight: 380,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              margin: "auto 0",
            }}
          >
            {/* Contenedor del video */}
            <div
              style={{
                position: "relative",
                width: "min(320px, 85vw)",
                height: "min(320px, 85vw)",
                borderRadius: "1rem",
                overflow: "hidden",
                background: "#020617",
                border: "2px solid rgba(56, 189, 248, 0.3)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              <div id="send-print-qr-reader" style={{ width: "100%", height: "100%" }} />

              {status === "starting" && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.75rem",
                    background: "rgba(10, 15, 29, 0.9)",
                    color: "#94a3b8",
                    fontSize: "0.875rem",
                  }}
                >
                  <SpinnerGap size={28} className="animate-spin" style={{ color: "#38bdf8" }} />
                  <span>Preparando cámara…</span>
                </div>
              )}

              {status === "scanning" && (
                <>
                  <div className="qr-corner qr-corner-tl" />
                  <div className="qr-corner qr-corner-tr" />
                  <div className="qr-corner qr-corner-bl" />
                  <div className="qr-corner qr-corner-br" />
                  <div className="qr-scan-line" />
                </>
              )}
            </div>

            {/* Instrucción bajo el escáner */}
            <p
              style={{
                color: "#94a3b8",
                fontSize: "0.8125rem",
                textAlign: "center",
                lineHeight: 1.45,
                margin: "1rem 0 0",
                maxWidth: "340px",
              }}
            >
              En la computadora de la oficina sindical, abre <strong>“Recibir”</strong> y apunta al código QR.
            </p>
          </div>
        )}

        {/* Estado: Transfiriendo archivo */}
        {status === "uploading" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
              padding: "3rem 1rem",
              margin: "auto",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(37, 99, 235, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#38bdf8",
              }}
            >
              <SpinnerGap size={36} className="animate-spin" />
            </div>
            <div>
              <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: "0 0 0.35rem" }}>
                Transfiriendo documento…
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "#94a3b8", margin: 0 }}>
                Enviando {docName} a la computadora de impresión.
              </p>
            </div>
          </div>
        )}

        {/* Estado: Enviado con éxito */}
        {status === "sent" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1.25rem",
              padding: "2.5rem 1.5rem",
              background: "rgba(30, 41, 59, 0.6)",
              border: "1px solid rgba(34, 197, 94, 0.4)",
              borderRadius: "1rem",
              width: "100%",
              boxSizing: "border-box",
              margin: "auto",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(34, 197, 94, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#4ade80",
              }}
            >
              <CheckCircle size={40} weight="fill" />
            </div>
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#f8fafc", margin: "0 0 0.35rem" }}>
                ¡Documento enviado con éxito!
              </h2>
              <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
                {uploadedSize ? `${formatBytes(uploadedSize)} · ` : ""}Ya puedes imprimirlo desde la pantalla de la oficina.
              </p>
            </div>
            <Button variant="primary" size="md" onClick={handleModalClose} style={{ minWidth: "140px" }}>
              Listo
            </Button>
          </div>
        )}

        {/* Estado: Permiso de cámara denegado */}
        {status === "denied" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
              padding: "2rem 1rem",
              margin: "auto",
              textAlign: "center",
              maxWidth: "360px",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f87171",
              }}
            >
              <QrCode size={30} weight="duotone" />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.35rem" }}>
                Se requiere acceso a la cámara
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
                {permanentlyDenied
                  ? "El permiso fue denegado permanentemente. Por favor actívalo desde los Ajustes de la aplicación."
                  : "Necesitamos permiso para usar la cámara y escanear el código QR de impresión."}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (permanentlyDenied) {
                    window.LaVeinteApp?.openAppSettings?.()
                    return
                  }
                  setStatus("starting")
                  setAttempt((a) => a + 1)
                }}
              >
                <GearSix size={16} />
                {permanentlyDenied ? "Abrir ajustes" : "Permitir cámara"}
              </Button>
            </div>
          </div>
        )}

        {/* Estado: Error */}
        {status === "error" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
              padding: "2rem 1rem",
              margin: "auto",
              textAlign: "center",
              maxWidth: "360px",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f87171",
              }}
            >
              <WarningCircle size={32} weight="duotone" />
            </div>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.35rem" }}>
                No se pudo transferir
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "#fca5a5", margin: 0, lineHeight: 1.4 }}>
                {message || "Ocurrió un error al enviar el documento."}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
              <Button
                variant="primary"
                size="sm"
                onClick={lastValidToken ? retryUploadWithCachedToken : () => {
                  setStatus("starting")
                  setMessage(null)
                  setAttempt((a) => a + 1)
                }}
              >
                <ArrowsClockwise size={16} />
                Reintentar envío
              </Button>
            </div>
          </div>
        )}

        {/* Opción de impresión directa local en escritorio si está disponible */}
        {onDirectPrint && (status === "scanning" || status === "denied" || status === "error") && (
          <div style={{ marginTop: "1rem", width: "100%", display: "flex", justifyContent: "center" }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void handleModalClose()
                onDirectPrint()
              }}
              style={{ color: "#94a3b8", fontSize: "0.75rem" }}
            >
              🖨 Imprimir directamente en esta computadora
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
