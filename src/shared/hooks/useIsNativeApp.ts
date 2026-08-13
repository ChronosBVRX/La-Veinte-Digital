"use client"

import { useState } from "react"

export type NativePlatform = "android" | "ios"

function detectPlatform(): NativePlatform | null {
  if (typeof navigator === "undefined") return null
  const ua = navigator.userAgent
  if (ua.includes("LaVeinteDigitalAndroid")) return "android"
  if (ua.includes("LaVeinteDigitalIOS")) return "ios"
  return null
}

export function useNativePlatform() {
  const [platform] = useState<NativePlatform | null>(() => detectPlatform())
  return platform
}

export function useIsNativeApp() {
  const [isNative] = useState(() => detectPlatform() !== null)
  return isNative
}
