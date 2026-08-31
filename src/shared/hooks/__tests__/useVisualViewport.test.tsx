// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import {
  useVisualViewport,
  isElementInVisibleViewport,
  ensureElementInVisibleViewport,
} from "../useVisualViewport"

describe("useVisualViewport & Global Focus Assist", () => {
  const originalVV = (window as unknown as { visualViewport: unknown }).visualViewport

  beforeEach(() => {
    document.documentElement.classList.remove("keyboard-open")
    document.documentElement.style.removeProperty("--visual-viewport-height")
    document.documentElement.style.removeProperty("--keyboard-height")
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, "visualViewport", { value: originalVV, writable: true, configurable: true })
  })

  it("expone altura inicial y no marca teclado abierto", async () => {
    const { result } = renderHook(() => useVisualViewport())
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(0)))
    })
    expect(result.current.height).toBeGreaterThan(0)
    expect(result.current.isKeyboardOpen).toBe(false)
    expect(result.current.keyboardHeight).toBe(0)
  })

  it("detecta teclado cuando visualViewport se reduce >100px (overlay mode)", async () => {
    const layoutHeight = 800
    Object.defineProperty(window, "innerHeight", { value: layoutHeight, writable: true, configurable: true })

    const mockVV = {
      height: 500,
      width: 400,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, "visualViewport", { value: mockVV, writable: true, configurable: true })

    const { result } = renderHook(() => useVisualViewport())
    await act(async () => {
      const handler = mockVV.addEventListener.mock.calls.find((c: unknown[]) => c[0] === "resize")?.[1] as (() => void) | undefined
      if (handler) handler()
      await new Promise((r) => requestAnimationFrame(() => r(0)))
    })

    expect(result.current.isKeyboardOpen).toBe(true)
    expect(result.current.keyboardHeight).toBe(300)
    expect(document.documentElement.classList.contains("keyboard-open")).toBe(true)
    expect(document.documentElement.style.getPropertyValue("--visual-viewport-height")).toBe("500px")
  })

  it("detecta teclado cuando AndroidView se redimensiona con input enfocado", async () => {
    // 1. Inicializa con 800px sin input enfocado
    Object.defineProperty(window, "innerHeight", { value: 800, writable: true, configurable: true })
    const mockVV = {
      height: 800,
      width: 400,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, "visualViewport", { value: mockVV, writable: true, configurable: true })

    const { result } = renderHook(() => useVisualViewport())
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(0)))
    })

    // 2. Enfoca un input y simula resize de la ventana a 500px
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.focus()

    Object.defineProperty(window, "innerHeight", { value: 500, writable: true, configurable: true })
    mockVV.height = 500

    await act(async () => {
      const handler = mockVV.addEventListener.mock.calls.find((c: unknown[]) => c[0] === "resize")?.[1] as (() => void) | undefined
      if (handler) handler()
      await new Promise((r) => requestAnimationFrame(() => r(0)))
    })

    expect(result.current.isKeyboardOpen).toBe(true)
    expect(result.current.keyboardHeight).toBe(300)
    expect(document.documentElement.classList.contains("keyboard-open")).toBe(true)

    document.body.removeChild(input)
  })

  it("no reporta teclado para diferencias pequeñas (<100px)", async () => {
    const layoutHeight = 800
    Object.defineProperty(window, "innerHeight", { value: layoutHeight, writable: true, configurable: true })
    const mockVV = {
      height: 750,
      width: 400,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    Object.defineProperty(window, "visualViewport", { value: mockVV, writable: true, configurable: true })

    const { result } = renderHook(() => useVisualViewport())
    await act(async () => {
      const handler = mockVV.addEventListener.mock.calls.find((c: unknown[]) => c[0] === "resize")?.[1] as (() => void) | undefined
      if (handler) handler()
      await new Promise((r) => requestAnimationFrame(() => r(0)))
    })
    expect(result.current.keyboardHeight).toBe(0)
    expect(result.current.isKeyboardOpen).toBe(false)
    expect(document.documentElement.classList.contains("keyboard-open")).toBe(false)
  })

  describe("isElementInVisibleViewport & ensureElementInVisibleViewport", () => {
    it("retorna true cuando el elemento está dentro del viewport visual", () => {
      const mockVV = { height: 500, offsetTop: 0 }
      Object.defineProperty(window, "visualViewport", { value: mockVV, writable: true, configurable: true })

      const el = document.createElement("input")
      el.getBoundingClientRect = () => ({
        top: 100,
        bottom: 140,
        left: 20,
        right: 300,
        width: 280,
        height: 40,
        x: 20,
        y: 100,
        toJSON: () => {},
      })

      expect(isElementInVisibleViewport(el, 12)).toBe(true)
    })

    it("retorna false cuando el elemento queda por debajo del viewport (cubierto por teclado)", () => {
      const mockVV = { height: 500, offsetTop: 0 }
      Object.defineProperty(window, "visualViewport", { value: mockVV, writable: true, configurable: true })

      const el = document.createElement("input")
      el.getBoundingClientRect = () => ({
        top: 490,
        bottom: 530, // excede visibleBottom (500 - 12 = 488)
        left: 20,
        right: 300,
        width: 280,
        height: 40,
        x: 20,
        y: 490,
        toJSON: () => {},
      })

      expect(isElementInVisibleViewport(el, 12)).toBe(false)
    })

    it("retorna false cuando el elemento queda por encima del viewport (debajo del header)", () => {
      const mockVV = { height: 500, offsetTop: 0 }
      Object.defineProperty(window, "visualViewport", { value: mockVV, writable: true, configurable: true })

      const el = document.createElement("input")
      el.getBoundingClientRect = () => ({
        top: 5, // menor que visibleTop (12)
        bottom: 45,
        left: 20,
        right: 300,
        width: 280,
        height: 40,
        x: 20,
        y: 5,
        toJSON: () => {},
      })

      expect(isElementInVisibleViewport(el, 12)).toBe(false)
    })

    it("ensureElementInVisibleViewport no ejecuta scroll si el elemento ya es visible", () => {
      const mockVV = { height: 500, offsetTop: 0 }
      Object.defineProperty(window, "visualViewport", { value: mockVV, writable: true, configurable: true })

      const el = document.createElement("input")
      el.getBoundingClientRect = () => ({
        top: 200,
        bottom: 240,
        left: 20,
        right: 300,
        width: 280,
        height: 40,
        x: 20,
        y: 200,
        toJSON: () => {},
      })
      const scrollMock = vi.fn()
      el.scrollIntoView = scrollMock

      ensureElementInVisibleViewport(el, 12)
      expect(scrollMock).not.toHaveBeenCalled()
    })

    it("ensureElementInVisibleViewport ejecuta scrollIntoView con block nearest cuando está fuera", () => {
      const mockVV = { height: 500, offsetTop: 0 }
      Object.defineProperty(window, "visualViewport", { value: mockVV, writable: true, configurable: true })

      const el = document.createElement("textarea")
      el.getBoundingClientRect = () => ({
        top: 510,
        bottom: 610,
        left: 20,
        right: 300,
        width: 280,
        height: 100,
        x: 20,
        y: 510,
        toJSON: () => {},
      })
      const scrollMock = vi.fn()
      el.scrollIntoView = scrollMock

      ensureElementInVisibleViewport(el, 12)
      expect(scrollMock).toHaveBeenCalledWith({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      })
    })

    it("aplica correctamente para controles de Tarjetón, Escritos, Modales, BottomSheet y Chat", () => {
      const mockVV = { height: 480, offsetTop: 0 }
      Object.defineProperty(window, "visualViewport", { value: mockVV, writable: true, configurable: true })

      // Control Tarjetón visible
      const tarjetonInput = document.createElement("input")
      tarjetonInput.getBoundingClientRect = () => ({
        top: 150, bottom: 190, left: 10, right: 200, width: 190, height: 40, x: 10, y: 150, toJSON: () => {},
      })
      expect(isElementInVisibleViewport(tarjetonInput, 12)).toBe(true)

      // Textarea Escritos tapada por teclado
      const escritosTextarea = document.createElement("textarea")
      escritosTextarea.getBoundingClientRect = () => ({
        top: 450, bottom: 580, left: 10, right: 350, width: 340, height: 130, x: 10, y: 450, toJSON: () => {},
      })
      expect(isElementInVisibleViewport(escritosTextarea, 12)).toBe(false)

      const scrollSpy = vi.fn()
      escritosTextarea.scrollIntoView = scrollSpy
      ensureElementInVisibleViewport(escritosTextarea, 12)
      expect(scrollSpy).toHaveBeenCalledWith({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      })

      // Composer de chat (ubicado justo sobre el teclado en viewport 480)
      const chatComposer = document.createElement("textarea")
      chatComposer.getBoundingClientRect = () => ({
        top: 420, bottom: 464, left: 10, right: 350, width: 340, height: 44, x: 10, y: 420, toJSON: () => {},
      })
      expect(isElementInVisibleViewport(chatComposer, 12)).toBe(true)
    })
  })
})
