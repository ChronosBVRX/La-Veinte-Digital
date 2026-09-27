"use client"

import { useState, useEffect } from "react"
import {
  Download,
  CheckCircle,
  FileText,
  Trash2,
  HardDrive,
  Loader2,
} from "lucide-react"
import {
  OFFLINE_NORMATIVA_DOCS,
  isNormativaDocDownloaded,
  downloadNormativaDoc,
  deleteOfflineNormativaDoc,
  getOfflineDocUrl,
} from "@/shared/services/normativa-offline-manager"
import { Button } from "@/shared/components/ui/Button"

interface Props {
  docId: string
  onOpenViewer?: (url: string, title: string) => void
}

export function NormativaOfflineDownloadCard({ docId, onOpenViewer }: Props) {
  const doc = OFFLINE_NORMATIVA_DOCS[docId]
  const [downloaded, setDownloaded] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [downloading, setDownloading] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    isNormativaDocDownloaded(docId)
      .then((isDl) => {
        if (active) {
          setDownloaded(isDl)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [docId])

  if (!doc) return null

  const handleDownload = async () => {
    setErrorMsg(null)
    setDownloading(true)
    setProgress(5)

    const res = await downloadNormativaDoc(docId, (pct) => setProgress(pct))
    setDownloading(false)

    if (res.ok) {
      setDownloaded(true)
      setProgress(100)
    } else {
      setErrorMsg(res.error || "Error al descargar el documento.")
    }
  }

  const handleDelete = async () => {
    if (!window.confirm("¿Deseas eliminar la copia local de este documento?")) return
    const ok = await deleteOfflineNormativaDoc(docId)
    if (ok) {
      setDownloaded(false)
    }
  }

  const handleOpen = async () => {
    const url = await getOfflineDocUrl(docId)
    if (url) {
      if (onOpenViewer) {
        onOpenViewer(url, doc.shortTitle)
      } else {
        window.open(url, "_blank")
      }
    } else if (typeof window !== "undefined" && window.LaVeinteApp?.openSavedDocuments) {
      window.LaVeinteApp.openSavedDocuments()
    } else {
      window.open(doc.url, "_blank")
    }
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "0.5rem",
              background: downloaded ? "rgba(22, 163, 74, 0.1)" : "rgba(37, 99, 235, 0.1)",
              color: downloaded ? "#16a34a" : "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {downloaded ? <CheckCircle size={20} /> : <HardDrive size={20} />}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
              {doc.title}
            </h4>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.4 }}>
              {doc.description}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0 }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "0.2rem 0.5rem",
              borderRadius: "0.25rem",
              background: downloaded ? "rgba(22, 163, 74, 0.15)" : "var(--accent)",
              color: downloaded ? "#15803d" : "var(--muted)",
            }}
          >
            {downloaded ? "Guardado offline" : doc.sizeFormatted}
          </span>
        </div>
      </div>

      {downloading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)" }}>
            <span>Descargando documento oficial completo...</span>
            <span>{progress}%</span>
          </div>
          <div
            style={{
              height: 6,
              width: "100%",
              background: "var(--border)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "var(--primary)",
                transition: "width 0.2s ease",
              }}
            />
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{ fontSize: "0.8125rem", color: "#dc2626", background: "#fef2f2", padding: "0.5rem", borderRadius: "0.375rem" }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", paddingTop: "0.25rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {downloaded ? (
            <>
              <Button variant="primary" size="sm" onClick={handleOpen}>
                <FileText size={14} />
                <span style={{ marginLeft: "0.375rem" }}>Abrir original local</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete} title="Eliminar copia para liberar espacio">
                <Trash2 size={14} color="var(--muted)" />
                <span style={{ marginLeft: "0.375rem", color: "var(--muted)" }}>Eliminar copia</span>
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleDownload}
              disabled={loading || downloading}
            >
              {downloading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span style={{ marginLeft: "0.375rem" }}>Descargando ({progress}%)</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span style={{ marginLeft: "0.375rem" }}>Descargar para consulta sin conexión ({doc.sizeFormatted})</span>
                </>
              )}
            </Button>
          )}
        </div>

        {typeof window !== "undefined" && window.LaVeinteApp?.isNativeApp() && (
          <button
            type="button"
            onClick={() => window.LaVeinteApp?.openSavedDocuments?.()}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary)",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            Ver en Mis Documentos →
          </button>
        )}
      </div>
    </div>
  )
}
