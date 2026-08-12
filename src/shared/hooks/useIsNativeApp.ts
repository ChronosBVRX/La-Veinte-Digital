"use client"

import { useState } from "react"

export function useIsNativeApp() {
  const [isNative] = useState(() =>
    typeof navigator !== "undefined" && navigator.userAgent.includes("LaVeinteDigitalAndroid")
  )
  return isNative
}
