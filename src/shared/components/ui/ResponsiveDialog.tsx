"use client"

import { useCallback, useSyncExternalStore } from "react"
import { Modal } from "./Modal"
import { BottomSheet } from "./BottomSheet"
import type { CSSProperties, ReactNode } from "react"

export interface ResponsiveDialogProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: string
  children?: ReactNode
  footer?: ReactNode
  size?: "sm" | "md" | "lg" | "full"
  sheetHeight?: "auto" | "medium" | "large"
  closeOnOverlay?: boolean
  style?: CSSProperties
}

const emptySubscribe = () => () => {}

function useIsMobile(query = "(max-width: 768px)"): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return emptySubscribe()
      }
      const mql = window.matchMedia(query)
      mql.addEventListener("change", callback)
      return () => mql.removeEventListener("change", callback)
    },
    [query]
  )

  const getSnapshot = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false
    return window.matchMedia(query).matches
  }

  const getServerSnapshot = () => false

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Diálogo canónico responsivo para La Veinte Digital:
 * - En móvil (<= 768px): Renderiza como BottomSheet con handle de arrastre,
 *   nacimiento desde el borde inferior real del viewport y safe-area inferior.
 * - En desktop (> 768px): Renderiza como Modal centrado con tamaño configurable.
 *
 * Ambas variantes renderizan mediante portal a document.body para evitar contenerización
 * por transforms/animaciones/filtros en ancestros, se integran con useBackLayer (botón Atrás Android),
 * gestionan el bloqueo de scroll y atrapan/restauran el foco accesible.
 */
export function ResponsiveDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  sheetHeight,
  closeOnOverlay = true,
  style,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    const computedHeight = sheetHeight ?? (size === "lg" || size === "full" ? "large" : "auto")
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={title}
        description={description}
        footer={footer}
        height={computedHeight}
        closeOnOverlay={closeOnOverlay}
        style={style}
      >
        {children}
      </BottomSheet>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={footer}
      size={size}
      closeOnOverlay={closeOnOverlay}
      style={style}
    >
      {children}
    </Modal>
  )
}
