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
import { waitForLaVeinteNativeBridge } from "./native"
import { describeScannerError } from "./scannerError"
import type { ScannerErrorContext } from "./scannerError"
import { extractTransferToken, formatBytes } from "@/features/transferir/lib/transfer"
import type { TransferFileMeta } from "@/features/transferir/lib/transfer"

type Status = "boot" | "no-doc" | "permission" | "scanning" | "uploading" | "sent" | "error"

/**
 * "Enviar a imprimir" flow. Strict ordering (instruction #2):
 *   1. detect native shell (by UA)
 *   2. wait for the native bridge (document-start or onPageFinished injection)
 *   3. read the pending document (getPendingPrintDoc) — this is a readiness gate
 *   4. if there's no pending doc, show "no encontramos el documento" and STOP (no camera)
 *   5. request CAMERA and wait for the grant
 *   6. only when granted === true → Html5Qrcode.start()
 */
export function PrintSendPanel() {
  const [status, setStatus] = useState<Status>("boot")
  const [message, setMessage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [permanentlyDenied, setPermanentlyDenied] = useState(false)
  const [doc, setDoc] = useState<{ name: string; localPath: string; fileSize: number } | null>(null)
  const [uploaded, setUploaded] = useState<TransferFileMeta[]>([])
  const [ctx, setCtx] = useState<ScannerErrorContext>({ bridgeReady: false, nativeShell: false })
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (typeof window === "undefined") return
      // 1 + 2. wait for the native bridge (never treat missing bridge as browser when native).
      const bridge = await waitForLaVeinteNativeBridge()
      if (cancelled) return
      const nativeShell = bridge.isNative
      setCtx({ bridgeReady: bridge.ready, nativeShell })

      // 3. readiness gate: read the pending document before touching the camera.
      let pending: { localPath: string } | null = null
      if (bridge.isNative && bridge.ready && window.LaVeinteApp?.getPendingPrintDoc) {
        try {
          pending = await window.LaVeinteApp.getPendingPrintDoc()
        } catch {
          pending = null
        }
      }
      if (cancelled) return

      if (bridge.isNative && !pending?.localPath) {
        setStatus("no-doc")
        setMessage("No encontramos el documento que quieres enviar. Vuelve a intentarlo desde el visor.")
        return
      }

      // Show the doc card only after we truly know which file will be sent.
      if (pending?.localPath) {
        const file = await readNativeDocumentAsFile({
          name: pending.localPath.split("/").pop() || "documento",
          mimeType: "application/pdf",
          localPath: pending.localPath,
        })
        if (cancelled) return
        if (file) {
          setDoc({ name: file.name, localPath: pending.localPath, fileSize: file.size })
        }
      }

      // 4 + 5. camera gate (waits for the grant, never races getUserMedia).
      const gate = await requestCameraGate()
      if (cancelled) return
      if (!gate.granted) {
        setPermanentlyDenied(gate.permanentlyDenied)
        setStatus("permission")
        return
      }
      setPermanentlyDenied(false)
      // 6. only now start the scanner.
      const scanner = new Html5Qrcode("print-qr-reader", false)
      scannerRef.current = scanner

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 320 } },
          onQr,
          () => {},
        )
        .then(() => {
          if (!cancelled) {
            setStatus("scanning")
            console.log("PRINT_FLOW scanner_started")
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setStatus("error")
            setMessage(describeScannerError(error, ctx))
          }
        })
    }

    const onQr = async (decodedText: string) => {
      if (handledRef.current) return
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
          setStatus("no-doc")
          setMessage("No encontramos el documento que quieres enviar. Vuelve a intentarlo.")
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

    run()

    return () => {
      cancelled = true
      scannerRef.current?.stop().then(() => scannerRef.current?.clear()).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {status === "boot" && (
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0, textAlign: "center" }}>
          Preparando…
        </p>
      )}

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
              setStatus("boot")
              setMessage(null)
              setAttempt((a) => a + 1)
            }}
          >
            <GearSix size={14} />
            {permanentlyDenied ? "Abrir ajustes" : "Permitir cámara"}
          </Button>
        </div>
      )}

      {status === "no-doc" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" }}>
          <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--error)", fontSize: "0.8125rem", margin: 0, textAlign: "center" }}>
            <WarningCircle size={16} style={{ flexShrink: 0 }} />
            <span>{message}</span>
          </p>
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
              setStatus("boot")
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
