"use client"

import { useCallback, useRef, useState } from "react"
import {
  CheckCircle,
  FileText,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import { uploadTransferFile } from "@/features/transferir/services/transfer"
import { formatBytes } from "@/features/transferir/lib/transfer"
import type { TransferFileMeta } from "@/features/transferir/lib/transfer"
import { TransferShell } from "./TransferShell"

export function TransferPhonePage({ token }: { token: string }) {
  const [uploaded, setUploaded] = useState<TransferFileMeta[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return
      setError(null)
      setUploading(true)
      for (const file of Array.from(list)) {
        try {
          const meta = await uploadTransferFile(token, file)
          setUploaded((prev) => [...prev, meta])
        } catch (e) {
          setError(e instanceof Error ? e.message : "No se pudo subir el archivo.")
          break
        }
      }
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    },
    [token],
  )

  return (
    <TransferShell>
      <div style={{ textAlign: "center" }}>
        <UploadSimple size={40} style={{ color: "var(--primary)" }} />
        <h1 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0.75rem 0 0.25rem" }}>
          Enviar documento
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
          El archivo aparecerá en el dispositivo conectado.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <Button
        fullWidth
        loading={uploading}
        onClick={() => inputRef.current?.click()}
        style={{ justifyContent: "center", minHeight: 52 }}
      >
        <FileText size={18} />
        {uploading ? "Subiendo…" : "Elegir documento"}
      </Button>

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "var(--error)",
            fontSize: "0.8125rem",
            background: "var(--state-error-bg)",
            padding: "0.625rem 0.875rem",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <WarningCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {uploaded.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600 }}>
            Enviados ({uploaded.length})
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {uploaded.map((file) => (
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
                <CheckCircle size={20} style={{ color: "var(--success, #16a34a)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.name}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                    {formatBytes(file.sizeBytes)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)", textAlign: "center" }}>
            Revisa el otro dispositivo: tu documento ya está ahí.
          </p>
        </div>
      )}
    </TransferShell>
  )
}
