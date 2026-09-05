// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  backNavigationCoordinator,
  createBackNavigationCoordinator,
  ensureLaVeinteNavigation,
} from "../back-navigation-coordinator"

describe("BackNavigationCoordinator", () => {
  beforeEach(() => {
    backNavigationCoordinator.clear()
    delete (window as unknown as { LaVeinteNavigation?: unknown }).LaVeinteNavigation
  })

  it("back() devuelve false sin capas (el anfitrión debe retroceder de ruta)", () => {
    expect(backNavigationCoordinator.hasLayers()).toBe(false)
    expect(backNavigationCoordinator.back()).toBe(false)
  })

  it("un retroceso cierra exclusivamente la capa superior (LIFO)", () => {
    const order: string[] = []
    backNavigationCoordinator.register("menu", () => order.push("menu"), "menu")
    backNavigationCoordinator.register("modal", () => order.push("modal"), "modal")
    backNavigationCoordinator.register("popover", () => order.push("popover"), "popover")

    expect(backNavigationCoordinator.back()).toBe(true)
    expect(order).toEqual(["popover"])
    expect(backNavigationCoordinator.back()).toBe(true)
    expect(order).toEqual(["popover", "modal"])
    expect(backNavigationCoordinator.back()).toBe(true)
    expect(order).toEqual(["popover", "modal", "menu"])
    // Sin capas: passthrough para historial web / sistema.
    expect(backNavigationCoordinator.back()).toBe(false)
  })

  it("nunca cierra dos capas en un solo evento", () => {
    const a = vi.fn()
    const b = vi.fn()
    backNavigationCoordinator.register("a", a)
    backNavigationCoordinator.register("b", b)
    backNavigationCoordinator.back()
    expect(b).toHaveBeenCalledTimes(1)
    expect(a).not.toHaveBeenCalled()
  })

  it("previene registros duplicados del mismo id (re-renders de React)", () => {
    const first = vi.fn()
    const second = vi.fn()
    backNavigationCoordinator.register("modal", first)
    backNavigationCoordinator.register("modal", second)
    expect(backNavigationCoordinator.count()).toBe(1)
    // El cierre más reciente gana, sin apilar de nuevo.
    backNavigationCoordinator.back()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    expect(backNavigationCoordinator.back()).toBe(false)
  })

  it("unregister al cerrar/desmontar deja la pila limpia", () => {
    const unregister = backNavigationCoordinator.register("sheet", vi.fn())
    expect(backNavigationCoordinator.hasLayers()).toBe(true)
    unregister()
    expect(backNavigationCoordinator.hasLayers()).toBe(false)
    expect(backNavigationCoordinator.back()).toBe(false)
  })

  it("unregister de una capa intermedia conserva el orden del resto", () => {
    const order: string[] = []
    const unregisterModal = backNavigationCoordinator.register("modal", () => order.push("modal"))
    backNavigationCoordinator.register("popover", () => order.push("popover"))
    unregisterModal()
    expect(backNavigationCoordinator.back()).toBe(true)
    expect(order).toEqual(["popover"])
    expect(backNavigationCoordinator.back()).toBe(false)
  })

  it("pulsaciones rápidas: cada evento cierra una capa sin repetir la misma", () => {
    const closed: string[] = []
    backNavigationCoordinator.register("modal", () => closed.push("modal"))
    backNavigationCoordinator.register("popover", () => closed.push("popover"))
    // Dos backs síncronos seguidos (doble tap): popover y luego modal,
    // nunca dos veces la misma capa.
    expect(backNavigationCoordinator.back()).toBe(true)
    expect(backNavigationCoordinator.back()).toBe(true)
    expect(closed).toEqual(["popover", "modal"])
    // Tercera pulsación sin capas: passthrough (el anfitrión decide).
    expect(backNavigationCoordinator.back()).toBe(false)
  })

  it("un onClose defectuoso no rompe el siguiente retroceso", () => {
    backNavigationCoordinator.register("roto", () => {
      throw new Error("boom")
    })
    const ok = vi.fn()
    backNavigationCoordinator.register("sano", ok)
    expect(backNavigationCoordinator.back()).toBe(true)
    expect(ok).toHaveBeenCalledTimes(1)
    expect(backNavigationCoordinator.back()).toBe(true) // el roto igual se desapila
    expect(backNavigationCoordinator.back()).toBe(false)
  })

  it("isTop identifica la capa superior para guardas de popstate", () => {
    backNavigationCoordinator.register("modal", vi.fn())
    backNavigationCoordinator.register("popover", vi.fn())
    expect(backNavigationCoordinator.isTop("popover")).toBe(true)
    expect(backNavigationCoordinator.isTop("modal")).toBe(false)
  })

  it("fábrica aislada para pruebas no comparte estado con el singleton", () => {
    const isolated = createBackNavigationCoordinator()
    isolated.register("x", vi.fn())
    expect(isolated.hasLayers()).toBe(true)
    expect(backNavigationCoordinator.hasLayers()).toBe(false)
  })

  it("expone API JS mínima y estable en window.LaVeinteNavigation", () => {
    const api = ensureLaVeinteNavigation()
    expect(api).not.toBeNull()
    expect(typeof window.LaVeinteNavigation?.back).toBe("function")
    // Instalación idempotente: no sobrescribe.
    const again = ensureLaVeinteNavigation()
    expect(again).toBe(api)

    const onClose = vi.fn()
    backNavigationCoordinator.register("modal", onClose)
    expect(window.LaVeinteNavigation!.back()).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(window.LaVeinteNavigation!.back()).toBe(false)
    expect(window.LaVeinteNavigation!.hasLayers()).toBe(false)
  })
})
