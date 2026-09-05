"use client"

import { CheckCircle2, ChevronDown, ChevronUp, Sparkles, SlidersHorizontal } from "lucide-react"

interface DataItem {
  label: string
  value: string
  technicalCode?: string
}

interface TarjetonDataNoticeProps {
  items: DataItem[]
  isEditing: boolean
  onToggleEditing: () => void
  hasSuggestions?: boolean
  onRestore?: () => void
  sourceText?: string
}

export function TarjetonDataNotice({
  items,
  isEditing,
  onToggleEditing,
  hasSuggestions,
  onRestore,
  sourceText = "Encontramos estos datos en tu último tarjetón o perfil.",
}: TarjetonDataNoticeProps) {
  const visibleItems = items.filter((item) => item.value && item.value.trim() !== "")

  if (visibleItems.length === 0) return null

  return (
    <div
      style={{
        background: "rgba(37, 99, 235, 0.04)",
        border: "1px solid rgba(37, 99, 235, 0.18)",
        borderRadius: "var(--radius-lg)",
        padding: "1rem 1.125rem",
        marginBottom: "1rem",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
          <CheckCircle2
            size={20}
            style={{ color: "var(--primary)", flexShrink: 0, marginTop: "0.125rem" }}
          />
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--fg)",
                lineHeight: 1.3,
              }}
            >
              Datos listos para calcular
            </p>
            <p
              style={{
                margin: "0.125rem 0 0",
                fontSize: "0.78125rem",
                color: "var(--muted)",
                lineHeight: 1.4,
              }}
            >
              {sourceText}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={onToggleEditing}
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "0.375rem 0.75rem",
              fontSize: "0.78125rem",
              fontWeight: 600,
              color: "var(--primary)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              minHeight: "36px",
            }}
          >
            <SlidersHorizontal size={14} />
            {isEditing ? "Ocultar edición" : "Revisar o cambiar datos"}
            {isEditing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {hasSuggestions && onRestore && (
            <button
              type="button"
              onClick={onRestore}
              title="Restaurar valores del tarjetón"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                padding: "0.375rem 0.5rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.75rem",
                minHeight: "36px",
              }}
            >
              <Sparkles size={14} /> Restaurar
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
          marginTop: "0.875rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid rgba(37, 99, 235, 0.12)",
        }}
      >
        {visibleItems.map((item, idx) => (
          <div key={idx}>
            <span
              style={{
                display: "block",
                fontSize: "0.75rem",
                color: "var(--muted)",
                lineHeight: 1.2,
              }}
            >
              {item.label}
              {item.technicalCode && (
                <span style={{ opacity: 0.8, marginLeft: "0.25rem" }}>({item.technicalCode})</span>
              )}
            </span>
            <span
              style={{
                display: "block",
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--fg)",
                marginTop: "0.125rem",
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
