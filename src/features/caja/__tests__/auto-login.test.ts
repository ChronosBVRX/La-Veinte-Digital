import { describe, it, expect, beforeEach } from "vitest"
import {
  isCajaManualLogout,
  setCajaManualLogout,
  CAJA_MANUAL_LOGOUT_KEY,
} from "../hooks/useCaja"

describe("Caja auto-login and session persistence behavior", () => {
  const sessionStore = new Map<string, string>()

  beforeEach(() => {
    sessionStore.clear()

    const mockSessionStorage = {
      getItem: (k: string) => sessionStore.get(k) ?? null,
      setItem: (k: string, v: string) => sessionStore.set(k, v),
      removeItem: (k: string) => sessionStore.delete(k),
      clear: () => sessionStore.clear(),
      length: 0,
      key: () => null,
    }

    Object.defineProperty(globalThis, "window", {
      value: { sessionStorage: mockSessionStorage },
      writable: true,
      configurable: true,
    })
    Object.defineProperty(globalThis, "sessionStorage", {
      value: mockSessionStorage,
      writable: true,
      configurable: true,
    })
  })

  it("isCajaManualLogout retorna false por defecto cuando no hay bandera", () => {
    expect(isCajaManualLogout()).toBe(false)
  })

  it("setCajaManualLogout(true) activa la bandera de cierre de sesión manual", () => {
    setCajaManualLogout(true)
    expect(sessionStore.get(CAJA_MANUAL_LOGOUT_KEY)).toBe("true")
    expect(isCajaManualLogout()).toBe(true)
  })

  it("setCajaManualLogout(false) limpia la bandera para permitir auto-login nuevamente", () => {
    setCajaManualLogout(true)
    expect(isCajaManualLogout()).toBe(true)

    setCajaManualLogout(false)
    expect(sessionStore.get(CAJA_MANUAL_LOGOUT_KEY)).toBeUndefined()
    expect(isCajaManualLogout()).toBe(false)
  })

  it("maneja de forma segura entornos donde window o sessionStorage no están disponibles", () => {
    const originalWindow = globalThis.window
    // @ts-expect-error simular entorno sin window
    delete globalThis.window

    expect(isCajaManualLogout()).toBe(false)
    expect(() => setCajaManualLogout(true)).not.toThrow()

    // Restaurar
    globalThis.window = originalWindow
  })
})
