"use client"

import { type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, forwardRef, useId } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: ReactNode
  leadingIcon?: ReactNode
  trailingElement?: ReactNode
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, icon, leadingIcon, trailingElement, invalid, style, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const leftIcon = leadingIcon ?? icon

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <style>{`@media (pointer: coarse) { .input-mobile-font { font-size: 16px !important; } }`}</style>
      {label && (
        <label
          htmlFor={inputId}
          style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: "0.375rem" }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
        {leftIcon && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className="input-mobile-font"
          style={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            minHeight: "var(--control-md)",
            padding: leftIcon ? "0.5rem 0.75rem 0.5rem 2.25rem" : "0.5rem 0.75rem",
            border: `1px solid ${invalid ? "var(--error)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)",
            background: invalid ? "var(--state-error-bg)" : "var(--bg)",
            color: "var(--fg)",
            fontSize: "var(--text-md)",
            outline: "none",
            transition: "border-color var(--transition), box-shadow var(--transition)",
            ...(invalid
              ? { boxShadow: "0 0 0 1px rgba(220, 38, 38, 0.2)" }
              : {}),
            ...style,
          }}
          aria-invalid={invalid ? "true" : undefined}
          {...props}
        />
        {trailingElement && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {trailingElement}
          </span>
        )}
      </div>
    </div>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, invalid, style, id, ...props },
  ref,
) {
  const autoId = useId()
  const textareaId = id ?? autoId

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <style>{`@media (pointer: coarse) { .textarea-mobile-font { font-size: 16px !important; } }`}</style>
      {label && (
        <label
          htmlFor={textareaId}
          style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: "0.375rem" }}
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className="textarea-mobile-font"
        style={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          minHeight: "100px",
          padding: "0.5rem 0.75rem",
          border: `1px solid ${invalid ? "var(--error)" : "var(--border)"}`,
          borderRadius: "var(--radius-sm)",
          background: invalid ? "var(--state-error-bg)" : "var(--bg)",
          color: "var(--fg)",
          fontSize: "var(--text-md)",
          resize: "vertical",
          fontFamily: "inherit",
          outline: "none",
          transition: "border-color var(--transition), box-shadow var(--transition)",
          ...(invalid
            ? { boxShadow: "0 0 0 1px rgba(220, 38, 38, 0.2)" }
            : {}),
          ...style,
        }}
        aria-invalid={invalid ? "true" : undefined}
        {...props}
      />
    </div>
  )
})

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string
  invalid?: boolean
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, invalid, placeholder, children, style, id, ...props },
  ref,
) {
  const autoId = useId()
  const selectId = id ?? autoId

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <style>{`@media (pointer: coarse) { .select-mobile-font { font-size: 16px !important; } }`}</style>
      {label && (
        <label
          htmlFor={selectId}
          style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: "0.375rem" }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
        <select
          ref={ref}
          id={selectId}
          className="select-mobile-font"
          style={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            minHeight: "var(--control-md)",
            padding: "0.5rem 2.25rem 0.5rem 0.75rem",
            border: `1px solid ${invalid ? "var(--error)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)",
            background: invalid ? "var(--state-error-bg)" : "var(--bg)",
            color: "var(--fg)",
            fontSize: "var(--text-md)",
            outline: "none",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            transition: "border-color var(--transition), box-shadow var(--transition)",
            ...(invalid
              ? { boxShadow: "0 0 0 1px rgba(220, 38, 38, 0.2)" }
              : {}),
            ...style,
          }}
          aria-invalid={invalid ? "true" : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: "0.75rem",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <svg width="12" height="7" viewBox="0 0 12 7" fill="none">
            <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  )
})
