import { afterEach, describe, expect, it } from "vitest"
import { waitForLaVeinteNativeBridge, NATIVE_READY_EVENT } from "../components/native"

const NATIVE_UA = "Mozilla/5.0 (Linux; Android 14) LaVeinteDigitalAndroid/1.0.93"

interface FakeWin {
  LaVeinteApp?: { __isInjected?: boolean }
  addEventListener?: (evt: string, cb: () => void) => void
  removeEventListener?: (evt: string, cb: () => void) => void
}

function setup(windowObj: FakeWin, nativeUa = true) {
  const w = globalThis as Record<string, unknown>
  const prevWindow = w.window
  const prevNav = w.navigator
  const newNavigator = { userAgent: nativeUa ? NATIVE_UA : "Mozilla/5.0 (X11; Linux x86_64)" } as Navigator
  w.window = windowObj as unknown as Window
  Object.defineProperty(w, "navigator", { value: newNavigator, configurable: true })
  return () => {
    w.window = prevWindow
    Object.defineProperty(w, "navigator", { value: prevNav, configurable: true })
  }
}

describe("waitForLaVeinteNativeBridge", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window
  })

  it("resolves immediately when the bridge is already injected", async () => {
    const restore = setup({ LaVeinteApp: { __isInjected: true } })
    try {
      expect(await waitForLaVeinteNativeBridge(100)).toEqual({ isNative: true, ready: true, timedOut: false })
    } finally {
      restore()
    }
  })

  it("resolves immediately in a browser (not native shell)", async () => {
    const restore = setup({}, false)
    try {
      expect(await waitForLaVeinteNativeBridge(100)).toEqual({ isNative: false, ready: true, timedOut: false })
    } finally {
      restore()
    }
  })

  it("resolves native+ready when the native-ready event fires", async () => {
    let onReady: (() => void) | undefined
    let dispatchReady: (() => void) | undefined
    const restore = setup({
      addEventListener: (evt, cb) => {
        if (evt === NATIVE_READY_EVENT) onReady = cb as () => void
      },
      removeEventListener: () => {},
    })
    try {
      dispatchReady = () => {
        ;(globalThis as unknown as { window: FakeWin }).window.LaVeinteApp = { __isInjected: true }
        onReady?.()
      }
      const promise = waitForLaVeinteNativeBridge(200)
      await new Promise((r) => setTimeout(r, 20))
      dispatchReady()
      expect(await promise).toEqual({ isNative: true, ready: true, timedOut: false })
    } finally {
      restore()
    }
  })

  it("times out in native shell if the bridge never arrives", async () => {
    const restore = setup({ addEventListener: () => {}, removeEventListener: () => {} })
    try {
      expect(await waitForLaVeinteNativeBridge(50)).toEqual({ isNative: true, ready: false, timedOut: true })
    } finally {
      restore()
    }
  })
})
