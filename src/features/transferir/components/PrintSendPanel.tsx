"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { ArrowsClockwise, Camera, FileText, GearSix, Printer, WarningCircle } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import {
  readNativeDocumentAsFile,
  uploadTransferFile,
} from "@/features/transferir/services/transfer"
import { requestCameraGate } from "./camera"
import { extractTransferToken, formatBytes } from "@/features/transferir/lib/transfer"
import type { TransferFileMeta } from "@/features/transferir/lib/transfer"

/**
 * "Enviar a imprimir" flow: shows the native doc to send, then scans the PC's transfer QR. Once a
 * valid token is detected, the pending native document is read and uploaded automatically.
 */
export function PrintSendPanel() {
  const [status, setStatus] = useState<"scanning" | "permission" | "uploading" | "sent" | "error">("scanning")
  const [message, setMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [permanentlyDenied, setPermanentlyDenied] = useState(false)
  const [doc, setDoc] = useState<{ name: string; localPath: string; fileSize: number } | null>(null)
  const [uploaded, setUploaded] = useState<TransferFileMeta[]>([])
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    window.LaVeinteApp?.getPendingPrintDoc?.()
      .then((pending) => {
        if (cancelled || !pending?.localPath) return
        return readNativeDocumentAsFile({
          name: pending.localPath.split("/").pop() || "documento",
          mimeType: "application/pdf",
          localPath: pending.localPath,
        }).then((file) => {
          if (cancelled || !file) return
          setDoc({ name: file.name, localPath: pending.localPath, fileSize: file.size })
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    handledRef.current = false
    let cancelled = false
    const scanner = new Html5Qrcode("print-qr-reader", false)
    scannerRef.current = scanner

    const onSuccess = async (decodedText: string) => {
      if (cancelled || handledRef.current) return
      const token = extractTransferToken(decodedText)
      if (!token) {
        setMessage("Ese código no es válido. Escanea el código de 'Recibir' de la computadora.")
        return
      }
      handledRef.current = true
      setStatus("uploading")
      try {
        const pending = await window.LaVeinteApp?.getPendingPrintDoc?.()
        if (!pending?.localPath) {
          setStatus("error")
          setMessage("No se encontró el documento que querías enviar. Vuelve a intentarlo.")
          return
        }
        const file = await readNativeDocumentAsFile({
          name: pending.localPath.split("/").pop() || "documento",
          mimeType: "application/pdf",
          localPath: pending.localPath,
        })
        if (!file) {
          setStatus("error")
          setMessage("No se pudo leer el documento. Inténtalo de nuevo.")
          return
        }
        const meta = await uploadTransferFile(token, file)
        window.LaVeinteApp?.clearPendingPrintDoc?.()
        setUploaded([meta])
        setStatus("sent")
        console.log("PRINT_FLOW upload_success")
      } catch (e) {
        setStatus("error")
        setMessage(e instanceof Error ? e.message : "No se pudo enviar el documento.")
      }
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
        .catch(() => {
          if (!cancelled) {
            setStatus("error")
            setMessage("No se pudo acceder a la cámara. Permite el acceso o usa otro dispositivo.")
          }
        })

    // Camera is gated BEFORE getUserMedia so the OS prompt is answered first.
    requestCameraGate().then((gate) => {
      if (cancelled) return
      if (gate.granted) {
        setPermanentlyDenied(false)
        startScanner()
      } else {
        setPermanentlyDenied(gate.permanentlyDenied)
        setStatus("permission")
      }
    })

    return () => {
      cancelled = true
      scanner.stop().then(() => scanner.clear()).catch(() => {})
    }
  }, [attempt])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Printer size={32} style={{ color: "var(--primary)" }} />
        <div>
          <strong style={{ display: "block", fontSize: "0.9375rem" }}>Enviar a imprimir</strong>
          <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Escanea el código de la computadora para enviar tu documento.
          </span>
        </div>
      </div>

      {doc && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            padding: "0.625rem 0.75rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            background: "var(--card)",
          }}
        >
          <FileText size={20} style={{ color: "var(--primary)", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {doc.name}
            </p>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
              {formatBytes(doc.fileSize)}
            </p>
          </div>
        </div>
      )}

      {status === "scanning" && (
        <div
          style={{
            position: "relative",
            borderRadius: "var(--radius)",
            overflow: "hidden",
            background: "#0f172a",
            minHeight: 260,
          }}
        >
          <div id="print-qr-reader" style={{ width: "100%", minHeight: 260 }} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              fontSize: "0.875rem",
              background: "rgba(15,23,42,0.7)",
            }}
          >
            Apunta la cámara al código QR…
          </div>
        </div>
      )}

      {status === "uploading" && (
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0, textAlign: "center" }}>
          Enviando documento…
        </p>
      )}

      {status === "sent" && uploaded.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            padding: "0.625rem 0.75rem",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            background: "var(--card)",
          }}
        >
          <span style={{ color: "var(--success, #16a34a)", fontSize: "1.25rem", flexShrink: 0 }}>✓</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600 }}>
              Enviado: {uploaded[0].name}
            </p>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
              Imprímelo desde la computadora.
            </p>
          </div>
        </div>
      )}

      {status === "permission" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center", padding: "1rem 0" }}>
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
          {permanentlyDenied && (
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: 0, textAlign: "center" }}>
              Lo denegaste permanentemente. Actívala desde Ajustes del dispositivo.
            </p>
          )}
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
          <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--error)", fontSize: "0.8125rem", margin: 0, textAlign: "center" }}>
            <WarningCircle size={16} style={{ flexShrink: 0 }} />
            <span>{message}</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setStatus("scanning")
              setMessage(null)
              setAttempt((a) => a + 1)
            }}
          >
            <ArrowsClockwise size={14} /> Reintentar
          </Button>
        </div>
      )}
    </div>
  )
}
