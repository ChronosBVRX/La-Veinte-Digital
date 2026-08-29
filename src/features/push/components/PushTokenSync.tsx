"use client"

import { useEffect } from "react"
import { registerPushDevice } from "../services/registerPush"

/**
 * Best-effort registration of this device's FCM token once a session exists.
 * The native token may not be ready on first frame / may rotate later, so we retry a few times.
 * No-op outside the native app.
 */
export function PushTokenSync() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.LaVeinteApp?.getFcmToken) return

    let cancelled = false
    const delays = [0, 2000, 5000, 10000, 20000, 40000]
    delays.forEach((ms) => {
      setTimeout(async () => {
        if (cancelled) return
        await registerPushDevice()
      }, ms)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
