"use client"

import { Input } from "@/shared/components/ui/Input"
import { parseCurrencyInput } from "../lib/money"

interface CurrencyFieldProps {
  label: string
  description?: string
  value: string
  onChange: (value: string, numeric: number | null) => void
  error?: string
}

export function CurrencyField({ label, description, value, onChange, error }: CurrencyFieldProps) {
  return (
    <div>
      <Input
        label={label}
        value={value}
        onChange={(e) => {
          const raw = e.target.value
          const numeric = parseCurrencyInput(raw)
          onChange(raw, numeric)
        }}
        placeholder="$0.00"
        inputMode="decimal"
        autoComplete="off"
        style={{ borderColor: error ? "var(--error)" : undefined }}
      />
      {description && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
          {description}
        </p>
      )}
      {error && (
        <p style={{ fontSize: "0.75rem", color: "var(--error)", margin: "0.25rem 0 0" }}>
          {error}
        </p>
      )}
    </div>
  )
}
