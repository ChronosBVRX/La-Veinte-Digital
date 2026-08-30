import { sanitizeDestination } from "./push-admin"

export type PushType = "GENERAL" | "IMPORTANT_ALERT" | "AGENDA" | "DOCUMENT" | "UPDATE"

export interface PushSendInput {
  type: PushType
  title: string
  message: string
  destination?: string
  userIds?: string[]
}

export type PushValidationResult =
  | { ok: true; value: PushSendInput }
  | { ok: false; status: 400; error: string }

export const VALID_TYPES: PushType[] = ["GENERAL", "IMPORTANT_ALERT", "AGENDA", "DOCUMENT", "UPDATE"]
export const MAX_TITLE = 200
export const MAX_MESSAGE = 500
export const MAX_USER_IDS = 100
export const MAX_DESTINATION = 2048

// V4-style UUID (superset: accepts v1-v8 hex groups; rejects arbitrary strings).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates and normalizes a push request body. Deny-by-default: any unexpected shape/type is
 * rejected (400). Never trusts the caller's category/destination/userIds blindly.
 */
export function validatePushSend(body: unknown): PushValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, status: 400, error: "Cuerpo inválido" }
  }
  const b = body as Record<string, unknown>

  const title = typeof b.title === "string" ? b.title.trim() : ""
  const message = typeof b.message === "string" ? b.message.trim() : ""

  if (!title || title.length > MAX_TITLE) {
    return { ok: false, status: 400, error: `title inválida (1..${MAX_TITLE})` }
  }
  if (!message || message.length > MAX_MESSAGE) {
    return { ok: false, status: 400, error: `message inválido (1..${MAX_MESSAGE})` }
  }

  const type = (typeof b.category === "string" ? b.category : "GENERAL") as PushType
  if (!VALID_TYPES.includes(type)) {
    return { ok: false, status: 400, error: "Categoría inválida" }
  }

  // Destination must be internal (or a root-relative path). Reject anything else outright.
  let destination: string | undefined
  if (b.destination != null && b.destination !== "") {
    if (typeof b.destination !== "string" || b.destination.length > MAX_DESTINATION) {
      return { ok: false, status: 400, error: "destination inválida" }
    }
    const cleaned = sanitizeDestination(b.destination)
    if (!cleaned) {
      // Provided but not allowed → reject instead of silently dropping (avoids confusion/abuse).
      return { ok: false, status: 400, error: "destination no permitida" }
    }
    destination = cleaned
  }

  // userIds: optional batch. Must be an array of UUIDs, deduped, bounded.
  let userIds: string[] | undefined
  if (b.userIds != null) {
    if (!Array.isArray(b.userIds)) {
      return { ok: false, status: 400, error: "userIds debe ser un arreglo" }
    }
    if (b.userIds.length === 0) {
      return { ok: false, status: 400, error: "userIds vacío" }
    }
    const seen = new Set<string>()
    const cleanedIds: string[] = []
    for (const v of b.userIds) {
      if (typeof v !== "string" || !UUID_RE.test(v)) {
        return { ok: false, status: 400, error: "userIds con formato inválido" }
      }
      if (!seen.has(v)) {
        seen.add(v)
        cleanedIds.push(v)
      }
    }
    if (cleanedIds.length > MAX_USER_IDS) {
      return { ok: false, status: 400, error: `máximo ${MAX_USER_IDS} usuarios` }
    }
    userIds = cleanedIds
  }

  return { ok: true, value: { type, title, message, destination, userIds } }
}
