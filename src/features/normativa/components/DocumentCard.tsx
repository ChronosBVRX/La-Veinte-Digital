"use client"

import { FileText, ShieldCheck, ShieldAlert, AlertTriangle, BookOpen } from "lucide-react"
import type { LibraryDocumentEntry } from "../services/catalog"
import { getOrSynthesizePreambulo, formatDocSubtitle, formatTipoDocumento } from "../lib/preambulo-helper"

interface Props {
  doc: LibraryDocumentEntry
  onOpen: () => void
}

function validityBadge(doc: LibraryDocumentEntry): { label: string; color: string } {
  switch (doc.validity) {
    case "CURRENT":
      return { label: "🟢 VIGENTE", color: "#15803d" }
    case "PENDING_REVIEW":
      return { label: "🟡 EN REVISIÓN", color: "#b45309" }
    case "HISTORICAL":
      return { label: "🔵 HISTÓRICO", color: "#1d4ed8" }
    case "EXPIRED":
      return { label: "⚪ VENCIDO", color: "#64748b" }
    case "SUPERSEDED":
      return { label: "⚪ SUSTITUIDO", color: "#64748b" }
    case "REPEALED":
      return { label: "⚪ ABROGADO", color: "#64748b" }
    default:
      return { label: "⚪ CONSULTABLE", color: "#64748b" }
  }
}

export function DocumentCard({ doc, onOpen }: Props) {
  const v = validityBadge(doc)
  const preambulo = getOrSynthesizePreambulo(doc)
  const subtitle = formatDocSubtitle(doc)

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: "0.55rem",
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
        padding: "1rem", cursor: "pointer", transition: "box-shadow var(--transition)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen() } }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: 999, background: "var(--accent)", color: v.color }}>
          {v.label}
        </span>
        {doc.key && (
          <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: 999, background: "rgba(37, 99, 235, 0.08)", color: "var(--primary)" }}>
            Clave {doc.key}
          </span>
        )}
        <span style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem", borderRadius: 999, background: "var(--accent)", color: "var(--muted)" }}>
          {formatTipoDocumento(doc.type)}
        </span>
        {doc.versionStatus === "SOURCE_MISMATCH" && (
          <span style={{ fontSize: "0.72rem", padding: "0.2rem 0.55rem", borderRadius: 999, background: "#fef3c7", color: "#92400e" }}>
            ⚠ En actualización
          </span>
        )}
      </div>

      <div style={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.35, color: "var(--fg)" }}>
        {doc.title}
      </div>

      {subtitle && (
        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
          {subtitle}
        </div>
      )}

      {preambulo && (
        <div
          style={{
            fontSize: "0.8rem",
            color: "var(--fg)",
            background: "rgba(37, 99, 235, 0.04)",
            border: "1px solid rgba(37, 99, 235, 0.15)",
            borderRadius: "var(--radius)",
            padding: "0.5rem 0.65rem",
            lineHeight: 1.4,
          }}
        >
          <span style={{ fontWeight: 700, color: "var(--primary)" }}>En cristiano: </span>
          {preambulo.enUnaFrase}
        </div>
      )}

      {(doc.effectiveFrom || doc.effectiveUntil) && (
        <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
          {doc.effectiveFrom ?? "Vigente"} → {doc.effectiveUntil ?? "Indefinido"}
          {doc.lastReformDate ? ` · Reforma ${doc.lastReformDate}` : ""}
        </div>
      )}

      <div style={{ fontSize: "0.78rem", color: "var(--muted)", display: "flex", gap: "0.9rem", flexWrap: "wrap", alignItems: "center" }}>
        {doc.pages && doc.pages > 0 ? (
          <span><FileText size={13} style={{ verticalAlign: -2 }} /> {doc.pages} págs</span>
        ) : (
          <span><FileText size={13} style={{ verticalAlign: -2 }} /> Documento oficial</span>
        )}
        {doc.sections && doc.sections > 0 ? (
          <span>{doc.sections} artículos y cláusulas</span>
        ) : (
          <span>Texto íntegro oficial</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.75rem", color: "var(--muted)" }}>
        {doc.canonical ? <ShieldCheck size={14} color="#15803d" /> : <ShieldAlert size={14} color="#b45309" />}
        Fuente {doc.canonical ? "oficial verificada" : "institucional"}
      </div>

      {doc.warning && (
        <div style={{ fontSize: "0.75rem", color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: "0.5rem", display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{doc.warning}</span>
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: "0.35rem" }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.45rem",
            fontSize: "0.825rem",
            fontWeight: 600,
            padding: "0.5rem 0.85rem",
            borderRadius: "var(--radius)",
            background: "var(--primary)",
            color: "var(--primary-fg)",
            width: "100%",
            border: "none",
            cursor: "pointer",
            transition: "opacity 0.15s ease",
          }}
        >
          <BookOpen size={15} /> Leer documento en la app
        </button>
      </div>
    </div>
  )
}
