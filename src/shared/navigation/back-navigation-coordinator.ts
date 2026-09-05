"use client"

/**
 * BackNavigationCoordinator — coordinador canónico y global de navegación Atrás.
 *
 * Mantiene una pila LIFO de capas transitorias abiertas (menús, sheets, modales,
 * overlays, popovers, selectores, visores, diálogos, drawers, etc.).
 *
 * - Cada componente transitorio se registra al abrirse y se desregistra al
 *   cerrarse/desmontarse (ver `useBackLayer`).
 * - Un retroceso (`back()`) cierra EXCLUSIVAMENTE la capa superior y devuelve `true`.
 * - Si no hay capas, devuelve `false` para que el anfitrión (Android WebView,
 *   navegador, etc.) aplique su siguiente nivel de navegación.
 *
 * Garantías:
 * - Sin duplicados: registrar dos veces el mismo `id` actualiza el `onClose`
 *   sin apilar de nuevo (protege re-renders de React).
 * - El `pop` es síncrono: dos pulsaciones en el mismo tick nunca cierran dos
 *   veces la misma capa. La serialización ante pulsaciones rápidas/dobles la
 *   aplica el anfitrión (InternalWebScreen ignora un segundo Back mientras el
 *   `evaluateJavascript` del primero sigue en vuelo).
 * - Un evento Atrás produce UNA sola acción: este método invoca un único
 *   `onClose` y nunca navega de ruta por su cuenta.
 */

export interface BackLayer {
  id: string
  label?: string
  onClose: () => void
}

function createCoordinator() {
  const stack: BackLayer[] = []

  function register(id: string, onClose: () => void, label?: string): () => void {
    const existing = stack.findIndex((l) => l.id === id)
    if (existing >= 0) {
      // Re-render con el mismo id: actualizar cierre sin duplicar ni reordenar.
      stack[existing].onClose = onClose
      if (label !== undefined) stack[existing].label = label
      return () => unregister(id)
    }
    stack.push({ id, onClose, label })
    // TEMPORAL (verificación BACK_NAV): retirar tras la prueba en dispositivo.
    if (typeof console !== "undefined") console.debug("BACK_NAV_WEB: layer registered", id, label ?? "")
    return () => unregister(id)
  }

  function unregister(id: string): void {
    const idx = stack.findIndex((l) => l.id === id)
    if (idx >= 0) stack.splice(idx, 1)
  }

  function clear(): void {
    stack.length = 0
  }

  function count(): number {
    return stack.length
  }

  function hasLayers(): boolean {
    return stack.length > 0
  }

  function peek(): BackLayer | null {
    return stack.length > 0 ? stack[stack.length - 1] : null
  }

  function isTop(id: string): boolean {
    const top = peek()
    return top !== null && top.id === id
  }

  /**
   * Consume un retroceso cerrando la capa superior.
   * @returns `true` si la web consumió el retroceso, `false` si no había capas.
   */
  function back(): boolean {
    const top = stack.pop()
    // TEMPORAL (verificación BACK_NAV): retirar tras la prueba en dispositivo.
    if (typeof console !== "undefined") {
      if (top) console.debug("BACK_NAV_WEB: layer consumed", top.id, top.label ?? "")
      else console.debug("BACK_NAV_WEB: no layers")
    }
    if (!top) return false
    try {
      top.onClose()
    } catch {
      // Un onClose defectuoso no debe romper el siguiente retroceso.
    }
    return true
  }

  function snapshot(): ReadonlyArray<Pick<BackLayer, "id" | "label">> {
    return stack.map((l) => ({ id: l.id, label: l.label }))
  }

  return { register, unregister, clear, count, hasLayers, peek, isTop, back, snapshot }
}

export type BackNavigationCoordinator = ReturnType<typeof createCoordinator>

/** Singleton global (una pila por ventana/documento). */
export const backNavigationCoordinator: BackNavigationCoordinator = createCoordinator()

/** Fábrica aislada para pruebas. */
export function createBackNavigationCoordinator(): BackNavigationCoordinator {
  return createCoordinator()
}

// --- API JS mínima y estable para el puente Android ---------------------------

export interface LaVeinteNavigationApi {
  /** Cierra la capa superior. `true` = consumido, `false` = sin capas. */
  back: () => boolean
  /** `true` si existe al menos una capa transitoria abierta. */
  hasLayers: () => boolean
}

/**
 * Expone `window.LaVeinteNavigation` de forma idempotente y segura en SSR.
 * Llamar repetidamente es inocuo (no sobrescribe una API ya instalada).
 */
export function ensureLaVeinteNavigation(): LaVeinteNavigationApi | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    LaVeinteNavigation?: LaVeinteNavigationApi
  }
  if (w.LaVeinteNavigation) return w.LaVeinteNavigation
  const api: LaVeinteNavigationApi = {
    back: () => backNavigationCoordinator.back(),
    hasLayers: () => backNavigationCoordinator.hasLayers(),
  }
  w.LaVeinteNavigation = api
  return api
}

// Instalación automática en cliente (sin romper SSR): el import del módulo
// deja lista la API para `evaluateJavascript("window.LaVeinteNavigation.back()")`.
if (typeof window !== "undefined") {
  ensureLaVeinteNavigation()
}
