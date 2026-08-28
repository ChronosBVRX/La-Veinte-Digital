"use client"

/**
 * Camera permission gate used by the transfer QR scanners.
 *
 * In the native app the bridge exposes `requestCameraPermission()` which resolves with
 * `{ granted, permanentlyDenied }` ONLY after the system dialog is answered — so the scanner does
 * not race `getUserMedia` against the OS prompt. Outside the native app this resolves immediately
 * (the browser owns the permission via getUserMedia).
 */
export interface CameraGate {
  granted: boolean
  permanentlyDenied: boolean
  isNative: boolean
}

export async function requestCameraGate(): Promise<CameraGate> {
  if (typeof window !== "undefined" && window.LaVeinteApp?.requestCameraPermission) {
    try {
      const result = await window.LaVeinteApp.requestCameraPermission()
      return {
        granted: !!result?.granted,
        permanentlyDenied: !!result?.permanentlyDenied,
        isNative: true,
      }
    } catch {
      return { granted: false, permanentlyDenied: false, isNative: true }
    }
  }
  return { granted: true, permanentlyDenied: false, isNative: false }
}
