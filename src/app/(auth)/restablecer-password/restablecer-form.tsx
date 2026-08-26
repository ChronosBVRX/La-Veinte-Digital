"use client"

import { useActionState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Lock, CheckCircle, WarningCircle, Check } from "@phosphor-icons/react"
import { Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import { updatePasswordAction } from "../actions"

export function RestablecerPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, undefined)
  const router = useRouter()

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        router.push("/")
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [state?.success, router])

  if (state?.success) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", textAlign: "center" }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--state-success-bg)",
          color: "var(--state-success-fg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto",
        }}>
          <CheckCircle size={28} weight="fill" />
        </div>

        <div>
          <h2 style={{ fontSize: "var(--text-md)", fontWeight: 700, margin: "0 0 0.5rem" }}>
            ¡Contraseña actualizada!
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0 }}>
            Tu contraseña ha sido cambiada correctamente. Redirigiendo a tu cuenta...
          </p>
        </div>

        <Button onClick={() => router.push("/")} style={{ width: "100%", justifyContent: "center" }}>
          Ir al Inicio
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {state?.error && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          color: "var(--error)", fontSize: "var(--text-sm)",
          background: "var(--state-error-bg)", padding: "0.75rem 1rem",
          borderRadius: "var(--radius-sm)",
        }}>
          <WarningCircle size={18} weight="fill" style={{ flexShrink: 0 }} />
          <span>{state.error}</span>
        </div>
      )}

      <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
        Crea una contraseña de al menos 6 caracteres para proteger tu cuenta.
      </p>

      <Input
        id="password"
        name="password"
        label="Nueva contraseña"
        type="password"
        required
        autoComplete="new-password"
        placeholder="Mínimo 6 caracteres"
        icon={<Lock size={18} />}
      />

      <Input
        id="confirm_password"
        name="confirm_password"
        label="Confirmar nueva contraseña"
        type="password"
        required
        autoComplete="new-password"
        placeholder="Repite la nueva contraseña"
        icon={<Lock size={18} />}
      />

      <Button type="submit" loading={pending} style={{ width: "100%", justifyContent: "center" }}>
        {pending ? "Guardando..." : <><Check size={18} weight="bold" /> Guardar nueva contraseña</>}
      </Button>

      <div style={{ textAlign: "center", marginTop: "0.25rem" }}>
        <Link
          href="/recuperar-password"
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--muted)",
            textDecoration: "none",
          }}
        >
          ¿El enlace expiró? Solicita uno nuevo
        </Link>
      </div>
    </form>
  )
}
