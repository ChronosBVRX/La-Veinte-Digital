"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { ArrowsClockwise, FileText, Printer, WarningCircle } from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import {
  readNativeDocumentAsFile,
  uploadTransferFile,
} from "@/features/transferir/services/transfer"
import { formatBytes } from "@/features/transferir/lib/transfer"
import type { TransferFileMeta } from "@/features/transferir/lib/transfer"

const ALLOWED_TRANSFER_HOSTS = [
  "la-veinte-digital.vercel.app",
  "laveinte-digital.vercel.app",
  "la-veinte-digital.pages.dev",
  "la20.com.mx",
  "www.la20.com.mx",
]

function extractUploadUrl(text: string): string | null {
  try {
    const url = new URL(text)
    if (!ALLOWED_TRANSFER_HOSTS.includes(url.hostname)) return null
    if (url.pathname !== "/transfer") return null
    const token = url.searchParams.get("t")
    if (!token) return null
    return token
  } catch {
    return null
  }
}

/**
 * "Enviar a imprimir" flow: shows the native doc to send, then scans the PC's transfer QR. Once a
 * valid token is detected, the pending native document is read and uploaded automatically.
 */
export function PrintSendPanel() {
  const [status, setStatus] = useState<"scanning" | "uploading" | "sent" | "error">("scanning")
  const [message, setMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
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

    if (typeof window !== "undefined" && window.LaVeinteApp?.requestCameraPermission) {
      try {
        window.LaVeinteApp.requestCameraPermission()
      } catch {
        /* fallback below */
      }
    }

    const onSuccess = async (decodedText: string) => {
      if (cancelled || handledRef.current) return
      const token = extractUploadUrl(decodedText)
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
      } catch (e) {
        setStatus("error")
        setMessage(e instanceof Error ? e.message : "No se pudo enviar el documento.")
      }
    }

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
