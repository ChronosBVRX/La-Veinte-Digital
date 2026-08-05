"use client"

import { useEffect, useId, useRef } from "react"
import { X } from "@phosphor-icons/react"
import type { CSSProperties, ReactNode } from "react"

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children?: ReactNode
  size?: "sm" | "md" | "lg" | "full"
  style?: CSSProperties
  footer?: ReactNode
  closeOnOverlay?: boolean
  description?: string
}

const sizeMap: Record<string, string> = {
  sm: "400px",
  md: "560px",
  lg: "720px",
  full: "96%",
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  style,
  footer,
  closeOnOverlay = true,
  description,
}: ModalProps) {
  const titleId = useId()
  const descId = useId()
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement as HTMLElement

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll(FOCUSABLE)
        const first = focusable[0] as HTMLElement | undefined
        const last = focusable[focusable.length - 1] as HTMLElement | undefined
        if (!first || !last) return
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener("keydown", onKeyDown)
    document.body.style.overflow = "hidden"

    requestAnimationFrame(() => {
      if (dialogRef.current) {
        const firstFocusable = dialogRef.current.querySelector(FOCUSABLE) as HTMLElement | null
        firstFocusable?.focus()
      }
    })

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open && previousFocusRef.current) {
      const el = previousFocusRef.current
      previousFocusRef.current = null
      requestAnimationFrame(() => el.focus())
    }
  }, [open])

  if (!open) return null

  const overlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && closeOnOverlay) onClose()
  }

  return (
    <>
      <div
        ref={overlayRef}
        onClick={overlayClick}
        className="ui-modal-overlay"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          className="ui-modal-dialog animate-scale-in"
          style={{
            background: "var(--card)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            width: "100%",
            maxWidth: sizeMap[size],
            maxHeight: "90dvh",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            ...style,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}
          >
            <h2
              id={titleId}
              style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}
            >
              {title ?? ""}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "var(--accent)",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--muted)",
                transition: "background var(--transition)",
              }}
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
          {description && (
            <p
              id={descId}
              style={{
                margin: 0,
                padding: "0.75rem 1.25rem 0",
                fontSize: "var(--text-sm)",
                color: "var(--muted)",
              }}
            >
              {description}
            </p>
          )}
          {children && (
            <div style={{ padding: "1.25rem", flex: 1, minHeight: 0 }}>
              {children}
            </div>
          )}
          {footer && (
            <div
              style={{
                padding: "1rem 1.25rem",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                flexShrink: 0,
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .ui-modal-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .ui-modal-dialog {
            border-radius: var(--radius-lg) var(--radius-lg) 0 0 !important;
            max-height: 85dvh !important;
            padding-bottom: env(safe-area-inset-bottom) !important;
            animation: slideUp 0.25s ease forwards !important;
          }
        }
      `}</style>
    </>
  )
}
