"use client"

import { useVisualViewport } from "@/shared/hooks/useVisualViewport"
import { useEffect, type ReactNode } from "react"

export function MobileViewportProvider({ children }: { children: ReactNode }) {
  useVisualViewport()

  useEffect(() => {
    // Asegurar que la etiqueta viewport mantenga user-scalable=no y maximum-scale=1 en el DOM
    const meta = document.querySelector('meta[name="viewport"]')
    if (meta) {
      const content = meta.getAttribute("content") || ""
      if (!content.includes("user-scalable=no")) {
        meta.setAttribute(
          "content",
          "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        )
      }
    }

    // Bloquea el zoom general de la página para que la app no se comporte como web,
    // preservando el zoom específico dentro de canvas/visores de documentos.
    const isZoomableTarget = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false
      return Boolean(
        target.closest("[data-allow-zoom], canvas, .pdf-canvas, [data-testid='document-viewer-canvas']")
      )
    }

    const handleTouchStart = (e: TouchEvent) => {
      // Si más de un dedo toca la pantalla fuera de un visor zoomable, aborta el gesto de pellizco
      if (e.touches.length > 1 && !isZoomableTarget(e.target)) {
        e.preventDefault()
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1 && !isZoomableTarget(e.target)) {
        e.preventDefault()
      }
    }

    // Evita el zoom por doble toque rápido en la interfaz
    let lastTouchEnd = 0
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) {
        const target = e.target as HTMLElement | null
        const isEditable = target && (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable
        )
        if (!isEditable && !isZoomableTarget(target)) {
          e.preventDefault()
        }
      }
      lastTouchEnd = now
    }

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey && !isZoomableTarget(e.target)) {
        e.preventDefault()
      }
    }

    const handleGesture = (e: Event) => {
      if (!isZoomableTarget(e.target)) {
        e.preventDefault()
      }
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: false })
    document.addEventListener("touchmove", handleTouchMove, { passive: false })
    document.addEventListener("touchend", handleTouchEnd, { passive: false })
    document.addEventListener("wheel", handleWheel, { passive: false })
    document.addEventListener("gesturestart", handleGesture)
    document.addEventListener("gesturechange", handleGesture)

    return () => {
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
      document.removeEventListener("wheel", handleWheel)
      document.removeEventListener("gesturestart", handleGesture)
      document.removeEventListener("gesturechange", handleGesture)
    }
  }, [])

  return <>{children}</>
}

