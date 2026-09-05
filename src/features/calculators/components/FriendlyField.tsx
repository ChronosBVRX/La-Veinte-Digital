"use client"

import { Input } from "@/shared/components/ui/Input"
import { parseCurrencyInput } from "../lib/money"

interface FriendlyFieldProps {
  id?: string
  label: string
  technicalLabel?: string
  description?: string
  value: string
  onChange: (value: string, numeric: number | null) => void
  error?: string
  placeholder?: string
  type?: "currency" | "number" | "text"
  inputMode?: "decimal" | "numeric" | "text"
  disabled?: boolean
}

export function FriendlyField({
  id,
  label,
  technicalLabel,
  description,
  value,
  onChange,
  error,
  placeholder,
  type = "currency",
  inputMode,
  disabled,
}: FriendlyFieldProps) {
  const defaultPlaceholder = type === "currency" ? "$0.00" : type === "number" ? "0" : ""
  const defaultInputMode = type === "currency" ? "decimal" : type === "number" ? "numeric" : "text"

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Input
        id={id}
        label={label}
        value={value}
        onChange={(e) => {
          const raw = e.target.value
          if (type === "currency") {
            const numeric = parseCurrencyInput(raw)
            onChange(raw, numeric)
          } else if (type === "number") {
            const parsed = parseFloat(raw)
            onChange(raw, isNaN(parsed) ? null : parsed)
          } else {
            onChange(raw, null)
          }
        }}
        placeholder={placeholder ?? defaultPlaceholder}
        inputMode={inputMode ?? defaultInputMode}
        autoComplete="off"
        disabled={disabled}
        style={{
          borderColor: error ? "var(--error)" : undefined,
          fontSize: "1rem",
        }}
      />

      {technicalLabel && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--muted)",
            margin: "0.25rem 0 0",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <span style={{ opacity: 0.85 }}>En tu tarjetón:</span>
          <strong style={{ color: "var(--fg)", opacity: 0.9 }}>{technicalLabel}</strong>
        </p>
      )}

      {description && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0", lineHeight: 1.4 }}>
          {description}
        </p>
      )}

      {error && (
        <p
          style={{
            fontSize: "0.78125rem",
            color: "var(--error)",
            margin: "0.3rem 0 0",
            fontWeight: 500,
            lineHeight: 1.3,
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
