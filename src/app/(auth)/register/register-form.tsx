"use client"

import { useActionState } from "react"
import { signUpAction } from "../actions"

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => {
      try {
        await signUpAction(formData)
        return {}
      } catch (e) {
        return { error: (e as Error).message }
      }
    },
    undefined
  )

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {state?.error && (
        <p style={{ color: "#dc2626", fontSize: "0.875rem", background: "#fef2f2", padding: "0.5rem", borderRadius: "0.375rem" }}>
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="full_name" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>
          Nombre completo
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: "0.375rem" }}
        />
      </div>
      <div>
        <label htmlFor="email" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: "0.375rem" }}
        />
      </div>
      <div>
        <label htmlFor="password" style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.25rem" }}>
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)", borderRadius: "0.375rem" }}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        style={{
          width: "100%", padding: "0.625rem", background: "var(--primary)", color: "var(--primary-fg)",
          border: "none", borderRadius: "0.375rem", fontWeight: 600, cursor: "pointer", opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Creando cuenta..." : "Crear cuenta"}
      </button>
      <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--muted)" }}>
        ¿Ya tienes cuenta?{" "}
        <a href="/login" style={{ color: "var(--primary)", textDecoration: "none" }}>
          Inicia sesión
        </a>
      </p>
    </form>
  )
}
