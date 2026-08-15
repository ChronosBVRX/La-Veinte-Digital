"use client"

import type { CSSProperties } from "react"
import { FileText, ShieldCheck, ShieldAlert, AlertTriangle, ExternalLink } from "lucide-react"
import type { LibraryDocumentEntry } from "../services/catalog"

interface Props {
  doc: LibraryDocumentEntry
  onOpen: () => void
}

function validityBadge(doc: LibraryDocumentEntry): { label: string; color: string } {
  switch (doc.validity) {
    case "CURRENT":
      return { label: "🟢 VIGENTE", color: "#15803d" }
    case "PENDING_REVIEW":
      return { label: "🟡 VIGENCIA A VERIFICAR", color: "#b45309" }
    case "HISTORICAL":
      return { label: "🔵 HISTÓRICO", color: "#1d4ed8" }
    case "EXPIRED":
    case "SUPERSEDED":
    case "REPEALED":
      return { label: `⚪ ${doc.validity}`, color: "#64748b" }
    default:
      return { label: "⚪ SIN DETERMINAR", color: "#64748b" }
  }
}

export function DocumentCard({ doc, onOpen }: Props) {
  const v = validityBadge(doc)
  const needsReview = doc.validity === "PENDING_REVIEW" || doc.validity === "UNKNOWN" || doc.verificationStatus != null || doc.versionStatus === "SOURCE_MISMATCH"

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: "0.5rem",
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
        padding: "1rem", cursor: "pointer", transition: "box-shadow var(--transition)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
      onClick={onOpen}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: 999, background: "var(--accent)", color: v.color }}>
          {v.label}
        </span>
        {needsReview && doc.versionStatus !== "SOURCE_MISMATCH" && (
          <span style={{ fontSize: "0.72rem", padding: "0.2rem 0.55rem", borderRadius: 999, background: "#fef3c7", color: "#92400e" }}>
            ⚠ verificar
          </span>
        )}
        {doc.versionStatus === "SOURCE_MISMATCH" && (
          <span style={{ fontSize: "0.72rem", padding: "0.2rem 0.55rem", borderRadius: 999, background: "#fee2e2", color: "#991b1b" }}>
            ✗ discrepancia de clave
          </span>
        )}
      </div>

      <div style={{ fontWeight: 600, fontSize: "0.925rem", lineHeight: 1.35 }}>{doc.title}</div>
      <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
        {doc.organization.join(", ")} · {doc.key ? `Clave ${doc.key}` : doc.type}
      </div>

      {(doc.effectiveFrom || doc.effectiveUntil) && (
        <div style={{ fontSize: "0.8rem" }}>
          {doc.effectiveFrom ?? "?"} → {doc.effectiveUntil ?? "?"}
          {doc.lastReformDate ? ` · Reforma ${doc.lastReformDate}` : ""}
        </div>
      )}

      <div style={{ fontSize: "0.8rem", color: "var(--muted)", display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
        <span><FileText size={13} style={{ verticalAlign: -2 }} /> {doc.pages ?? "?"} págs</span>
        <span>{doc.sections} secciones</span>
        <span>{doc.chunks} fragmentos</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: "var(--muted)" }}>
        {doc.canonical ? <ShieldCheck size={14} color="#15803d" /> : <ShieldAlert size={14} color="#b45309" />}
        Fuente {doc.canonical ? "oficial" : doc.provenance.toLowerCase()}
        {doc.sha256 && <code style={{ fontSize: "0.7rem" }}>{doc.sha256.slice(0, 10)}…</code>}
      </div>

      {doc.warning && (
        <div style={{ fontSize: "0.75rem", color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: "0.5rem", display: "flex", gap: "0.4rem", alignItems: "flex-start" }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{doc.warning}</span>
        </div>
      )}

      <div style={{ marginTop: "auto", display: "flex", gap: "0.5rem" }}>
        <span style={actionStyle}>Abrir</span>
        {doc.url && (
          <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ ...actionStyle, textDecoration: "none" }}>
            <ExternalLink size={13} /> Fuente oficial
          </a>
        )}
      </div>
    </div>
  )
}

const actionStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.3rem",
  fontSize: "0.78rem", padding: "0.35rem 0.7rem", borderRadius: "var(--radius)",
  background: "var(--accent)", color: "var(--fg)",
}
