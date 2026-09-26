"use server"

import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { sendBroadcast, sendToUsers, sendToUser, sanitizeDestination, type PushPayload, type PushType } from "@/features/push/services/push-admin"
import { revalidatePath } from "next/cache"

const VALID_TYPES: PushType[] = ["GENERAL", "IMPORTANT_ALERT", "AGENDA", "DOCUMENT", "UPDATE"]

export const DEFAULT_PUSH_TITLES: Record<PushType, string> = {
  GENERAL: "Aviso General",
  IMPORTANT_ALERT: "Alerta Importante",
  AGENDA: "Convocatoria y Agenda",
  DOCUMENT: "Documento IMSS",
  UPDATE: "Actualización del Sistema",
}

export interface EnviarNotificacionInput {
  title?: string
  message: string
  category: PushType
  destination?: string
  /** Si viene vacío → todos (broadcast). */
  userIds?: string[]
}

export async function enviarNotificacion(input: EnviarNotificacionInput) {
  const { user, capabilities } = await getAdminCapabilities()

  // El usuario debe tener rol admin formal o estar en la lista autorizada de correos
  if (!user || (!capabilities.isAdmin && !capabilities.canAccessLegacyPush)) {
    return { ok: false as const, error: "No autorizado para enviar notificaciones", sent: 0, failed: 0, invalidTokens: 0 }
  }

  const category = input.category ?? "GENERAL"
  if (!VALID_TYPES.includes(category)) {
    return { ok: false as const, error: "Categoría inválida", sent: 0, failed: 0, invalidTokens: 0 }
  }

  const message = (input.message ?? "").trim()
  if (!message) {
    return { ok: false as const, error: "El mensaje es obligatorio", sent: 0, failed: 0, invalidTokens: 0 }
  }

  const rawTitle = (input.title ?? "").trim()
  const title = rawTitle || DEFAULT_PUSH_TITLES[category] || "Aviso de La Veinte Digital"

  const payload: PushPayload = {
    type: category,
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

    revalidatePath("/admin")
    revalidatePath("/admin/push")

    return { ok: true as const, sent: r.sent, failed: r.failed, invalidTokens: r.invalidTokens }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown"
    console.error("[push/action]", e)
    return { ok: false as const, error: msg, sent: 0, failed: 0, invalidTokens: 0 }
  }
}

