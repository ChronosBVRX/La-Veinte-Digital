"use client"

import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import { X } from "@phosphor-icons/react"
import { useBackLayer } from "@/shared/navigation/useBackLayer"
import { Z_INDEX } from "@/shared/constants/z-index"
import type { CSSProperties, ReactNode } from "react"

export interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: string
  children?: ReactNode
  footer?: ReactNode
  height?: "auto" | "medium" | "large"
  closeOnOverlay?: boolean
  style?: CSSProperties
  maxWidth?: number | string
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
  description,
  children,
  footer,
  height = "auto",
  closeOnOverlay = true,
  style,
  maxWidth = 600,
}: BottomSheetProps) {
  const titleId = useId()
  const descId = useId()
  const overlayRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  // Mismo contrato que Modal: el cierre más reciente sin re-ejecutar la
  // inicialización cuando el contenido re-renderiza (ver Modal.tsx).
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Capa transitoria canónica: Atrás cierra este sheet antes que retroceder de ruta.
  useBackLayer(open, onClose, "sheet")

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement as HTMLElement

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current()
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
    // onClose intencionalmente excluido: se lee vía onCloseRef (ver Modal.tsx).
  }, [open])

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

  const content = (
    <div
      ref={overlayRef}
      onClick={overlayClick}
      className="ui-bottomsheet-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.dialog,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
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
        aria-describedby={description ? descId : undefined}
        className="animate-slide-up"
        style={{
          background: "var(--card)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          boxShadow: "var(--shadow-lg)",
          width: "100%",
          maxWidth,
          maxHeight:
            height === "auto"
              ? "calc(var(--visual-viewport-height, 100dvh) - 1rem)"
              : `min(${heightMap[height] ?? "85dvh"}, calc(var(--visual-viewport-height, 100dvh) - 1rem))`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          ...style,
        }}
      >
        {/* Handle visual superior de arrastre */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: "0.625rem",
            paddingBottom: "0.25rem",
            flexShrink: 0,
            cursor: "grab",
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 9999,
              background: "var(--border, #cbd5e1)",
            }}
          />
        </div>

        {/* Cabecera accesible con título y botón de cierre */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 1.25rem 0.75rem",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <h2
            id={title ? titleId : undefined}
            style={{
              fontSize: "1.0625rem",
              fontWeight: 700,
              margin: 0,
              overflowWrap: "anywhere",
              minWidth: 0,
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

        {description && (
          <p
            id={descId}
            style={{
              margin: 0,
              padding: "0.625rem 1.25rem 0",
              fontSize: "var(--text-sm)",
              color: "var(--muted)",
              flexShrink: 0,
            }}
          >
            {description}
          </p>
        )}

        {children && (
          <div
            style={{
              padding: "1rem 1.25rem",
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            } as React.CSSProperties}
          >
            {children}
          </div>
        )}

        {footer && (
          <div
            style={{
              padding: "0.75rem 1.25rem",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              flexShrink: 0,
              background: "var(--card)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  // Portal a body garantiza fixed = viewport real, evitando contenerización por transforms
  if (typeof document !== "undefined" && document.body) {
    return createPortal(content, document.body)
  }
  return content
}
