"use client"

import { useActionState, useEffect, useState } from "react"
import { EnvelopeSimple, PaperPlaneTilt, WarningCircle } from "@phosphor-icons/react"
import { Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import { resendConfirmationAction } from "../actions"

const RESEND_COOLDOWN_SECONDS = 60

/**
 * Reenvío de correo de confirmación con enfriamiento de 60 segundos.
 * Se muestra en /login cuando el callback reporta email_not_confirmed.
 */
export function ResendConfirmationForm({
  email = "",
  cooldownSeconds = RESEND_COOLDOWN_SECONDS,
}: {
  email?: string
  /** Duración del enfriamiento; 60 s en producción (testeable con valores menores). */
  cooldownSeconds?: number
}) {
  const [state, formAction, pending] = useActionState(resendConfirmationAction, undefined)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!state?.success) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- arranque intencional del enfriamiento al confirmarse el reenvío; el guard evita bucles
    setCooldown(cooldownSeconds)
  }, [state, cooldownSeconds])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
      {state?.success && (
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--muted)", lineHeight: 1.5 }}>
          {state.message}
        </p>
      )}
      <Input
        id="resend-email"
        name="email"
        label="Correo electrónico"
        type="email"
        required
        autoComplete="email"
        defaultValue={email}
        icon={<EnvelopeSimple size={18} />}
      />
      <Button
        type="submit"
        variant="secondary"
        loading={pending}
        disabled={pending || cooldown > 0}
        style={{ width: "100%", justifyContent: "center" }}
      >
        {pending
          ? "Reenviando..."
          : cooldown > 0
            ? `Reenviar en ${cooldown}s`
            : <><PaperPlaneTilt size={18} weight="bold" /> Reenviar confirmación</>}
      </Button>
    </form>
  )
}
