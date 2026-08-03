"use client"

import type { InputHTMLAttributes, ReactNode } from "react"

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  children: ReactNode
}

export function Checkbox({ children, style, ...props }: CheckboxProps) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", ...style }}>
      <input
        type="checkbox"
        style={{ marginTop: "0.2rem", accentColor: "var(--primary)" }}
        {...props}
      />
      <span>{children}</span>
    </label>
  )
}
