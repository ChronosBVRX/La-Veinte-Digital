/**
 * Pure authorization decision for the admin push endpoint. Kept free of Supabase/Next so it can be
 * unit-tested directly. Deny-by-default: unconfigured, non-admin, or wrong key → deny.
 */
export type PushAuthDecision =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 503; error: string; code: string }

export function authorizePushAdmin(params: {
  userEmail: string | null
  adminKeyHeader: string | null
  adminEmails: string | undefined
  adminKey: string | undefined
}): PushAuthDecision {
  // Fail closed: never send unless everything is configured AND the caller is an admin.
  if (!params.adminKey) {
    return { ok: false, status: 503, error: "PUSH_ADMIN_NOT_CONFIGURED", code: "push_admin_not_configured" }
  }
  if (!params.adminEmails) {
    return { ok: false, status: 503, error: "PUSH_ADMIN_NOT_CONFIGURED", code: "push_admin_not_configured" }
  }
  const allowed = params.adminEmails
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const callerEmail = params.userEmail?.trim().toLowerCase()
  if (!callerEmail || !allowed.includes(callerEmail)) {
    return { ok: false, status: 403, error: "No autorizado", code: "forbidden" }
  }
  // Second factor: shared admin key (never exposed to the client).
  if (params.adminKeyHeader !== params.adminKey) {
    return { ok: false, status: 403, error: "No autorizado", code: "forbidden" }
  }
  return { ok: true }
}
