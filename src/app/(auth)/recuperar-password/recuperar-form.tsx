"use client"

import { useActionState } from "react"
import Link from "next/link"
import { EnvelopeSimple, PaperPlaneTilt, WarningCircle, CheckCircle, ArrowLeft } from "@phosphor-icons/react"
import { Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import { resetPasswordRequestAction } from "../actions"

export function RecuperarPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordRequestAction, undefined)

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
            Revisa tu correo electrónico
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
            {state.message}
          </p>
        </div>

        <Link
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "0.75rem 1rem",
            background: "var(--accent)",
            borderRadius: "var(--radius)",
            color: "var(--fg)",
            textDecoration: "none",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} weight="bold" /> Volver al inicio de sesión
        </Link>
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
        Ingresa el correo electrónico asociado a tu cuenta y te enviaremos un enlace para crear una nueva contraseña.
      </p>

      <Input
        id="email"
        name="email"
        label="Correo electrónico"
        type="email"
        required
        autoComplete="email"
        placeholder="ejemplo@imss.gob.mx"
        icon={<EnvelopeSimple size={18} />}
      />

      <Button type="submit" loading={pending} style={{ width: "100%", justifyContent: "center" }}>
        {pending ? "Enviando enlace..." : <><PaperPlaneTilt size={18} weight="bold" /> Enviar enlace de recuperación</>}
      </Button>

      <div style={{ textAlign: "center", marginTop: "0.25rem" }}>
        <Link
          href="/login"
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--primary)",
            textDecoration: "none",
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
          }}
        >
          <ArrowLeft size={14} weight="bold" /> Volver al inicio de sesión
        </Link>
      </div>
    </form>
  )
}
