"use client"

import { useEffect, useRef, useState } from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string
          appearance?: "always" | "execute" | "interaction-only"
          callback?: (token: string) => void
          "expired-callback"?: () => void
          "error-callback"?: () => void
        },
      ) => string
      reset?: (widgetId?: string) => void
      remove?: (widgetId: string) => void
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => {
        scriptPromise = null
        reject(new Error("turnstile_load_failed"))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

/**
 * Widget Cloudflare Turnstile para registro y recuperación.
 *
 * - Sin `siteKey` (NEXT_PUBLIC_TURNSTILE_SITE_KEY ausente) no renderiza nada:
 *   el flujo sigue funcionando sin CAPTCHA hasta que se configure.
 * - `appearance: "interaction-only"` no altera el diseño salvo desafío real.
 * - El token se entrega por input oculto `captcha_token` al server action.
 * - Cuando `resetKey` cambia tras un intento fallido, renueva el token de un solo uso.
 */
export function TurnstileWidget({
  siteKey,
  resetKey,
}: {
  siteKey?: string
  resetKey?: unknown
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const widgetIdRef = useRef<string | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let cancelled = false
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          appearance: "interaction-only",
          callback: (token: string) => {
            if (inputRef.current) inputRef.current.value = token
          },
          "expired-callback": () => {
            if (inputRef.current) inputRef.current.value = ""
          },
          "error-callback": () => {
            if (!cancelled) setFailed(true)
          },
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      const widgetId = widgetIdRef.current
      widgetIdRef.current = undefined
      if (widgetId && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetId)
        } catch {
          // Ignorar: el widget ya no existe (navegación o desmontaje).
        }
      }
    }
  }, [siteKey])

  useEffect(() => {
    if (resetKey === undefined) return
    if (inputRef.current) {
      inputRef.current.value = ""
    }
    if (widgetIdRef.current && window.turnstile?.reset) {
      try {
        window.turnstile.reset(widgetIdRef.current)
      } catch {
        // Ignorar si el widget aún no está listo.
      }
    }
  }, [resetKey])

  if (!siteKey || failed) return null

  return (
    <>
      <div ref={containerRef} style={{ minWidth: 0, maxWidth: "100%" }} />
      <input ref={inputRef} type="hidden" name="captcha_token" defaultValue="" />
    </>
  )
}
