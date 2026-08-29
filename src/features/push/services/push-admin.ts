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
}

// Only internal destinations are allowed for a push deep link.
const ALLOWED_DESTINATION_PREFIXES = [
  "https://la-veinte-digital.vercel.app/",
  "https://la-veinte-digital.vercel.app",
  "/",
]

export function sanitizeDestination(destination?: string | null): string | undefined {
  if (!destination) return undefined
  if (destination.startsWith("/")) {
    return `https://la-veinte-digital.vercel.app${destination}`
  }
  if (ALLOWED_DESTINATION_PREFIXES.some((p) => destination.startsWith(p))) {
    return destination
  }
  return undefined
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
  const { data, error } = await supabase
    .from("push_devices")
    .select("fcm_token")
    .eq("notifications_enabled", true)
  if (error) throw error
  const tokens = (data ?? []).map((d) => d.fcm_token).filter(Boolean)
  return await deliver(tokens, payload)
}

async function deliver(tokens: string[], payload: PushPayload) {
  if (!tokens.length) return { sent: 0, failed: 0, invalidTokens: 0 }
  const { messaging } = await firebaseAdmin()
  const normalized = normalizePayload(payload)
  const message = {
    tokens,
    android: { priority: "HIGH" as const, ttl: 60 * 60 * 4 },
    data: {
      type: normalized.type,
      title: normalized.title,
      body: normalized.body,
      destination: normalized.destination ?? "",
      silent: "false",
    },
  }
  const result = await messaging.sendEachForMulticast(message)
  const responses = result.responses ?? []
  const invalid: string[] = []
  let sent = 0
  let failed = 0
  responses.forEach((r, i) => {
    if (r.success) {
      sent++
    } else if (r.error && (r.error.code === "messaging/registration-token-not-registered" || r.error.code === "UNREGISTERED")) {
      invalid.push(tokens[i])
    } else {
      failed++
    }
  })
  if (invalid.length) await removeInvalidTokens(invalid)
  return { sent, failed, invalidTokens: invalid.length }
}
