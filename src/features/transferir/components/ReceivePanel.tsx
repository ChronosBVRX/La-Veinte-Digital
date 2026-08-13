"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowsClockwise,
  ArrowDown,
  Eye,
  FileText,
  QrCode,
  WarningCircle,
} from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { useTransferSession } from "@/features/transferir/hooks/useTransferSession"
import {
  downloadTransferFile,
  getTransferFile,
  openTransferFile,
} from "@/features/transferir/services/transfer"
import { formatBytes } from "@/features/transferir/lib/transfer"
import type { TransferFileMeta } from "@/features/transferir/lib/transfer"
import { TransferQr } from "./TransferQr"

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

export function ReceivePanel() {
  const { session, files, status, error, start, close } = useTransferSession()
  const [busyFile, setBusyFile] = useState<string | null>(null)

  useEffect(() => {
    start()
    return () => {
      close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const qrUrl = useMemo(() => {
    if (!session) return ""
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/transfer?t=${session.token}`
  }, [session])

  const handleOpen = useCallback(
    async (file: TransferFileMeta) => {
      if (!session) return
      setBusyFile(file.id)
      try {
        const full = await getTransferFile(session.ownerToken, file.id)
        openTransferFile(full)
      } catch {
        /* ignore */
      } finally {
        setBusyFile(null)
      }
    },
    [session],
  )

  const handleDownload = useCallback(
    async (file: TransferFileMeta) => {
      if (!session) return
      setBusyFile(file.id)
      try {
        const full = await getTransferFile(session.ownerToken, file.id)
        downloadTransferFile(full)
      } catch {
        /* ignore */
      } finally {
        setBusyFile(null)
      }
    },
    [session],
  )

  if (status === "creating" || status === "idle") {
    return (
      <div style={{ textAlign: "center", padding: "1rem 0" }}>
        <QrCode size={40} style={{ color: "var(--primary)" }} />
        <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
          Generando código de conexión…
        </p>
      </div>
    )
  }

  if (status === "error" || !session) {
    return (
      <div style={{ textAlign: "center", padding: "1rem 0" }}>
        <WarningCircle size={40} style={{ color: "var(--error)" }} />
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.5rem 0 1rem" }}>
          {error ?? "No se pudo iniciar la transferencia."}
        </p>
        <Button onClick={() => start()}>
          <ArrowsClockwise size={16} /> Intentar de nuevo
        </Button>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={STEP_STYLE}>
          <span style={STEP_NUM}>1</span>
          <span style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
            Escanea el código con la cámara del otro dispositivo.
          </span>
        </div>
        <div style={STEP_STYLE}>
          <span style={STEP_NUM}>2</span>
          <span style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
            En ese dispositivo, elige el documento (foto o PDF).
          </span>
        </div>
        <div style={STEP_STYLE}>
          <span style={STEP_NUM}>3</span>
          <span style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
            El archivo aparecerá aquí al instante para abrirlo o imprimirlo.
          </span>
        </div>
      </div>

      <TransferQr
        value={qrUrl}
        caption="Código único y temporal. Se elimina al cerrar o al expirar."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
            Archivos recibidos ({files.length})
          </span>
          <Button size="sm" variant="ghost" onClick={() => start()}>
            <ArrowsClockwise size={14} /> Nuevo código
          </Button>
        </div>

        {files.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontSize: "0.8125rem",
              color: "var(--muted)",
              padding: "0.75rem 0",
              textAlign: "center",
            }}
          >
            Esperando documentos…
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {files.map((file) => (
              <li
                key={file.id}
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
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {file.name}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                    {formatBytes(file.sizeBytes)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyFile === file.id}
                  onClick={() => handleOpen(file)}
                >
                  <Eye size={14} /> Abrir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyFile === file.id}
                  onClick={() => handleDownload(file)}
                  aria-label="Descargar"
                >
                  <ArrowDown size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
