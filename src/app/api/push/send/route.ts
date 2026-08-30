import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/shared/server/auth/require-user"
import { sendBroadcast, sendToUser, sendToUsers } from "@/features/push/services/push-admin"
import { authorizePushAdmin } from "@/features/push/services/push-authorize"
import { validatePushSend } from "@/features/push/services/push-validate"
import { fixedWindow, type RateLimiterResult } from "@/features/push/services/push-rate-limit"

const MAX_BODY_BYTES = 32 * 1024 // 32 KB: title(200)+message(500)+metadata; anything bigger is abuse.
const RATE_WINDOW_SECONDS = 60

// In-memory fixed-window store (best-effort per instance; see rate-limit helper).
const rateStore: Record<string, { count: number; resetAt: number }> = {}

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]!.trim()
  return request.headers.get("x-real-ip") ?? "unknown"
}

/**
 * POST /api/push/send
 *
 * Deny-by-default admin endpoint. Authorization is decided server-side:
 *   1. A valid authenticated session (requireUser, Rule 6) — 401 if absent.
 *   2. The caller's email must be in PUSH_ADMIN_EMAILS — 403 otherwise.
 *   3. The `X-Push-Admin-Key` header must equal PUSH_ADMIN_KEY — 403 otherwise (defense in depth).
 *   4. Unconfigured (no key and/or no admin emails) → 503 (fail closed).
 * Plus: body-size guard (413), strict schema validation (400), internal-only destination, UUID-only
 * userIds (bounded/deduped), and best-effort rate limiting (429).
 *
 * Secrets (PUSH_ADMIN_KEY, FIREBASE_SERVICE_ACCOUNT_JSON, SUPABASE_SERVICE_ROLE_KEY) are NEVER
 * logged or exposed; they live only in the server environment.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  // Authorization (deny by default).
  const decision = authorizePushAdmin({
    userEmail: auth.user.email ?? null,
    adminKeyHeader: request.headers.get("x-push-admin-key"),
    adminEmails: process.env.PUSH_ADMIN_EMAILS,
    adminKey: process.env.PUSH_ADMIN_KEY,
  })
  if (!decision.ok) {
    return NextResponse.json(
      { error: decision.error, code: decision.code },
      { status: decision.status, headers: { "Cache-Control": "private, no-store" } },
    )
  }

  // Rate limiting (best-effort, per IP).
  const rateLimitPerMin = Number(process.env.PUSH_SEND_RATE_LIMIT ?? "10")
  const rate: RateLimiterResult = fixedWindow(
    rateStore,
    `push|${clientIp(request)}`,
    rateLimitPerMin,
    RATE_WINDOW_SECONDS,
    Math.floor(Date.now() / 1000),
  )
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes", code: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds), "Cache-Control": "private, no-store" },
      },
    )
  }

  // Body size guard — do not read unbounded JSON. Trust content-length when present, then verify
  // the actual text length to also cover chunked requests.
  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Cuerpo demasiado grande" }, { status: 413 })
  }

  let raw: string
  try {
    raw = await request.text()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Cuerpo demasiado grande" }, { status: 413 })
  }

  let body: unknown
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const parsed = validatePushSend(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  }
  const { type, title, message, destination, userIds } = parsed.value

  try {
    const result = userIds
      ? userIds.length === 1
        ? await sendToUser(userIds[0], { type, title, body: message, destination })
        : await sendToUsers(userIds, { type, title, body: message, destination })
      : await sendBroadcast({ type, title, body: message, destination })
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
