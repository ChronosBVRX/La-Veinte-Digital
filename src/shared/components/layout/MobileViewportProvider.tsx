"use client"

import { useVisualViewport } from "@/shared/hooks/useVisualViewport"
import { useEffect, type ReactNode } from "react"

export function MobileViewportProvider({ children }: { children: ReactNode }) {
  useVisualViewport()

  useEffect(() => {
    // Bloquea el zoom general de la página para que la app no se comporte como web,
    // preservando el zoom específico dentro de canvas/visores de documentos.
    const isZoomableTarget = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false
      return Boolean(
        target.closest("[data-allow-zoom], canvas, .pdf-canvas, [data-testid='document-viewer-canvas']")
      )
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1 && !isZoomableTarget(e.target)) {
        e.preventDefault()
      }
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

    document.addEventListener("touchmove", handleTouchMove, { passive: false })
    document.addEventListener("wheel", handleWheel, { passive: false })
    document.addEventListener("gesturestart", handleGesture)
    document.addEventListener("gesturechange", handleGesture)

    return () => {
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("wheel", handleWheel)
      document.removeEventListener("gesturestart", handleGesture)
      document.removeEventListener("gesturechange", handleGesture)
    }
  }, [])

  return <>{children}</>
}

