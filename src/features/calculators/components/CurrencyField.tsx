"use client"

import { Input } from "@/shared/components/ui/Input"
import { parseCurrencyInput } from "../lib/money"

interface CurrencyFieldProps {
  id?: string
  label: string
  technicalLabel?: string
  description?: string
  value: string
  onChange: (value: string, numeric: number | null) => void
  error?: string
  placeholder?: string
  disabled?: boolean
}

export function CurrencyField({
  id,
  label,
  technicalLabel,
  description,
  value,
  onChange,
  error,
  placeholder = "$0.00",
  disabled,
}: CurrencyFieldProps) {
  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Input
        id={id}
        label={label}
        value={value}
        onChange={(e) => {
          const raw = e.target.value
          const numeric = parseCurrencyInput(raw)
          onChange(raw, numeric)
        }}
        placeholder={placeholder}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        style={{ borderColor: error ? "var(--error)" : undefined, fontSize: "1rem" }}
      />
      {technicalLabel && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
          <span style={{ opacity: 0.85 }}>En tu tarjetón: </span>
          <strong style={{ color: "var(--fg)", opacity: 0.9 }}>{technicalLabel}</strong>
        </p>
      )}
      {description && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0", lineHeight: 1.4 }}>
          {description}
        </p>
      )}
      {error && (
        <p style={{ fontSize: "0.78125rem", color: "var(--error)", margin: "0.3rem 0 0", fontWeight: 500 }}>
          {error}
        </p>
      )}
    </div>
  )
}
