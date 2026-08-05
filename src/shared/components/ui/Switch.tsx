"use client"

import type { InputHTMLAttributes, ReactNode } from "react"
import { useId } from "react"

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode
}

export function Switch({ label, style, id, ...props }: SwitchProps) {
  const autoId = useId()
  const switchId = id ?? autoId

  return (
    <label
      htmlFor={switchId}
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
          id={switchId}
          type="checkbox"
          role="switch"
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
            width: 40,
            height: 22,
            borderRadius: "var(--radius-pill)",
            background: props.checked || props.defaultChecked ? "var(--primary)" : "var(--border)",
            transition: "all var(--transition)",
            padding: "0 2px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--primary-fg)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              transition: "transform var(--transition)",
              transform: props.checked || props.defaultChecked ? "translateX(18px)" : "translateX(0)",
            }}
          />
        </span>
      </span>
      {label && <span>{label}</span>}
    </label>
  )
}
