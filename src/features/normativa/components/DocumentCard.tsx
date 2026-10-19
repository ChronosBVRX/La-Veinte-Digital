"use client"

import { BookOpen } from "lucide-react"
import type { LibraryDocumentEntry } from "../services/catalog"
import { getOrSynthesizePreambulo, formatDocSubtitle } from "../lib/preambulo-helper"

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
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "0.45rem",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "0.65rem 0.65rem 0.55rem",
        cursor: "pointer",
        transition: "box-shadow var(--transition)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        boxSizing: "border-box",
        minHeight: 165,
        position: "relative",
      }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div>
        {/* Cabecera con Badge y Clave */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.25rem",
            marginBottom: "0.35rem",
          }}
        >
          <span
            style={{
              fontSize: "0.66rem",
              fontWeight: 700,
              padding: "0.15rem 0.4rem",
              borderRadius: 4,
              background: "var(--accent)",
              color: v.color,
              whiteSpace: "nowrap",
            }}
          >
            {v.label}
          </span>
          {doc.key && (
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                padding: "0.15rem 0.35rem",
                borderRadius: 4,
                background: "rgba(37, 99, 235, 0.08)",
                color: "var(--primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "50%",
              }}
            >
              {doc.key}
            </span>
          )}
        </div>

        {/* Título: Máximo 2 líneas */}
        <h3
          style={{
            margin: "0 0 0.25rem",
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "var(--fg)",
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={doc.title}
        >
          {doc.title}
        </h3>

        {/* Frase clave o subtítulo: Máximo 2 líneas */}
        {preambulo ? (
          <p
            style={{
              margin: 0,
              fontSize: "0.7rem",
              color: "var(--muted)",
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {preambulo.enUnaFrase}
          </p>
        ) : subtitle ? (
          <p
            style={{
              margin: 0,
              fontSize: "0.7rem",
              color: "var(--muted)",
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {/* Botón de acción al fondo */}
      <div style={{ marginTop: "0.45rem", paddingTop: "0.4rem", borderTop: "1px solid var(--border)" }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.3rem",
            fontSize: "0.74rem",
            fontWeight: 700,
            padding: "0.35rem 0.5rem",
            borderRadius: 6,
            background: "var(--primary)",
            color: "#fff",
            width: "100%",
            border: "none",
            cursor: "pointer",
          }}
          title="Leer documento oficial en la app"
        >
          <BookOpen size={13} />
          <span>Leer</span>
        </button>
      </div>
    </div>
  )
}
