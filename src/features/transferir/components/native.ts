"use client"

/**
 * Native-shell detection + bridge readiness.
 *
 * The Android WebView injects `window.LaVeinteApp` asynchronously relative to React hydration.
 * `PrintSendPanel`/`SendPanel` must NOT interpret a temporarily-absent bridge as "browser" — that
 * would let `getUserMedia` run before the native camera permission round-trip is possible.
 *
 * We detect the native shell by User-Agent (`LaVeinteDigitalAndroid/`), which is set by the app,
 * and wait for the `laveinte:native-ready` event that Android dispatches after injecting the bridge.
 */

export const NATIVE_UA_MARKER = "LaVeinteDigitalAndroid/"
export const NATIVE_READY_EVENT = "laveinte:native-ready"

export interface NativeBridgeInfo {
  isNative: boolean
  ready: boolean
  timedOut: boolean
}

function isNativeShell(): boolean {
  if (typeof navigator === "undefined") return false
  return typeof navigator.userAgent === "string" && navigator.userAgent.includes(NATIVE_UA_MARKER)
}

/**
 * Waits until `window.LaVeinteApp?.__isInjected` is true.
 *  - Resolves immediately if the bridge is already present.
 *  - If the UA is native but the bridge is not yet present, listens for `laveinte:native-ready`.
 *  - Outside the native shell, resolves immediately (browser owns getUserMedia).
 *  - Applies a timeout so a broken WebView never hangs the scanner forever.
 */
export async function waitForLaVeinteNativeBridge(timeoutMs = 4000): Promise<NativeBridgeInfo> {
  if (typeof window === "undefined") {
    return { isNative: false, ready: false, timedOut: false }
  }
  if (window.LaVeinteApp?.__isInjected) {
    return { isNative: isNativeShell(), ready: true, timedOut: false }
  }
  if (!isNativeShell()) {
    // Plain browser / non-native shell: the bridge will never exist; treat as ready (browser mode).
    return { isNative: false, ready: true, timedOut: false }
  }

  return new Promise((resolve) => {
    let settled = false
    const done = (ready: boolean, timedOut: boolean) => {
      if (settled) return
      settled = true
      window.removeEventListener(NATIVE_READY_EVENT, onReady)
      clearTimeout(timer)
      resolve({ isNative: true, ready, timedOut })
    }
    const onReady = () => done(!!window.LaVeinteApp?.__isInjected, false)
    const timer = setTimeout(() => done(!!window.LaVeinteApp?.__isInjected, true), timeoutMs)
    window.addEventListener(NATIVE_READY_EVENT, onReady)
    // Re-check immediately in case the event fired between the first check and addEventListener.
    if (window.LaVeinteApp?.__isInjected) done(true, false)
  })
}
