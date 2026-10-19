"use client"

import { useEffect, type CSSProperties } from "react"
import { ArrowLeft, X, BookOpen } from "lucide-react"
import Link from "next/link"
import { FullscreenPortal } from "@/shared/components/ui/FullscreenPortal"
import { PdfViewer } from "@/shared/components/normativa/PdfViewer"
import type { SavedNormativaDoc } from "../services/normativa-boveda"

interface Props {
  open: boolean
  doc: SavedNormativaDoc | null
  onClose: () => void
}

export function NormativaDocViewerModal({ open, doc, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const stateKey = `normativa-modal-${Date.now()}`
    window.history.pushState({ modal: stateKey }, "")
    let closedByPop = false

    const handlePopState = () => {
      closedByPop = true
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
      if (!closedByPop && window.history.state?.modal === stateKey) {
        window.history.back()
      }
    }
  }, [open])

  if (!open || !doc) return null

  const isCctOrEstatutos =
    doc.id.toLowerCase().includes("cct") ||
    doc.id.toLowerCase().includes("estatutos") ||
    doc.category === "cct" ||
    doc.category === "sntss"

  return (
    <FullscreenPortal open={open} onClose={onClose} ariaLabel="Visor de documento normativo">
      <div style={fullscreenContainerStyle} role="dialog" aria-modal="true">
        {/* BARRA SUPERIOR FIJA */}
        <div style={fullscreenHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: 1, overflow: "hidden" }}>
            <button
              type="button"
              onClick={onClose}
              style={backBtnStyle}
              title="Volver a mi Bóveda"
              aria-label="Volver a mi Bóveda"
            >
              <ArrowLeft size={16} />
              <span style={{ fontWeight: 700 }}>Volver</span>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0, overflow: "hidden" }}>
              {doc.key && (
                <span style={keyBadgeStyle}>
                  {doc.key}
                </span>
              )}
              <h2 style={headerTitleStyle}>
                {doc.title}
              </h2>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexShrink: 0 }}>
            {isCctOrEstatutos && (
              <Link
                href="/biblioteca-normativa"
                style={navLinkStyle}
                title="Explorar articulado interactivo en la Biblioteca Normativa"
              >
                <BookOpen size={14} />
                <span>Ver artículos</span>
              </Link>
            )}

            <button
              type="button"
              onClick={onClose}
              style={headerCloseBtn}
              aria-label="Cerrar visor"
              title="Cerrar (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* CUERPO DEL LECTOR */}
        <div style={fullscreenBodyStyle}>
          <PdfViewer
            documentId={doc.id}
            officialUrl={doc.url}
            title={doc.title}
            keyLabel={doc.key ?? undefined}
            category={doc.category}
          />
        </div>
      </div>
    </FullscreenPortal>
  )
}

const fullscreenContainerStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "#0f172a",
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
}

const fullscreenHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.45rem 0.85rem",
  background: "#0f172a",
  borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
  gap: "0.5rem",
  flexShrink: 0,
}

const fullscreenBodyStyle: CSSProperties = {
  flex: 1,
  width: "100%",
  height: "100%",
  overflow: "hidden",
  background: "#1e293b",
  position: "relative",
}

const backBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.35rem 0.65rem",
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.1)",
  color: "#f8fafc",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  fontSize: "0.8rem",
  cursor: "pointer",
  flexShrink: 0,
}

const keyBadgeStyle: CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 700,
  padding: "0.15rem 0.5rem",
  background: "rgba(37, 99, 235, 0.25)",
  color: "#bfdbfe",
  borderRadius: 999,
  flexShrink: 0,
}

const headerTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(0.85rem, 2.5vw, 1.05rem)",
  fontWeight: 700,
  color: "#f8fafc",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}

const navLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.35rem 0.65rem",
  borderRadius: 8,
  background: "rgba(37, 99, 235, 0.15)",
  color: "#93c5fd",
  border: "1px solid rgba(37, 99, 235, 0.3)",
  fontSize: "0.78rem",
  fontWeight: 600,
  textDecoration: "none",
  flexShrink: 0,
}

const headerCloseBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.08)",
  color: "#cbd5e1",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  cursor: "pointer",
  flexShrink: 0,
}
