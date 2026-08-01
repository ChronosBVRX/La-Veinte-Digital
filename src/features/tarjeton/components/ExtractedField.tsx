"use client"

import type { ExtractedTarjetonField } from "@/shared/contracts/tarjeton-import"
import { Badge } from "@/shared/components/ui/Badge"
import { confidenceLevel } from "@/features/tarjeton/lib/confidence"
import { maskSensitiveLabel } from "@/features/tarjeton/lib/sanitize-sensitive-fields"

interface ExtractedFieldProps {
  label: string
  field?: ExtractedTarjetonField<string | number | null>
  /** Clave usada para detectar etiquetas sensibles (RFC, cuenta, NSS...). */
  sensitive?: boolean
}

function displayValue(value: string | number | null | undefined, sensitive: boolean | undefined, label: string): string {
  if (value === null || value === undefined || value === "") return "—"
  if (sensitive) return maskSensitiveLabel(label, String(value))
  return String(value)
}

export function ExtractedField({ label, field, sensitive }: ExtractedFieldProps) {
  const value = displayValue(field?.value, sensitive, label)

  const style: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "0.75rem",
    padding: "0.5rem 0",
    borderBottom: "1px solid var(--border)",
  }

  if (!field || value === "—") {
    return (
      <div style={style}>
        <span style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>{label}</span>
        <Badge variant="warning">No encontrado</Badge>
      </div>
    )
  }

  const level = confidenceLevel(field.confidence)
  const badgeVariant = level === "high" ? "success" : level === "medium" ? "warning" : "error"

  return (
    <div style={style}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
        <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{label}</span>
        <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--fg)", wordBreak: "break-word" }}>
          {value}
        </span>
        {field.rawValue && field.rawValue !== value && (
          <span style={{ color: "var(--muted)", fontSize: "0.6875rem" }}>Crudo: {field.rawValue}</span>
        )}
      </div>
      {field.requiresReview ? (
        <Badge variant="error">Revisar</Badge>
      ) : (
        <Badge variant={badgeVariant}>{level === "high" ? "Confirmado" : level === "medium" ? "Aceptable" : "Baja confianza"}</Badge>
      )}
    </div>
  )
}
