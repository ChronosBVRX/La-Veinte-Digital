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
  const [token, setToken] = useState("")
  const [status, setStatus] = useState<"verifying" | "verified" | "error">("verifying")
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let cancelled = false
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        if (widgetIdRef.current && window.turnstile.remove) {
          try {
            window.turnstile.remove(widgetIdRef.current)
          } catch {
            // Ignorar limpieza previa
          }
          widgetIdRef.current = undefined
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          appearance: "always",
          callback: (newToken: string) => {
            if (inputRef.current) inputRef.current.value = newToken
            if (!cancelled) {
              setToken(newToken)
              setStatus("verified")
            }
          },
          "expired-callback": () => {
            if (inputRef.current) inputRef.current.value = ""
            if (!cancelled) {
              setToken("")
              setStatus("verifying")
            }
            if (widgetIdRef.current && window.turnstile?.reset) {
              try {
                window.turnstile.reset(widgetIdRef.current)
              } catch {
                // Ignorar si no está listo
              }
            }
          },
          "error-callback": () => {
            if (inputRef.current) inputRef.current.value = ""
            if (!cancelled) {
              setToken("")
              setStatus("error")
            }
          },
        })
      })
      .catch(() => {
        if (!cancelled) {
          setToken("")
          setStatus("error")
        }
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
  }, [siteKey, retryCount])

  useEffect(() => {
    if (resetKey === undefined) return
    if (inputRef.current) {
      inputRef.current.value = ""
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado visual y limpia token tras un intento fallido
    setToken("")
    setStatus("verifying")
    if (widgetIdRef.current && window.turnstile?.reset) {
      try {
        window.turnstile.reset(widgetIdRef.current)
      } catch {
        // Ignorar si el widget aún no está listo.
      }
    }
  }, [resetKey])

  if (!siteKey) return null

  const handleRetry = () => {
    if (inputRef.current) inputRef.current.value = ""
    scriptPromise = null
    setToken("")
    setStatus("verifying")
    setRetryCount((c) => c + 1)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: 0, maxWidth: "100%" }}>
      <div
        ref={containerRef}
        style={{
          minWidth: 0,
          maxWidth: "100%",
          display: status === "error" ? "none" : "flex",
          justifyContent: "center",
        }}
      />
      <input ref={inputRef} type="hidden" name="captcha_token" value={token} readOnly />

      {status === "verifying" && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)", textAlign: "center" }}>
          Verificando conexión segura con Cloudflare…
        </p>
      )}

      {status === "verified" && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#15803d", textAlign: "center", fontWeight: 500 }}>
          ✓ Verificación de seguridad lista
        </p>
      )}

      {status === "error" && (
        <div
          role="alert"
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "var(--radius-sm)",
            padding: "0.625rem 0.75rem",
            fontSize: "0.75rem",
            color: "#92400e",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            lineHeight: 1.4,
          }}
        >
          <span>
            No se pudo cargar la verificación de seguridad de Cloudflare. Si usas bloqueador de anuncios o tu red es inestable, reintenta antes de continuar.
          </span>
          <button
            type="button"
            onClick={handleRetry}
            style={{
              alignSelf: "flex-start",
              background: "#ffffff",
              border: "1px solid #d97706",
              color: "#92400e",
              borderRadius: "var(--radius-sm)",
              padding: "0.25rem 0.625rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar verificación
          </button>
        </div>
      )}
    </div>
  )
}
