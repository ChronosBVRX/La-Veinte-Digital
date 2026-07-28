"use client"

import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, style, ...props }, ref) {
  return (
    <div>
      {label && (
        <label htmlFor={props.id} style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        style={{
          width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--fg)", fontSize: "0.875rem",
          outline: "none", transition: "border-color var(--transition), box-shadow var(--transition)",
          ...style,
        }}
        {...props}
      />
    </div>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, style, ...props }, ref) {
  return (
    <div>
      {label && (
        <label htmlFor={props.id} style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        style={{
          width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--fg)", fontSize: "0.875rem",
          resize: "vertical", fontFamily: "inherit", outline: "none",
          transition: "border-color var(--transition), box-shadow var(--transition)",
          ...style,
        }}
        {...props}
      />
    </div>
  )
})

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, children, style, ...props }, ref) {
  return (
    <div>
      {label && (
        <label htmlFor={props.id} style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        style={{
          width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--fg)", fontSize: "0.875rem",
          outline: "none", transition: "border-color var(--transition), box-shadow var(--transition)",
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
    </div>
  )
})
