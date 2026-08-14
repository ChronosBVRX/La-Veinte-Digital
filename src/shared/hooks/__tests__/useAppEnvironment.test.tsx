// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useAppEnvironment, NATIVE_READY_EVENT, NATIVE_READY_GRACE_MS } from "../useAppEnvironment"

const ANDROID_BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
const APK_UA = `${ANDROID_BROWSER_UA} LaVeinteDigitalAndroid/2.0`

function bridge(platform: "android" | "ios"): LaVeinteNativeApp {
  return { isNativeApp: () => true, appPlatform: () => platform } as unknown as LaVeinteNativeApp
}

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: ua })
}

describe("useAppEnvironment", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/29.0.0",
    )
    window.LaVeinteApp = undefined
  })

  afterEach(() => {
    window.LaVeinteApp = undefined
    vi.useRealTimers()
  })

  it("mientras no está resuelto, nunca reporta native (evita parpadeo)", () => {
    const { result } = renderHook(() => useAppEnvironment())
    expect(result.current.resolved).toBe(false)
    expect(result.current.environment).toBe("web")
    expect(result.current.platform).toBeNull()
  })

  it("navegador Android sin bridge → web/android después del grace period", () => {
    setUserAgent(ANDROID_BROWSER_UA)
    const { result } = renderHook(() => useAppEnvironment())
    expect(result.current.resolved).toBe(false)
    act(() => vi.advanceTimersByTime(NATIVE_READY_GRACE_MS))
    expect(result.current).toEqual({ environment: "web", platform: "android", resolved: true })
  })

  it("bridge ya presente al montar → native/android resuelto de inmediato", () => {
    window.LaVeinteApp = bridge("android")
    const { result } = renderHook(() => useAppEnvironment())
    expect(result.current).toEqual({ environment: "native", platform: "android", resolved: true })
  })

  it("bridge inyectado después vía laveinte:native-ready → native/ios sin esperar el grace", () => {
    const { result } = renderHook(() => useAppEnvironment())
    expect(result.current.resolved).toBe(false)
    act(() => {
      window.LaVeinteApp = bridge("ios")
      window.dispatchEvent(new Event(NATIVE_READY_EVENT))
    })
    expect(result.current).toEqual({ environment: "native", platform: "ios", resolved: true })
  })

  it("app Android sin bridge pero con marcador UA → native/android tras el grace", () => {
    setUserAgent(APK_UA)
    const { result } = renderHook(() => useAppEnvironment())
    act(() => vi.advanceTimersByTime(NATIVE_READY_GRACE_MS))
    expect(result.current).toEqual({ environment: "native", platform: "android", resolved: true })
  })
})
