import { afterEach, describe, expect, it } from "vitest"
import { requestCameraGate } from "../components/camera"

interface FakeLaVeinteApp {
  requestCameraPermission?: () => Promise<{ granted: boolean; permanentlyDenied?: boolean }>
  __isInjected?: boolean
}

const NATIVE_UA = "Mozilla/5.0 (Linux; Android 14) LaVeinteDigitalAndroid/1.0.93"

function setEnv(app: FakeLaVeinteApp | undefined, nativeUa = true) {
  const w = globalThis as Record<string, unknown>
  const prevWindow = w.window
  const prevNav = w.navigator
  // Keep window defined, but with or without the native bridge.
  w.window = { LaVeinteApp: app, addEventListener: () => {}, removeEventListener: () => {} } as unknown as Window
  const newNavigator = { userAgent: nativeUa ? NATIVE_UA : "Mozilla/5.0 (X11; Linux x86_64) Chrome/120" } as Navigator
  Object.defineProperty(w, "navigator", { value: newNavigator, configurable: true })
  return () => {
    w.window = prevWindow
    Object.defineProperty(w, "navigator", { value: prevNav, configurable: true })
  }
}

describe("requestCameraGate", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window
    delete (globalThis as Record<string, unknown>).navigator
  })

  it("grants immediately in a plain browser (non-native UA, no bridge)", async () => {
    const restore = setEnv(undefined, false)
    try {
      expect(await requestCameraGate()).toEqual({ granted: true, permanentlyDenied: false, isNative: false, bridgeReady: true })
    } finally {
      restore()
    }
  })

  it("is NOT granted when the shell is native but the bridge is missing (race)", async () => {
    const restore = setEnv(undefined, true)
    try {
      expect(await requestCameraGate()).toEqual({ granted: false, permanentlyDenied: false, isNative: true, bridgeReady: false })
    } finally {
      restore()
    }
  })

  it("resolves the native grant result", async () => {
    const restore = setEnv({ __isInjected: true, requestCameraPermission: async () => ({ granted: true }) })
    try {
      expect(await requestCameraGate()).toEqual({ granted: true, permanentlyDenied: false, isNative: true, bridgeReady: true })
    } finally {
      restore()
    }
  })

  it("reports permanent denial from native", async () => {
    const restore = setEnv({ __isInjected: true, requestCameraPermission: async () => ({ granted: false, permanentlyDenied: true }) })
    try {
      expect(await requestCameraGate()).toEqual({ granted: false, permanentlyDenied: true, isNative: true, bridgeReady: true })
    } finally {
      restore()
    }
  })

  it("treats a throwing bridge as not granted (native but bridge failed)", async () => {
    const restore = setEnv({
      __isInjected: true,
      requestCameraPermission: async () => {
        throw new Error("bridge failed")
      },
    })
    try {
      expect(await requestCameraGate()).toEqual({ granted: false, permanentlyDenied: false, isNative: true, bridgeReady: true })
    } finally {
      restore()
    }
  })
})
