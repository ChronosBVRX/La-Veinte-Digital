"use client"

import type { ReactNode } from "react"
import { useId } from "react"

interface FormFieldProps {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}

export function FormField({ label, htmlFor, hint, error, required, children }: FormFieldProps) {
  const hintId = useId()
  const errorId = useId()

  return (
    <div>
      <label
        htmlFor={htmlFor}
        style={{
          display: "block",
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          marginBottom: "0.375rem",
          color: "var(--fg)",
        }}
      >
        {label}
        {required && (
          <span
            aria-hidden="true"
            title="Obligatorio"
            style={{ color: "var(--error)", marginLeft: "0.125rem" }}
          >
            {" *"}
          </span>
        )}
        {required && <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Obligatorio</span>}
      </label>
      {children}
      {error ? (
        <p
          id={errorId}
          role="alert"
          style={{
            margin: "0.25rem 0 0 0",
            fontSize: "var(--text-xs)",
            color: "var(--state-error-fg)",
          }}
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={hintId}
          style={{
            margin: "0.25rem 0 0 0",
            fontSize: "var(--text-xs)",
            color: "var(--muted)",
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
}
