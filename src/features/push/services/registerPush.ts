"use client"

/**
 * Reads the FCM token from the native bridge (if inside the app) and registers it against the
 * backend for the authenticated user. No-op outside the native app.
 */
export async function registerPushDevice(): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (!window.LaVeinteApp?.getFcmToken) return false
  try {
    const { token } = await window.LaVeinteApp.getFcmToken()
    if (!token || token.length < 20) return false
    const res = await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: "android" }),
    })
    return res.ok
  } catch {
    return false
  }
}
