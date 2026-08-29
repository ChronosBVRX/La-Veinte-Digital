import { NextRequest, NextResponse } from "next/server"
import { sendBroadcast, sendToUser, sendToUsers, sanitizeDestination, type PushPayload, type PushType } from "@/features/push/services/push-admin"

const VALID_TYPES: PushType[] = ["GENERAL", "IMPORTANT_ALERT", "AGENDA", "DOCUMENT", "UPDATE"]

/**
 * POST /api/push/send
 *
 * Envío de notificaciones. Autorización en el SERVIDOR (ocultar el botón en el frontend NO es
 * seguridad): se exige la cabecera `X-Push-Admin-Key` === `PUSH_ADMIN_KEY` del entorno. La clave
 * nunca se expone al cliente; el panel admin usa una server action que la inyecta server-side.
 */
export async function POST(request: NextRequest) {
  const adminKey = process.env.PUSH_ADMIN_KEY
  if (!adminKey) {
    return NextResponse.json({ error: "PUSH_ADMIN_NOT_CONFIGURED" }, { status: 503 })
  }
  if (request.headers.get("x-push-admin-key") !== adminKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  let body: { title?: unknown; message?: unknown; category?: unknown; destination?: unknown; userIds?: unknown } | null = null
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const title = typeof body?.title === "string" ? body.title.trim() : ""
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  const category = (typeof body?.category === "string" ? body.category : "GENERAL") as PushType
  const destination = sanitizeDestination(typeof body?.destination === "string" ? body.destination : null)
  const userIds = Array.isArray(body?.userIds)
    ? (body.userIds as unknown[]).filter((v): v is string => typeof v === "string")
    : null

  if (!title || !message) {
    return NextResponse.json({ error: "Título y mensaje son obligatorios" }, { status: 400 })
  }
  if (!VALID_TYPES.includes(category)) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 })
  }

  const payload: PushPayload = { type: category, title, body: message, destination }

  try {
    const result = userIds
      ? userIds.length === 1
        ? await sendToUser(userIds[0], payload)
        : await sendToUsers(userIds, payload)
      : await sendBroadcast(payload)
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown"
    if (msg === "PUSH_ADMIN_NOT_CONFIGURED" || msg === "SUPABASE_SERVICE_ROLE_NOT_CONFIGURED") {
      return NextResponse.json({ error: msg }, { status: 503 })
    }
    console.error("[push/send]", e)
    return NextResponse.json({ error: "Error al enviar" }, { status: 500 })
  }
}
