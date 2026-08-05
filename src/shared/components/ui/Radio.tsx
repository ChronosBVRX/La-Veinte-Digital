"use client"

import type { InputHTMLAttributes, ReactNode } from "react"
import { useId } from "react"

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode
  invalid?: boolean
}

export function Radio({ label, invalid, style, id, ...props }: RadioProps) {
  const autoId = useId()
  const radioId = id ?? autoId

  return (
    <label
      htmlFor={radioId}
      aria-invalid={invalid ? "true" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        cursor: "pointer",
        fontSize: "var(--text-sm)",
        ...style,
      }}
    >
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
        <input
          id={radioId}
          type="radio"
          style={{
            position: "absolute",
            opacity: 0,
            width: "100%",
            height: "100%",
            margin: 0,
            cursor: "pointer",
          }}
          {...props}
        />
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: `2px solid ${props.checked || props.defaultChecked ? "var(--primary)" : invalid ? "var(--error)" : "var(--border)"}`,
            background: "var(--card)",
            transition: "all var(--transition)",
            flexShrink: 0,
          }}
        >
          {(props.checked || props.defaultChecked) && (
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--primary)",
              }}
            />
          )}
        </span>
      </span>
      <span>{label}</span>
    </label>
  )
}
