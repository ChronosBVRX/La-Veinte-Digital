"use client"

import { useEffect, useId, useRef } from "react"
import { X } from "@phosphor-icons/react"
import type { CSSProperties, ReactNode } from "react"

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children?: ReactNode
  height?: "auto" | "medium" | "large"
}

const heightMap: Record<string, CSSProperties["maxHeight"]> = {
  auto: undefined,
  medium: "50dvh",
  large: "85dvh",
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  height = "auto",
}: BottomSheetProps) {
  const titleId = useId()
  const overlayRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement as HTMLElement

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key === "Tab" && sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll(FOCUSABLE)
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
      if (sheetRef.current) {
        const firstFocusable = sheetRef.current.querySelector(FOCUSABLE) as HTMLElement | null
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
    if (e.target === overlayRef.current) onClose()
  }

  return (
    <div
      ref={overlayRef}
      onClick={overlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className="animate-slide-up"
        style={{
          background: "var(--card)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          boxShadow: "var(--shadow-lg)",
          width: "100%",
          maxWidth: 600,
          maxHeight: heightMap[height] ?? "calc(var(--visual-viewport-height, 100dvh) - 2rem)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: "0.5rem",
            paddingBottom: "0.25rem",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "var(--border)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 1.25rem 0.75rem",
            flexShrink: 0,
          }}
        >
          <h2
            id={title ? titleId : undefined}
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              margin: 0,
            }}
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
              flexShrink: 0,
            }}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
        {children && (
          <div style={{ padding: "0 1.25rem 1.25rem", flex: 1, minHeight: 0, overflowY: "auto" } as React.CSSProperties}>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
