"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  CheckCircle,
  FileText,
  FolderOpen,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react"
import { Button } from "@/shared/components/ui/Button"
import {
  readNativeDocumentAsFile,
  uploadTransferFile,
} from "@/features/transferir/services/transfer"
import { formatBytes } from "@/features/transferir/lib/transfer"
import type { NativeDocumentMeta, TransferFileMeta } from "@/features/transferir/lib/transfer"
import { TransferShell } from "./TransferShell"

const FILE_INPUT_ACCEPT = "image/*,application/pdf"

function nativeSourceLabel(source: string): string {
  if (source.includes("BIOMETRIC")) return "Checadas · Tu Perfil IMSS"
  if (source === "TU_PERFIL") return "Tarjetón · Tu Perfil IMSS"
  if (source === "TARJETON_DIGITAL") return "Tarjetón · Tarjetón Digital"
  return source || "Documento"
}

export function TransferPhonePage({ token }: { token: string }) {
  const [nativeDocs, setNativeDocs] = useState<NativeDocumentMeta[] | null>(null)
  const [uploaded, setUploaded] = useState<TransferFileMeta[]>([])
  const [uploadingPath, setUploadingPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isNative = typeof window !== "undefined" && !!window.LaVeinteApp?.listNativeDocuments

  useEffect(() => {
    if (!isNative) return
    let cancelled = false
    window.LaVeinteApp!.listNativeDocuments()
      .then((docs) => {
        if (!cancelled) setNativeDocs(docs.filter((d) => d.fileSize > 0))
      })
      .catch(() => {
        if (!cancelled) setNativeDocs([])
      })
    return () => {
      cancelled = true
    }
  }, [isNative])

  const submitFile = useCallback(
    async (file: File): Promise<TransferFileMeta | null> => {
      try {
        return await uploadTransferFile(token, file)
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo subir el archivo.")
        return null
      }
    },
    [token],
  )

  const handleNativeDoc = useCallback(
    async (doc: NativeDocumentMeta) => {
      setError(null)
      setUploadingPath(doc.localPath)
      try {
        const file = await readNativeDocumentAsFile(doc)
        if (!file) {
          setError("No se pudo leer el documento. ¿Se movió o eliminó?")
          return
        }
        const meta = await submitFile(file)
        if (meta) setUploaded((prev) => [...prev, meta])
      } finally {
        setUploadingPath(null)
      }
    },
    [submitFile],
  )

  const handleFiles = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return
      setError(null)
      setUploading(true)
      for (const file of Array.from(list)) {
        const meta = await submitFile(file)
        if (meta) setUploaded((prev) => [...prev, meta])
      }
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    },
    [submitFile],
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

      {/* Native saved documents (tarjetones / checadas) — shown only inside the app */}
      {isNative && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 600 }}>
            Tus documentos guardados
          </p>
          {nativeDocs === null ? (
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
              Cargando…
            </p>
          ) : nativeDocs.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
              No tienes tarjetones ni checadas guardados en esta app.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {nativeDocs.map((doc) => {
                const busy = uploadingPath === doc.localPath
                return (
                  <button
                    key={`${doc.id}-${doc.localPath}`}
                    type="button"
                    disabled={busy || !!uploadingPath}
                    onClick={() => handleNativeDoc(doc)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.625rem",
                      width: "100%",
                      padding: "0.625rem 0.75rem",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      background: "var(--card)",
                      cursor: busy ? "default" : "pointer",
                      textAlign: "left",
                      font: "inherit",
                      color: "inherit",
                      opacity: busy ? 0.7 : 1,
                    }}
                  >
                    <FolderOpen size={20} style={{ color: "var(--primary)", flexShrink: 0 }} />
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
                        {doc.name}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                        {nativeSourceLabel(doc.source)} · {formatBytes(doc.fileSize)}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--primary)",
                        flexShrink: 0,
                      }}
                    >
                      {busy ? "Enviando…" : "Enviar"}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={FILE_INPUT_ACCEPT}
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <Button
        fullWidth
        variant="outline"
        loading={uploading}
        onClick={() => inputRef.current?.click()}
        style={{ justifyContent: "center", minHeight: 48 }}
      >
        <FileText size={18} />
        {uploading ? "Subiendo…" : "Otro archivo del teléfono"}
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
