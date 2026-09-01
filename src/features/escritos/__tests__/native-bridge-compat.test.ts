// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest"

describe("Compatibilidad con Puente Nativo Antiguo (sin openBiometrics)", () => {
  const originalLaVeinteApp = window.LaVeinteApp

  beforeEach(() => {
    // Simular una APK antigua donde LaVeinteApp existe pero NO incluye openBiometrics
    window.LaVeinteApp = {
      isNativeApp: () => true,
      appVersion: () => "0.0.1",
      haptic: () => {},
    } as unknown as LaVeinteNativeApp
  })

  afterEach(() => {
    window.LaVeinteApp = originalLaVeinteApp
  })

  it("verifica con seguridad opcional que openBiometrics no es función sin lanzar error", () => {
    const hasOpenBiometrics = typeof window.LaVeinteApp?.openBiometrics === "function"
    expect(hasOpenBiometrics).toBe(false)

    // Llamar condicionalmente como en HomeQuickActions no debe lanzar excepción
    expect(() => {
      if (typeof window.LaVeinteApp?.openBiometrics === "function") {
        window.LaVeinteApp.openBiometrics()
      }
    }).not.toThrow()
  })

  it("ejecuta openBiometrics cuando la APK moderna sí lo implementa", () => {
    let invoked = false
    window.LaVeinteApp = {
      ...window.LaVeinteApp,
      openBiometrics: () => {
        invoked = true
      },
    } as unknown as LaVeinteNativeApp

    const hasOpenBiometrics = typeof window.LaVeinteApp?.openBiometrics === "function"
    expect(hasOpenBiometrics).toBe(true)

    if (typeof window.LaVeinteApp?.openBiometrics === "function") {
      window.LaVeinteApp.openBiometrics()
    }
    expect(invoked).toBe(true)
  })
})
