"use client"

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react"
import { createPortal } from "react-dom"

export interface FullscreenPortalProps {
  open: boolean
  onClose?: () => void
  children: ReactNode
  ariaLabel?: string
  zIndex?: number
  className?: string
  style?: React.CSSProperties
}

const emptySubscribe = () => () => {}

function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

// Contador global de modales abiertos para bloquear el scroll del body
let activeModalsCount = 0
let originalOverflow = ""

export function FullscreenPortal({
  open,
  onClose,
  children,
  ariaLabel,
  zIndex = 99999,
  className,
  style,
}: FullscreenPortalProps) {
  const mounted = useIsMounted()
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open || !mounted) return

    // Guardar el elemento previamente enfocado para restaurar el foco al cerrar
    if (typeof document !== "undefined") {
      previousActiveElement.current = document.activeElement as HTMLElement | null
    }

    // Bloquear el scroll del fondo
    if (activeModalsCount === 0) {
      originalOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
    }
    activeModalsCount++

    // Manejar tecla Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        e.stopPropagation()
        onClose()
      }
    }

    // Manejar navegación atrás de Android/navegador sin salir de la app
    const handlePopState = () => {
      if (onClose) {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("popstate", handlePopState)

    // Enfocar el contenedor modal
    containerRef.current?.focus()

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("popstate", handlePopState)

      activeModalsCount--
      if (activeModalsCount <= 0) {
        activeModalsCount = 0
        document.body.style.overflow = originalOverflow
      }

      // Restaurar foco al botón o elemento que abrió el modal
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === "function") {
        try {
          previousActiveElement.current.focus()
        } catch {}
      }
    }
  }, [open, mounted, onClose])

  if (!open || !mounted || typeof document === "undefined") {
    return null
  }

  const content = (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      tabIndex={-1}
      className={className}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        maxWidth: "100vw",
        height: "100dvh",
        maxHeight: "100dvh",
        zIndex,
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
        overflow: "hidden",
        outline: "none",
        ...style,
      }}
    >
      {children}
    </div>
  )

  return createPortal(content, document.body)
}
