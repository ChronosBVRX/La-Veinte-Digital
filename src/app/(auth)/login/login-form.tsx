"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react"
import { Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
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

      <Input
        id="email"
        name="email"
        label="Correo electrónico"
        type="email"
        required
        autoComplete="email"
        icon={<Mail size={16} />}
      />

      <Input
        id="password"
        name="password"
        label="Contraseña"
        type="password"
        required
        autoComplete="current-password"
        icon={<Lock size={16} />}
      />

      <Button type="submit" loading={pending} style={{ width: "100%", justifyContent: "center" }}>
        {pending ? "Entrando..." : <><LogIn size={16} /> Iniciar sesión</>}
      </Button>

      <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
        ¿No tienes cuenta?{" "}
        <Link href="/register" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>
          Regístrate
        </Link>
      </p>
    </form>
  )
}
