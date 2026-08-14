/**
 * Detección del entorno de ejecución: navegador web vs. app nativa.
 *
 * Prioridad (nunca a la inversa):
 *   1. Bridge nativo `window.LaVeinteApp` (isNativeApp()/appPlatform()) —
 *      expuesto por la APK (Android) y el app iOS via WKUserScript.
 *   2. Marcadores exclusivos en el User-Agent de las apps:
 *      `LaVeinteDigitalAndroid` / `LaVeinteDigitalIOS` (fallback al bridge,
 *      nunca sustituye una integración nativa existente).
 *   3. User-Agent del navegador (Chrome/Firefox Android, Safari iPhone…).
 *
 * Una PWA instalada comparte el UA del navegador: nunca se trata como nativa.
 * NO deducir "Android en UA === app Android": Chrome y el WebView de la APK
 * comparten esa parte del UA.
 */

export type NativePlatform = "android" | "ios" | null
export type AppEnvironmentKind = "web" | "native"

export interface AppEnvironment {
  environment: AppEnvironmentKind
  platform: NativePlatform
}

export interface AppEnvironmentInput {
  /** Bridge nativo expuesto por la app (`window.LaVeinteApp`). */
  laVeinteApp?: LaVeinteNativeApp | null
  /** User-Agent del entorno (en tests se pasa explícito). */
  userAgent?: string
}

/** Marcador exclusivo de la APK Android en el User-Agent (contrato en docs/ANDROID_APP.md). */
const ANDROID_UA_MARKER = "LaVeinteDigitalAndroid"
/** Marcador exclusivo del app iOS en el User-Agent (contrato en docs/IOS_APP.md). */
const IOS_UA_MARKER = "LaVeinteDigitalIOS"

function isNativeBridge(bridge: LaVeinteNativeApp): boolean {
  return typeof bridge.isNativeApp === "function" && bridge.isNativeApp() === true
}

function nativePlatformFromBridge(bridge: LaVeinteNativeApp): NativePlatform {
  if (isNativeBridge(bridge) && typeof bridge.appPlatform === "function") {
    const p = String(bridge.appPlatform() ?? "").trim().toLowerCase()
    if (p === "android" || p === "ios") return p
  }
  return null
}

function nativePlatformFromMarker(userAgent: string): NativePlatform {
  if (userAgent.includes(ANDROID_UA_MARKER)) return "android"
  if (userAgent.includes(IOS_UA_MARKER)) return "ios"
  return null
}

function browserPlatform(userAgent: string): NativePlatform {
  if (/Android/i.test(userAgent)) return "android"
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios"
  return null
}

/** Resuelve el entorno con la prioridad documentada: bridge → marcador → navegador. */
export function detectAppEnvironment(input: AppEnvironmentInput = {}): AppEnvironment {
  const ua = input.userAgent ?? ""

  if (input.laVeinteApp) {
    const bridgePlatform = nativePlatformFromBridge(input.laVeinteApp)
    if (bridgePlatform) return { environment: "native", platform: bridgePlatform }
    // El bridge confirma app nativa aunque no exponga appPlatform: sigue siendo nativa.
    if (isNativeBridge(input.laVeinteApp)) {
      return { environment: "native", platform: nativePlatformFromMarker(ua) }
    }
  }

  const markerPlatform = nativePlatformFromMarker(ua)
  if (markerPlatform) return { environment: "native", platform: markerPlatform }

  return { environment: "web", platform: ua ? browserPlatform(ua) : null }
}

/** Regla del botón de descarga Android: solo navegador Android, nunca dentro de la app. */
export function shouldShowAndroidDownload(env: AppEnvironment): boolean {
  return env.environment === "web" && env.platform === "android"
}
