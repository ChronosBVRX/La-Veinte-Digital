"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { EnvelopeSimple, Lock, SignIn, WarningCircle, DownloadSimple } from "@phosphor-icons/react"
import { Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import { signInAction } from "../actions"
import { TurnstileWidget } from "../turnstile-widget"
import { ResendConfirmationForm } from "./resend-confirmation-form"
import { isFacebookLoginEnabled } from "@/shared/lib/auth-providers"
import { signInWithOAuth } from "@/lib/services/auth-client"
import { useAppEnvironment } from "@/shared/hooks/useAppEnvironment"

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, undefined)
  const [oauthProvider, setOauthProvider] = useState<"google" | "facebook" | null>(null)
  const [oauthError, setOauthError] = useState<string | null>(null)
  const { environment, platform, resolved } = useAppEnvironment()
  const shouldShowAndroidDownload = resolved && environment === "web" && platform === "android"

  const handleOAuth = async (provider: "google" | "facebook") => {
    setOauthError(null)
    setOauthProvider(provider)
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("lvd_oauth_pending", provider)
      }
      const res = await signInWithOAuth(provider)
      if (res?.error) {
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem("lvd_oauth_pending")
        }
        setOauthProvider(null)
        setOauthError("No se pudo conectar con Google. Verifica tu conexión e inténtalo de nuevo.")
      }
    } catch {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("lvd_oauth_pending")
      }
      setOauthProvider(null)
      setOauthError("No se pudo conectar con Google. Verifica tu conexión e inténtalo de nuevo.")
    }
  }

  const displayedError = state?.error ?? oauthError

  return (
    <>
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {displayedError && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          color: "var(--error)", fontSize: "0.875rem",
          background: "#fef2f2", padding: "0.75rem 1rem",
          borderRadius: "var(--radius-sm)",
        }}>
          <WarningCircle size={18} weight="fill" style={{ flexShrink: 0 }} />
          <span>{displayedError}</span>
        </div>
      )}

      {oauthProvider && (
        <div
          role="status"
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            padding: "0.75rem 1rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.8125rem",
            lineHeight: 1.45,
          }}
        >
          <strong>Conectando con {oauthProvider === "google" ? "Google" : "Facebook"}…</strong> En unos segundos serás redirigido. Al elegir tu cuenta, tu acceso o registro quedará listo automáticamente.
        </div>
      )}

      <Input
        id="email"
        name="email"
        label="Correo electrónico"
        type="email"
        required
        autoComplete="email"
        icon={<EnvelopeSimple size={18} />}
      />

      <div>
        <Input
          id="password"
          name="password"
          label="Contraseña"
          type="password"
          required
          autoComplete="current-password"
          icon={<Lock size={16} />}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.375rem" }}>
          <Link
            href="/recuperar-password"
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--primary)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>

      <Button type="submit" loading={pending} disabled={pending || oauthProvider !== null} style={{ width: "100%", justifyContent: "center" }}>
        {pending ? "Entrando..." : <><SignIn size={18} weight="bold" /> Iniciar sesión</>}
      </Button>

      <TurnstileWidget siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} resetKey={state} />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", whiteSpace: "nowrap" }}>o continúa con</span>
          <span style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button
            type="button"
            variant="secondary"
            loading={oauthProvider === "google"}
            disabled={pending || oauthProvider !== null}
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => handleOAuth("google")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {oauthProvider === "google" ? "Redirigiendo a Google..." : "Google"}
          </Button>
          {isFacebookLoginEnabled() && (
          <Button
            type="button"
            variant="secondary"
            loading={oauthProvider === "facebook"}
            disabled={pending || oauthProvider !== null}
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => handleOAuth("facebook")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            {oauthProvider === "facebook" ? "Redirigiendo..." : "Facebook"}
          </Button>
          )}
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
        ¿No tienes cuenta?{" "}
        <Link href="/register" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>
          Regístrate
        </Link>
      </p>

      {shouldShowAndroidDownload && (
      <a
        href="/LaVeinteDigital.apk"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "0.625rem 1rem",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: "var(--card)",
          color: "var(--fg)",
          fontSize: "0.875rem",
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        <DownloadSimple size={18} weight="bold" />
        Descargar app Android
      </a>
      )}

    </form>
    {state?.unconfirmedEmail && (
      <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, margin: "0 0 0.75rem" }}>
          Reenviar correo de confirmación
        </p>
        <ResendConfirmationForm email={state.unconfirmedEmail} />
      </div>
    )}
    </>
  )
}
