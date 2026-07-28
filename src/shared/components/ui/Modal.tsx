"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import type { ReactNode, CSSProperties } from "react"

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: "sm" | "md" | "lg" | "full"
  style?: CSSProperties
}

const sizeMap: Record<string, string> = {
  sm: "400px",
  md: "560px",
  lg: "720px",
  full: "96%",
}

export function Modal({ open, onClose, title, children, size = "md", style }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handler)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        className="animate-scale-in"
        style={{
          background: "var(--card)", borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)", width: "100%",
          maxWidth: sizeMap[size],
          maxHeight: "90dvh", overflow: "auto",
          ...style,
        }}
      >
        {(title || true) && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)",
          }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>{title ?? ""}</h2>
            <button
              onClick={onClose}
              style={{
                background: "var(--accent)", border: "none", borderRadius: "50%",
                width: 32, height: 32, display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer", color: "var(--muted)",
                transition: "background var(--transition)",
              }}
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div style={{ padding: "1.25rem" }}>{children}</div>
      </div>
    </div>
  )
}
