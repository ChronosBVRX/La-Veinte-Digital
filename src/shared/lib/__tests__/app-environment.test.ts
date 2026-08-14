import { describe, it, expect } from "vitest"
import { detectAppEnvironment, shouldShowAndroidDownload } from "../app-environment"

const ANDROID_BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
const APK_UA = `${ANDROID_BROWSER_UA} LaVeinteDigitalAndroid/2.0`
const IOS_APP_UA = `${IPHONE_SAFARI_UA} LaVeinteDigitalIOS/1.0`

function bridge(platform: "android" | "ios"): LaVeinteNativeApp {
  return { isNativeApp: () => true, appPlatform: () => platform } as unknown as LaVeinteNativeApp
}

describe("detectAppEnvironment — navegador Android", () => {
  it("Chrome Android sin bridge → web/android → botón visible", () => {
    const env = detectAppEnvironment({ userAgent: ANDROID_BROWSER_UA })
    expect(env).toEqual({ environment: "web", platform: "android" })
    expect(shouldShowAndroidDownload(env)).toBe(true)
  })

  it("Firefox Android (sin marcadores) → web/android → botón visible", () => {
    const firefoxUa =
      "Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0"
    const env = detectAppEnvironment({ userAgent: firefoxUa })
    expect(env).toEqual({ environment: "web", platform: "android" })
    expect(shouldShowAndroidDownload(env)).toBe(true)
  })

  it("PWA instalada (mismo UA Android, sin bridge) → web/android, NO nativa", () => {
    const env = detectAppEnvironment({ userAgent: ANDROID_BROWSER_UA })
    expect(env.environment).toBe("web")
    expect(shouldShowAndroidDownload(env)).toBe(true)
  })
})

describe("detectAppEnvironment — app Android", () => {
  it("bridge presente (isNativeApp=true, appPlatform=android) → native/android → sin botón", () => {
    const env = detectAppEnvironment({ laVeinteApp: bridge("android"), userAgent: APK_UA })
    expect(env).toEqual({ environment: "native", platform: "android" })
    expect(shouldShowAndroidDownload(env)).toBe(false)
  })

  it("sin bridge pero con marcador exclusivo LaVeinteDigitalAndroid → native/android", () => {
    const env = detectAppEnvironment({ userAgent: APK_UA })
    expect(env).toEqual({ environment: "native", platform: "android" })
    expect(shouldShowAndroidDownload(env)).toBe(false)
  })

  it("nunca deduce app Android solo por la parte Android del UA", () => {
    const env = detectAppEnvironment({ userAgent: ANDROID_BROWSER_UA })
    expect(env.environment).toBe("web")
  })
})

describe("detectAppEnvironment — app iOS", () => {
  it("bridge presente (isNativeApp=true, appPlatform=ios) → native/ios → sin botón", () => {
    const env = detectAppEnvironment({ laVeinteApp: bridge("ios"), userAgent: IPHONE_SAFARI_UA })
    expect(env).toEqual({ environment: "native", platform: "ios" })
    expect(shouldShowAndroidDownload(env)).toBe(false)
  })

  it("sin bridge pero con marcador exclusivo LaVeinteDigitalIOS → native/ios", () => {
    const env = detectAppEnvironment({ userAgent: IOS_APP_UA })
    expect(env).toEqual({ environment: "native", platform: "ios" })
    expect(shouldShowAndroidDownload(env)).toBe(false)
  })
})

describe("detectAppEnvironment — navegador iOS y desktop", () => {
  it("Safari iPhone (sin bridge) → web/ios, no se trata como app nativa", () => {
    const env = detectAppEnvironment({ userAgent: IPHONE_SAFARI_UA })
    expect(env).toEqual({ environment: "web", platform: "ios" })
    expect(shouldShowAndroidDownload(env)).toBe(false)
  })

  it("desktop (sin Android) → web/null, comportamiento actual sin botón", () => {
    const env = detectAppEnvironment({ userAgent: DESKTOP_UA })
    expect(env).toEqual({ environment: "web", platform: null })
    expect(shouldShowAndroidDownload(env)).toBe(false)
  })
})

describe("detectAppEnvironment — robustez del bridge", () => {
  it("bridge que dice isNativeApp=false → web (se evalúa el UA)", () => {
    const fake = { isNativeApp: () => false, appPlatform: () => "android" } as unknown as LaVeinteNativeApp
    const env = detectAppEnvironment({ laVeinteApp: fake, userAgent: ANDROID_BROWSER_UA })
    expect(env).toEqual({ environment: "web", platform: "android" })
  })

  it("bridge isNativeApp=true sin appPlatform → native (platform del marcador UA si existe)", () => {
    const fake = { isNativeApp: () => true } as unknown as LaVeinteNativeApp
    const noMarker = detectAppEnvironment({ laVeinteApp: fake, userAgent: DESKTOP_UA })
    expect(noMarker).toEqual({ environment: "native", platform: null })
    expect(shouldShowAndroidDownload(noMarker)).toBe(false)
    const withMarker = detectAppEnvironment({ laVeinteApp: fake, userAgent: APK_UA })
    expect(withMarker).toEqual({ environment: "native", platform: "android" })
    expect(shouldShowAndroidDownload(withMarker)).toBe(false)
  })

  it("appPlatform devuelve mayúsculas/espacios → se normaliza", () => {
    const fake = { isNativeApp: () => true, appPlatform: () => " Android " } as unknown as LaVeinteNativeApp
    expect(detectAppEnvironment({ laVeinteApp: fake }).platform).toBe("android")
  })

  it("sin entrada (SSR) → web/null", () => {
    expect(detectAppEnvironment()).toEqual({ environment: "web", platform: null })
  })
})
