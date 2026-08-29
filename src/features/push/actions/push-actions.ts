"use server"

import { createClient } from "@/lib/supabase/server"
import { sendBroadcast, sendToUsers, sendToUser, sanitizeDestination, type PushPayload, type PushType } from "@/features/push/services/push-admin"

const VALID_TYPES: PushType[] = ["GENERAL", "IMPORTANT_ALERT", "AGENDA", "DOCUMENT", "UPDATE"]

function allowedEmails(): string[] {
  return (process.env.PUSH_ADMIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export interface EnviarNotificacionInput {
  title: string
  message: string
  category: PushType
  destination?: string
  /** Si viene vacío → todos (broadcast). */
  userIds?: string[]
}

export async function enviarNotificacion(input: EnviarNotificacionInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email ?? ""
  const allowed = allowedEmails()

  // El backend comprueba permisos: ocultar el botón en el frontend NO es seguridad.
  if (allowed.length === 0) {
    return { ok: false as const, error: "PUSH_ADMIN_NOT_CONFIGURED", sent: 0, failed: 0, invalidTokens: 0 }
  }
  if (!email || !allowed.includes(email.toLowerCase())) {
    return { ok: false as const, error: "No autorizado", sent: 0, failed: 0, invalidTokens: 0 }
  }

  const title = (input.title ?? "").trim()
  const message = (input.message ?? "").trim()
  if (!title || !message) {
    return { ok: false as const, error: "Título y mensaje son obligatorios", sent: 0, failed: 0, invalidTokens: 0 }
  }
  if (!VALID_TYPES.includes(input.category)) {
    return { ok: false as const, error: "Categoría inválida", sent: 0, failed: 0, invalidTokens: 0 }
  }

  const payload: PushPayload = {
    type: input.category,
    title: title.slice(0, 200),
    body: message.slice(0, 500),
    destination: sanitizeDestination(input.destination),
  }

  try {
    const userIds = (input.userIds ?? []).filter((v) => typeof v === "string" && v.length > 0)
    const r = userIds.length === 0
      ? await sendBroadcast(payload)
      : userIds.length === 1
        ? await sendToUser(userIds[0], payload)
        : await sendToUsers(userIds, payload)
    return { ok: true as const, sent: r.sent, failed: r.failed, invalidTokens: r.invalidTokens }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown"
    console.error("[push/action]", e)
    return { ok: false as const, error: msg, sent: 0, failed: 0, invalidTokens: 0 }
  }
}
