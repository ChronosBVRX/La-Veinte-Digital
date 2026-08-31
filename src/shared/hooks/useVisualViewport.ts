"use client"

import { useEffect, useState, useCallback, useRef } from "react"

export interface VisualViewportState {
  /** Altura del viewport visual actual (px). En desktop coincide con window.innerHeight. */
  height: number
  /** Altura estimada del teclado (px). 0 si no hay teclado visible. */
  keyboardHeight: number
  /** true cuando el teclado está visiblemente abierto. */
  isKeyboardOpen: boolean
  /** Ancho del viewport visual (px). */
  width: number
  /** Offset vertical del viewport visual (útil en iOS). */
  offsetTop: number
}

function isEditableElement(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName.toUpperCase()
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (el.isContentEditable) return true
  return false
}

/**
 * Comprueba geométricamente si un elemento está dentro del viewport visual actual
 * con un margen de seguridad superior e inferior.
 */
export function isElementInVisibleViewport(element: HTMLElement, margin = 12): boolean {
  if (typeof window === "undefined" || !element) return true
  const rect = element.getBoundingClientRect()
  const vv = window.visualViewport
  const visibleTop = (vv?.offsetTop ?? 0) + margin
  const visibleBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - margin
  return rect.top >= visibleTop && rect.bottom <= visibleBottom
}

/**
 * Desplaza suavemente el elemento hacia la zona visible ÚNICAMENTE si está total o
 * parcialmente fuera de los límites del viewport visual.
 */
export function ensureElementInVisibleViewport(element: HTMLElement, margin = 12): void {
  if (typeof window === "undefined" || !element) return
  if (typeof element.scrollIntoView !== "function") return
  if (!isElementInVisibleViewport(element, margin)) {
    try {
      element.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      })
    } catch {
      element.scrollIntoView()
    }
  }
}

/**
 * Hook global que observa window.visualViewport y gestiona el viewport móvil:
 * - Detecta el teclado virtual tanto en modo resize nativo (Android View reducido)
 *   como en modo overlay (visualViewport reducido con window.innerHeight constante).
 * - Expone CSS variables `--visual-viewport-height` y `--keyboard-height`.
 * - Agrega/remueve la clase `keyboard-open` en <html>.
 * - Provee asistencia global y no agresiva de visibilidad de foco para inputs/formularios.
 */
export function useVisualViewport(): VisualViewportState {
  const baselineHeightRef = useRef<number>(
    typeof window !== "undefined" ? window.innerHeight : 0
  )

  const [state, setState] = useState<VisualViewportState>(() => {
    if (typeof window === "undefined") {
      return { height: 0, keyboardHeight: 0, isKeyboardOpen: false, width: 0, offsetTop: 0 }
    }
    const h = window.visualViewport?.height ?? window.innerHeight
    return {
      height: h,
      keyboardHeight: 0,
      isKeyboardOpen: false,
      width: window.visualViewport?.width ?? window.innerWidth,
      offsetTop: window.visualViewport?.offsetTop ?? 0,
    }
  })

  const update = useCallback(() => {
    if (typeof window === "undefined") return
    const vv = window.visualViewport
    const layoutHeight = window.innerHeight
    const visualHeight = vv?.height ?? layoutHeight
    const visualWidth = vv?.width ?? window.innerWidth
    const offsetTop = vv?.offsetTop ?? 0

    const activeEl = document.activeElement
    const hasActiveInput = isEditableElement(activeEl)

    // Si no hay input enfocado, actualizamos la altura base de referencia (ej. rotación de pantalla)
    if (!hasActiveInput && Math.abs(layoutHeight - baselineHeightRef.current) > 50) {
      baselineHeightRef.current = layoutHeight
    }

    const baseline = baselineHeightRef.current || layoutHeight
    const overlayDiff = layoutHeight - visualHeight
    const resizeDiff = baseline - visualHeight

    // Teclado abierto si:
    // A) Modo overlay: layoutHeight - visualHeight > 100
    // B) Modo resize con input enfocado: baseline - visualHeight > 100
    const isKeyboardOpen =
      overlayDiff > 100 || (hasActiveInput && resizeDiff > 100)

    const keyboardHeight = isKeyboardOpen
      ? Math.max(overlayDiff, resizeDiff > 100 ? resizeDiff : 0)
      : 0

    setState({
      height: visualHeight,
      keyboardHeight,
      isKeyboardOpen,
      width: visualWidth,
      offsetTop,
    })

    // CSS variables globales
    const root = document.documentElement
    root.style.setProperty("--visual-viewport-height", `${visualHeight}px`)
    root.style.setProperty("--keyboard-height", `${keyboardHeight}px`)
    if (isKeyboardOpen) root.classList.add("keyboard-open")
    else root.classList.remove("keyboard-open")

    // Asistencia de foco secundaria tras ajuste de viewport
    if (hasActiveInput && activeEl instanceof HTMLElement) {
      requestAnimationFrame(() => {
        ensureElementInVisibleViewport(activeEl)
      })
    }
  }, [])

  useEffect(() => {
    const raf = requestAnimationFrame(update)
    const vv = window.visualViewport

    if (vv) {
      vv.addEventListener("resize", update)
      vv.addEventListener("scroll", update)
    }
    window.addEventListener("resize", update)
    window.addEventListener("orientationchange", () => {
      baselineHeightRef.current = window.innerHeight
      update()
    })

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null
      if (isEditableElement(target)) {
        // Ejecutar comprobación inmediata y tras asentamiento del teclado
        requestAnimationFrame(update)
        setTimeout(update, 280)
      }
    }

    const onFocusOut = () => {
      // Pequeño debounce para permitir cambio entre inputs contiguos
      setTimeout(() => {
        if (!isEditableElement(document.activeElement)) {
          update()
        }
      }, 100)
    }

    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)

    return () => {
      cancelAnimationFrame(raf)
      if (vv) {
        vv.removeEventListener("resize", update)
        vv.removeEventListener("scroll", update)
      }
      window.removeEventListener("resize", update)
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
      document.documentElement.classList.remove("keyboard-open")
    }
  }, [update])

  return state
}
