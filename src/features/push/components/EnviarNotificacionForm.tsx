"use client"

import { useActionState } from "react"
import { Select, Input, Textarea } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import { enviarNotificacion, type EnviarNotificacionInput } from "../actions/push-actions"

type State = { ok: boolean; error?: string; sent?: number; failed?: number; invalidTokens?: number } | null

export function EnviarNotificacionForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(async (_prev, formData) => {
    const input: EnviarNotificacionInput = {
      title: String(formData.get("title") ?? ""),
      message: String(formData.get("message") ?? ""),
      category: (String(formData.get("category") ?? "GENERAL") as EnviarNotificacionInput["category"]),
      destination: String(formData.get("destination") ?? ""),
    }
    return enviarNotificacion(input)
  }, null)

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
        Enviando como <strong>{email}</strong>
      </div>
      <Input label="Título" name="title" placeholder="Ej. Nuevo aviso importante" required />
      <Textarea label="Mensaje" name="message" rows={4} placeholder="Escribe el mensaje de la notificación" required />
      <Select label="Categoría" name="category" defaultValue="GENERAL">
        <option value="GENERAL">General</option>
        <option value="IMPORTANT_ALERT">Aviso importante</option>
        <option value="AGENDA">Mi Agenda</option>
        <option value="DOCUMENT">Documento IMSS</option>
        <option value="UPDATE">Actualización</option>
      </Select>
      <Input label="Destino (profundo, opcional)" name="destination" placeholder="Ej. /documentos-personales" />

      <Button type="submit" loading={pending} disabled={pending}>
        {pending ? "Enviando..." : "Enviar notificación"}
      </Button>

      {state?.ok === false && (
        <div style={{ color: "var(--error)", fontSize: "0.8125rem" }}>{state.error}</div>
      )}
      {state?.ok === true && (
        <div style={{ color: "#16a34a", fontSize: "0.8125rem" }}>
          Enviada: {state.sent} ok · {state.failed} fallaron · {state.invalidTokens} tókenes inválidos
        </div>
      )}
    </form>
  )
}
