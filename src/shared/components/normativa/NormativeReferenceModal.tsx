"use client"

import { useState, useMemo, type CSSProperties } from "react"
import {
  X,
  BookOpen,
  Copy,
  Check,
  Share2,
  FileText,
  Search,
} from "lucide-react"
import {
  getClausula,
  getArticuloEstatutos,
  findNormativaByConceptCode,
  searchNormativaOffline,
  type NormativaItem,
} from "@/shared/lib/normativa-lookup"
import { Button } from "@/shared/components/ui/Button"

export interface NormativeReferenceTarget {
  clause?: string | number
  article?: string | number
  conceptCode?: string
  term?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  target?: NormativeReferenceTarget | null
  onOpenFullPdf?: (docId: string, page?: number) => void
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.65)",
  backdropFilter: "blur(4px)",
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
}

const panelStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "1rem",
  width: "100%",
  maxWidth: "680px",
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  overflow: "hidden",
  color: "var(--fg)",
}

function resolveTargetItem(target?: NormativeReferenceTarget | null): NormativaItem | null {
  if (!target) {
    return getClausula(1) || null
  }
  if (target.conceptCode) {
    const match = findNormativaByConceptCode(target.conceptCode)
    if (match) return match
  }
  if (target.clause) {
    const match = getClausula(target.clause)
    if (match) return match
  }
  if (target.article) {
    const match = getArticuloEstatutos(target.article)
    if (match) return match
  }
  if (target.term) {
    const results = searchNormativaOffline(target.term)
    if (results.length > 0) return results[0]
  }
  return getClausula(1) || null
}

export function NormativeReferenceModal({
  isOpen,
  onClose,
  target,
  onOpenFullPdf,
}: Props) {
  if (!isOpen) return null

  return (
    <NormativeReferenceModalDialog
      onClose={onClose}
      target={target}
      onOpenFullPdf={onOpenFullPdf}
    />
  )
}

function NormativeReferenceModalDialog({
  onClose,
  target,
  onOpenFullPdf,
}: Omit<Props, "isOpen">) {
  const initialItem = useMemo(() => resolveTargetItem(target), [target])
  const [selectedItem, setSelectedItem] = useState<NormativaItem | null>(initialItem)
  const [prevTarget, setPrevTarget] = useState(target)
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  if (target !== prevTarget) {
    setPrevTarget(target)
    setSelectedItem(initialItem)
    setSearchQuery("")
    setCopied(false)
  }

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return []
    return searchNormativaOffline(searchQuery).slice(0, 8)
  }, [searchQuery])

  const handleCopy = async () => {
    if (!selectedItem) return
    const textToCopy = `${selectedItem.documento}\n${selectedItem.capitulo}\n${selectedItem.titulo}\n\n${selectedItem.texto}`
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const handleShare = () => {
    if (!selectedItem) return
    const title = `${selectedItem.titulo} - ${selectedItem.documento}`
    const text = `${selectedItem.titulo} (${selectedItem.capitulo}):\n\n${selectedItem.texto}`

    if (typeof window !== "undefined" && window.LaVeinteApp?.share) {
      window.LaVeinteApp.share(title, text)
      return
    }

    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title, text }).catch(() => {})
    } else {
      handleCopy()
    }
  }

  const isCct = selectedItem?.documentId === "CCT-IMSS-SNTSS-2025-2027"

  return (
    <div style={overlayStyle} onClick={onClose} role="dialog" aria-modal="true">
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--accent)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "0.5rem",
                background: isCct ? "rgba(37, 99, 235, 0.12)" : "rgba(16, 185, 129, 0.12)",
                color: isCct ? "var(--primary)" : "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BookOpen size={18} />
            </div>
            <div>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: isCct ? "var(--primary)" : "#10b981",
                }}
              >
                {isCct ? "CCT IMSS–SNTSS 2025–2027" : "Estatutos SNTSS (Ed. 2022)"}
              </span>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)", fontWeight: 500 }}>
                Referencia Oficial · Consulta Rápida Offline
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              padding: "0.375rem",
              borderRadius: "0.375rem",
              color: "var(--muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Search inside modal */}
        <div
          style={{
            padding: "0.625rem 1.25rem",
            borderBottom: "1px solid var(--border)",
            background: "var(--card)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Search size={16} color="var(--muted)" />
          <input
            type="text"
            placeholder="Buscar otra cláusula o artículo (ej. 47, 107, aguinaldo, vacaciones)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: "0.8125rem",
              color: "var(--fg)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "none",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                padding: "2px",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown (if searching) */}
        {searchResults.length > 0 && (
          <div
            style={{
              maxHeight: "180px",
              overflowY: "auto",
              borderBottom: "1px solid var(--border)",
              background: "var(--accent)",
              padding: "0.25rem 0.5rem",
            }}
          >
            {searchResults.map((res) => (
              <div
                key={res.id}
                onClick={() => {
                  setSelectedItem(res)
                  setSearchQuery("")
                }}
                style={{
                  padding: "0.375rem 0.625rem",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.8125rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div>
                  <strong style={{ color: "var(--primary)" }}>
                    {res.tipo === "cct" ? `Cláusula ${res.numero}` : `Artículo ${res.numero}`}:
                  </strong>{" "}
                  <span>{res.titulo}</span>
                </div>
                <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
                  {res.tipo === "cct" ? "CCT" : "Estatutos"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Content Body */}
        <div
          style={{
            padding: "1.25rem",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "0.875rem",
          }}
        >
          {selectedItem ? (
            <>
              <div>
                <div
                  style={{
                    display: "inline-block",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    background: "var(--accent)",
                    color: "var(--muted)",
                    marginBottom: "0.375rem",
                  }}
                >
                  {selectedItem.capitulo}
                </div>
                <h3
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 700,
                    margin: 0,
                    color: "var(--fg)",
                    lineHeight: 1.35,
                  }}
                >
                  {isCct
                    ? `Cláusula ${selectedItem.numero}.- ${selectedItem.titulo}`
                    : `Artículo ${selectedItem.numero}`}
                </h3>
              </div>

              <div
                style={{
                  fontSize: "0.875rem",
                  lineHeight: 1.7,
                  color: "var(--fg)",
                  whiteSpace: "pre-line",
                  background: "var(--accent)",
                  padding: "1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                  userSelect: "text",
                }}
              >
                {selectedItem.texto}
              </div>

              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: "0.25rem",
                }}
              >
                <span>Fuente oficial digitalizada (Página aprox. {selectedItem.paginaPdf})</span>
                <span>Texto legal canónico</span>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
              No se encontró la referencia solicitada.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "0.875rem 1.25rem",
            borderTop: "1px solid var(--border)",
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              disabled={!selectedItem}
            >
              {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              <span style={{ marginLeft: "0.375rem" }}>{copied ? "¡Copiado!" : "Copiar texto"}</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleShare}
              disabled={!selectedItem}
            >
              <Share2 size={14} />
              <span style={{ marginLeft: "0.375rem" }}>Compartir</span>
            </Button>
          </div>

          {onOpenFullPdf && selectedItem && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenFullPdf(selectedItem.documentId, selectedItem.paginaPdf)}
            >
              <FileText size={14} />
              <span style={{ marginLeft: "0.375rem" }}>Ver en PDF original</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
