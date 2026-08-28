"use client"

import { waitForLaVeinteNativeBridge } from "./native"
import type { CameraGate } from "./types"

/**
 * Camera permission gate used by the transfer QR scanners.
 *
 * Native shell:
 *   1. wait for the Android bridge (document-start or onPageFinished injection).
 *   2. ask the native bridge for CAMERA and wait for the system dialog result.
 *   3. the scanner starts ONLY after `granted === true`.
 *
 * Browser (non-native): resolves immediately with granted=true (getUserMedia owns permission).
 *
 * If the UA is native but the bridge never became ready, we treat it as NOT granted — a missing
 * bridge must never be mistaken for "the browser already has camera".
 */
export async function requestCameraGate(): Promise<CameraGate> {
  if (typeof window === "undefined") {
    return { granted: false, permanentlyDenied: false, isNative: false, bridgeReady: false }
  }
  const bridge = await waitForLaVeinteNativeBridge()
  if (!bridge.isNative) {
    // Desktop / plain browser — the browser handles getUserMedia itself.
    return { granted: true, permanentlyDenied: false, isNative: false, bridgeReady: true }
  }
  if (!bridge.ready || !window.LaVeinteApp?.requestCameraPermission) {
    return { granted: false, permanentlyDenied: false, isNative: true, bridgeReady: false }
  }
  try {
    const result = await window.LaVeinteApp.requestCameraPermission()
    return {
      granted: !!result?.granted,
      permanentlyDenied: !!result?.permanentlyDenied,
      isNative: true,
      bridgeReady: true,
    }
  } catch {
    return { granted: false, permanentlyDenied: false, isNative: true, bridgeReady: true }
  }
}
