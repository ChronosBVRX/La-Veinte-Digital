"use client"

import { useEffect, useState, useCallback } from "react"

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

/**
 * Hook global que observa window.visualViewport para detectar teclado virtual.
 * - En Android/WebView `visualViewport.height` se reduce cuando aparece el teclado.
 * - En iOS el comportamiento es similar pero con offsetTop.
 * - Fallback: si visualViewport no existe, usa window.innerHeight y resize.
 *
 * Expone CSS variables `--visual-viewport-height` y `--keyboard-height`
 * y la clase `keyboard-open` en <html> para que CSS pueda reaccionar.
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(() => {
    if (typeof window === "undefined") {
      return { height: 0, keyboardHeight: 0, isKeyboardOpen: false, width: 0, offsetTop: 0 }
    }
    const h = window.visualViewport?.height ?? window.innerHeight
    return { height: h, keyboardHeight: 0, isKeyboardOpen: false, width: window.visualViewport?.width ?? window.innerWidth, offsetTop: window.visualViewport?.offsetTop ?? 0 }
  })

  const update = useCallback(() => {
    if (typeof window === "undefined") return
    const vv = window.visualViewport
    const layoutHeight = window.innerHeight
    const visualHeight = vv?.height ?? layoutHeight
    const visualWidth = vv?.width ?? window.innerWidth
    const offsetTop = vv?.offsetTop ?? 0

    // El teclado está abierto si el viewport visual es significativamente menor que el layout viewport.
    // Umbral 120px evita falsos positivos por barras de navegación.
    const diff = layoutHeight - visualHeight
    const keyboardHeight = diff > 120 ? diff : 0
    const isKeyboardOpen = keyboardHeight > 0

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
  }, [])

  useEffect(() => {
    // Defer initial sync to avoid cascading render lint
    const raf = requestAnimationFrame(update)
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener("resize", update)
      vv.addEventListener("scroll", update)
    }
    window.addEventListener("resize", update)
    // Orientación
    window.addEventListener("orientationchange", update)
    // Algunos WebViews no disparan visualViewport resize, fallback con focus
    const onFocusIn = () => {
      // Pequeño delay para que el teclado termine de animar
      setTimeout(update, 300)
    }
    const onFocusOut = () => {
      setTimeout(update, 300)
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
      window.removeEventListener("orientationchange", update)
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
      // Limpieza de clase al desmontar
      document.documentElement.classList.remove("keyboard-open")
    }
  }, [update])

  return state
}
