"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react"
import { signInAction } from "../actions"

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => {
      try {
        await signInAction(formData)
        return {}
      } catch (e) {
        return { error: (e as Error).message }
      }
    },
    undefined
  )

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {state?.error && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          color: "var(--error)", fontSize: "0.875rem",
          background: "#fef2f2", padding: "0.75rem 1rem",
          borderRadius: "var(--radius-sm)",
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <label htmlFor="email" style={{
          display: "block", fontSize: "0.8125rem", fontWeight: 600,
          marginBottom: "0.375rem", color: "var(--fg)",
        }}>
          Correo electrónico
        </label>
        <div style={{ position: "relative" }}>
          <Mail size={16} style={{
            position: "absolute", left: "0.75rem", top: "50%",
            transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none",
          }} />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            style={{
              width: "100%", padding: "0.625rem 0.75rem 0.625rem 2.25rem",
              border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              background: "var(--bg)", color: "var(--fg)", fontSize: "0.875rem",
              outline: "none", transition: "border-color var(--transition), box-shadow var(--transition)",
            }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" style={{
          display: "block", fontSize: "0.8125rem", fontWeight: 600,
          marginBottom: "0.375rem", color: "var(--fg)",
        }}>
          Contraseña
        </label>
        <div style={{ position: "relative" }}>
          <Lock size={16} style={{
            position: "absolute", left: "0.75rem", top: "50%",
            transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none",
          }} />
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            style={{
              width: "100%", padding: "0.625rem 0.75rem 0.625rem 2.25rem",
              border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              background: "var(--bg)", color: "var(--fg)", fontSize: "0.875rem",
              outline: "none", transition: "border-color var(--transition), box-shadow var(--transition)",
            }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        style={{
          width: "100%", padding: "0.625rem",
          background: pending ? "var(--muted)" : "var(--primary)",
          color: "var(--primary-fg)", border: "none",
          borderRadius: "var(--radius)", fontWeight: 600, fontSize: "0.875rem",
          cursor: pending ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
          transition: "all var(--transition)",
        }}
      >
        {pending ? (
          <>
            <span style={{
              width: 16, height: 16, borderRadius: "50%",
              border: "2px solid currentColor", borderTopColor: "transparent",
              animation: "spin 0.6s linear infinite", display: "inline-block",
            }} />
            Entrando...
          </>
        ) : (
          <>
            <LogIn size={16} />
            Iniciar sesión
          </>
        )}
      </button>

      <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
        ¿No tienes cuenta?{" "}
        <Link href="/register" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>
          Regístrate
        </Link>
      </p>
    </form>
  )
}
