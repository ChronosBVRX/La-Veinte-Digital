import { createClient as createServiceRoleClient } from "@supabase/supabase-js"

/**
 * Server-only push sending via Firebase Admin/FCM.
 *
 * Secrets live EXCLUSIVELY in environment (Vercel/Supabase), never in the repo:
 *  - FIREBASE_SERVICE_ACCOUNT_JSON  → Firebase Admin service-account JSON (string)
 *  - SUPABASE_SERVICE_ROLE_KEY      → service-role key (token cleanup on UNREGISTERED)
 *
 * All token writes/reads go through the service-role client (privileged backend path).
 * Clients can NEVER call these directly with their own session.
 */

export type PushType =
  | "GENERAL"
  | "IMPORTANT_ALERT"
  | "AGENDA"
  | "DOCUMENT"
  | "UPDATE"

export interface PushPayload {
  type: PushType
  title: string
  body: string
  /** Internal destination URL (allowlisted further down) — never arbitrary external URLs. */
  destination?: string
  /** ID numérico opcional para que Android no sobreescriba notificaciones */
  notificationId?: number
}

const CANONICAL_ORIGIN = "https://la-veinte-digital.vercel.app"

export function sanitizeDestination(destination?: string | null): string | undefined {
  if (!destination) return undefined
  const trimmed = destination.trim()
  if (!trimmed) return undefined

  // Prevenir bypasses por protocolo relativo ("//") o barras invertidas ("/\")
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) {
    return undefined
  }

  try {
    const url = new URL(trimmed, CANONICAL_ORIGIN)
    // El origen debe coincidir exactamente con el origen canónico
    if (url.origin !== CANONICAL_ORIGIN) {
      return undefined
    }
    // El protocolo debe ser https
    if (url.protocol !== "https:") {
      return undefined
    }
    // Rechazar credenciales embebidas (username o password)
    if (url.username || url.password) {
      return undefined
    }
    return url.toString()
  } catch {
    return undefined
  }
}

interface FirebaseMessagingResult {
  responses: Array<{ success: boolean; error?: { code: string } }>
}

type FirebaseMessaging = { sendEachForMulticast: (msg: unknown) => Promise<FirebaseMessagingResult> }

let cachedAdmin: { app: unknown; messaging: FirebaseMessaging } | null = null

async function firebaseAdmin() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!json) {
    throw new Error("PUSH_ADMIN_NOT_CONFIGURED")
  }
  // Lazy dynamic (ESM) import keeps this server-only and avoids eager init.
  const admin = await import("firebase-admin")
  const apps = admin.apps as unknown[]
  if (cachedAdmin) return cachedAdmin
  if (!apps.length) {
    const parsed = JSON.parse(json)
    admin.initializeApp({ credential: admin.credential.cert(parsed) })
  }
  const messaging = (admin.messaging as unknown as () => FirebaseMessaging)()
  cachedAdmin = { app: admin, messaging }
  return cachedAdmin
}

function serviceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!key || !url) throw new Error("SUPABASE_SERVICE_ROLE_NOT_CONFIGURED")
  return createServiceRoleClient(url, key)
}

function normalizePayload(payload: PushPayload) {
  return {
    type: payload.type,
    title: payload.title.slice(0, 200),
    body: payload.body.slice(0, 500),
    destination: sanitizeDestination(payload.destination),
  }
}

async function removeInvalidTokens(tokens: string[]) {
  if (!tokens.length) return
  try {
    const supabase = serviceRoleClient()
    const { error } = await supabase
      .from("push_devices")
      .delete()
      .in("fcm_token", tokens)
    if (error) console.error("[push-admin][cleanup]", error.message)
  } catch (e) {
    console.error("[push-admin][cleanup]", e)
  }
}

/** Sends to every device registered to this user (post-logout stale tokens are untouched). */
export async function sendToUser(userId: string, payload: PushPayload) {
  const supabase = serviceRoleClient()
  const { data, error } = await supabase
    .from("push_devices")
    .select("fcm_token")
    .eq("user_id", userId)
    .eq("notifications_enabled", true)
  if (error) throw error
  const tokens = (data ?? []).map((d) => d.fcm_token).filter(Boolean)
  return await deliver(tokens, payload)
}

export async function sendToUsers(userIds: string[], payload: PushPayload) {
  const supabase = serviceRoleClient()
  const { data, error } = await supabase
    .from("push_devices")
    .select("fcm_token")
    .in("user_id", userIds)
    .eq("notifications_enabled", true)
  if (error) throw error
  const tokens = (data ?? []).map((d) => d.fcm_token).filter(Boolean)
  return await deliver(tokens, payload)
}

export async function sendBroadcast(payload: PushPayload) {
  const supabase = serviceRoleClient()
  const PAGE_SIZE = 1000
  let from = 0
  const allTokens: string[] = []

  while (true) {
    const { data, error } = await supabase
      .from("push_devices")
      .select("fcm_token")
      .eq("notifications_enabled", true)
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    for (const d of data) {
      if (d.fcm_token) allTokens.push(d.fcm_token)
    }

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return await deliver(allTokens, payload)
}

const MAX_FCM_BATCH_SIZE = 500

export async function deliver(tokens: string[], payload: PushPayload) {
  // Deduplicación estricta de tokens
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)))
  if (!uniqueTokens.length) return { sent: 0, failed: 0, invalidTokens: 0 }

  const { messaging } = await firebaseAdmin()
  const normalized = normalizePayload(payload)

  let totalSent = 0
  let totalFailed = 0
  const allInvalid: string[] = []

  // Dividir en lotes de como máximo 500 (límite oficial de Firebase sendEachForMulticast)
  for (let i = 0; i < uniqueTokens.length; i += MAX_FCM_BATCH_SIZE) {
    const chunk = uniqueTokens.slice(i, i + MAX_FCM_BATCH_SIZE)
    const message = {
      tokens: chunk,
      android: { priority: "HIGH" as const, ttl: 60 * 60 * 4 },
      data: {
        type: normalized.type,
        title: normalized.title,
        body: normalized.body,
        destination: normalized.destination ?? "",
        silent: "false",
        ...(payload.notificationId ? { id: String(payload.notificationId) } : {}),
      },
    }

    const result = await messaging.sendEachForMulticast(message)
    const responses = result.responses ?? []

    responses.forEach((r, idx) => {
      if (r.success) {
        totalSent++
      } else if (
        r.error &&
        (r.error.code === "messaging/registration-token-not-registered" ||
          r.error.code === "UNREGISTERED")
      ) {
        allInvalid.push(chunk[idx])
      } else {
        totalFailed++
      }
    })
  }

  if (allInvalid.length) {
    await removeInvalidTokens(allInvalid)
  }

  return { sent: totalSent, failed: totalFailed, invalidTokens: allInvalid.length }
}
