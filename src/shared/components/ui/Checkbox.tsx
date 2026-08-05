"use client"

import type { InputHTMLAttributes, ReactNode } from "react"
import { useId } from "react"

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode
  invalid?: boolean
  children?: ReactNode
}

export function Checkbox({ label, invalid, style, id, children, ...props }: CheckboxProps) {
  const autoId = useId()
  const checkboxId = id ?? autoId
  const labelContent = label ?? children

  return (
    <label
      htmlFor={checkboxId}
      style={{
        display: "inline-flex",
        alignItems: "flex-start",
        gap: "0.5rem",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center", paddingTop: 1 }}>
        <input
          id={checkboxId}
          type="checkbox"
          style={{
            position: "absolute",
            opacity: 0,
            width: "100%",
            height: "100%",
            margin: 0,
            cursor: props.disabled ? "not-allowed" : "pointer",
          }}
          className="ui-focus-ring"
          aria-invalid={invalid ? "true" : undefined}
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
            borderRadius: "0.25rem",
            border: `2px solid ${props.checked || props.defaultChecked ? "var(--primary)" : invalid ? "var(--error)" : "var(--border)"}`,
            background: props.checked || props.defaultChecked ? "var(--primary)" : "var(--card)",
            transition: "all var(--transition)",
            flexShrink: 0,
          }}
        >
          {(props.checked || props.defaultChecked) && (
            <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
              <path d="M1 4L4.5 7.5L11 1" stroke="var(--primary-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </span>
      {labelContent}
    </label>
  )
}
