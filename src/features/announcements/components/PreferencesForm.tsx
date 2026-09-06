"use client"

import { useActionState } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import { updatePreferencesAction, type ActionResponse } from "../actions/announcement-actions"
import { Bell, Check, ShieldCheck } from "@phosphor-icons/react"

interface PreferencesFormProps {
  initialEnabled: boolean
}

export function PreferencesForm({ initialEnabled }: PreferencesFormProps) {
  const [state, formAction, pending] = useActionState(
    updatePreferencesAction,
    undefined as ActionResponse | undefined
  )

  return (
    <form action={formAction}>
      <Card padding="1.5rem">
        <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem" }}>
          Notificaciones al teléfono celular
        </h3>

        {state?.ok && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: "1rem", color: "#166534", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Check size={16} weight="bold" />
            <span>Preferencias guardadas correctamente.</span>
          </div>
        )}

        {state?.error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: "1rem", color: "#991b1b", fontSize: "0.875rem" }}>
            {state.error}
          </div>
        )}

        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", cursor: "pointer", marginBottom: "1.25rem" }}>
          <input
            type="checkbox"
            name="announcements_push_enabled"
            defaultChecked={initialEnabled}
            style={{ width: "20px", height: "20px", marginTop: "0.15rem", accentColor: "var(--primary)" }}
          />
          <div>
            <span style={{ fontSize: "0.9375rem", fontWeight: 600, display: "block" }}>
              Recibir avisos y comunicados generales vía Push
            </span>
            <span style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.4, display: "block", marginTop: "0.25rem" }}>
              Te avisaremos en tu teléfono sobre convocatorias, eventos y noticias sindicales relevantes.
            </span>
          </div>
        </label>

        <div style={{
          background: "var(--accent)",
          border: "1px solid var(--border)",
          borderRadius: "0.5rem",
          padding: "0.875rem 1rem",
          fontSize: "0.8125rem",
          color: "var(--muted)",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.625rem",
          marginBottom: "1.25rem",
        }}>
          <ShieldCheck size={20} weight="duotone" color="var(--primary)" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
          <span>
            <strong>Privacidad garantizada:</strong> Desactivar este interruptor detiene los comunicados editoriales, pero conserva tus recordatorios personales de compromisos laborales (audiencias, citas) que configures en Mi Agenda.
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="primary" size="md" type="submit" loading={pending}>
            Guardar preferencias
          </Button>
        </div>
      </Card>
    </form>
  )
}
