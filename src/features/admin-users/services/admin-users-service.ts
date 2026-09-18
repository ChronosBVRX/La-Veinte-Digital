import "server-only"
import { createClient as createServerSupabase } from "@/lib/supabase/server"
import { createClient as createServiceRoleClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/lib/supabase/types"
import type {
  AccountStatus,
  AdminApiErrorCode,
  AdminAuditPage,
  AdminAuditQuery,
  AdminMutationResult,
  AdminUnionDelegation,
  AdminUnionMembership,
  AdminUserActivityEvent,
  AdminUserDetail,
  AdminUserListQuery,
  AdminUserMetrics,
  AdminUserPage,
  AdminUserSummary,
  PlatformRole,
  SortDirection,
  UnionRoleName,
} from "@/shared/contracts/admin-users"

export class AdminUsersError extends Error {
  readonly code: AdminApiErrorCode
  readonly status: number

  constructor(code: AdminApiErrorCode, message: string, status: number) {
    super(message)
    this.name = "AdminUsersError"
    this.code = code
    this.status = status
  }
}

interface RpcLikeError {
  message?: string
  code?: string
}

const RPC_ERROR_MAP: Record<string, { code: AdminApiErrorCode; status: number; message: string }> = {
  forbidden: { code: "forbidden", status: 403, message: "No autorizado" },
  reason_required: { code: "invalid_request", status: 400, message: "El motivo es obligatorio (mínimo 3 caracteres)." },
  reason_too_long: { code: "invalid_request", status: 400, message: "El motivo excede la longitud permitida." },
  invalid_role: { code: "invalid_request", status: 400, message: "Rol de plataforma inválido." },
  invalid_kind: { code: "invalid_request", status: 400, message: "Tipo de suspensión inválido." },
  invalid_ends_at: { code: "invalid_request", status: 400, message: "La fecha de finalización de la suspensión no es válida." },
  profile_not_found: { code: "not_found", status: 404, message: "La cuenta no tiene perfil asociado." },
  target_not_found: { code: "not_found", status: 404, message: "La cuenta no existe." },
  role_unchanged: { code: "role_unchanged", status: 409, message: "El rol ya coincide con el valor solicitado." },
  last_admin: {
    code: "last_admin",
    status: 409,
    message: "Operación bloqueada: es la última cuenta administradora con acceso total.",
  },
  self_target_forbidden: {
    code: "self_target_forbidden",
    status: 409,
    message: "No puedes aplicar esta acción sobre tu propia cuenta.",
  },
  already_trashed: { code: "already_trashed", status: 409, message: "La cuenta ya está en papelera." },
  not_trashed: { code: "not_trashed", status: 409, message: "La cuenta no está en papelera." },
  not_suspended: { code: "not_suspended", status: 409, message: "La cuenta no está suspendida." },
  email_mismatch: { code: "email_mismatch", status: 400, message: "El correo de confirmación no coincide con la cuenta." },
  blocked_references: {
    code: "blocked_references",
    status: 409,
    message:
      "La cuenta tiene referencias (por ejemplo, representación sindical) que impiden la eliminación definitiva. Requiere revisión manual de conservación documental.",
  },
  purge_disabled: {
    code: "purge_disabled",
    status: 403,
    message: "La eliminación definitiva está deshabilitada en el servidor (ADMIN_PERMANENT_DELETE_ENABLED).",
  },
  target_email_required: { code: "invalid_request", status: 400, message: "Falta el correo de confirmación." },
  invalid_union_role: { code: "invalid_request", status: 400, message: "Rol sindical inválido." },
  invalid_state: { code: "invalid_request", status: 400, message: "Estado de membresía inválido." },
  delegation_not_found: { code: "not_found", status: 404, message: "La delegación sindical no existe o está inactiva." },
  membership_not_found: { code: "not_found", status: 404, message: "La cuenta no tiene esa membresía sindical." },
}

export function mapRpcError(error: RpcLikeError | null | undefined): AdminUsersError {
  if (!error) {
    return new AdminUsersError("service_unavailable", "Operación administrativa no disponible.", 503)
  }

  const message = (error.message ?? "").trim()

  // Coincidencia exacta primero (RAISE EXCEPTION usa el texto tal cual).
  const exact = RPC_ERROR_MAP[message]
  if (exact) {
    return new AdminUsersError(exact.code, exact.message, exact.status)
  }

  // Fallback: la clave más específica (más larga) contenida en el mensaje,
  // para no confundir p. ej. "self_target_forbidden" con "forbidden".
  let bestKey: string | null = null
  for (const key of Object.keys(RPC_ERROR_MAP)) {
    if (message.includes(key) && (bestKey === null || key.length > bestKey.length)) {
      bestKey = key
    }
  }
  if (bestKey) {
    const mapped = RPC_ERROR_MAP[bestKey]
    return new AdminUsersError(mapped.code, mapped.message, mapped.status)
  }

  // Función inexistente: migración pendiente o backend no desplegado.
  if (error.code === "PGRST202" || message.includes("Could not find the function")) {
    return new AdminUsersError(
      "admin_backend_unavailable",
      "El backend administrativo no está disponible todavía (migración pendiente).",
      503,
    )
  }

  return new AdminUsersError("service_unavailable", "No se pudo completar la operación administrativa.", 503)
}

export function isPermanentDeleteEnabled(): boolean {
  return process.env.ADMIN_PERMANENT_DELETE_ENABLED === "true"
}

function serviceRoleClient(): SupabaseClient<Database> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!key || !url) {
    throw new AdminUsersError(
      "service_unavailable",
      "El backend administrativo no está configurado en este entorno.",
      503,
    )
  }
  return createServiceRoleClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ───────────────────────── Helpers de parseo seguro ─────────────────────────

function asRecord(value: Json | undefined | null): Record<string, Json | undefined> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, Json | undefined>
  }
  return {}
}

function asString(value: Json | undefined | null): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function asNumber(value: Json | undefined | null): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function asBoolean(value: Json | undefined | null): boolean {
  return value === true
}

function asStringArray(value: Json | undefined | null): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function asPlatformRole(value: Json | undefined | null): PlatformRole {
  return value === "admin" ? "admin" : "user"
}

function asAccountStatus(value: Json | undefined | null): AccountStatus {
  if (value === "suspended" || value === "trashed") return value
  return "active"
}

// ───────────────────────── Lecturas administrativas ─────────────────────────

export async function getAdminUsersPage(query: AdminUserListQuery): Promise<AdminUserPage> {
  const supabase = await createServerSupabase()
  const page = Math.max(1, Math.trunc(query.page))
  const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize)))

  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: query.search?.trim() ? query.search.trim() : undefined,
    p_status: query.status,
    p_role: query.role,
    p_registered_from: query.registeredFrom,
    p_registered_to: query.registeredTo,
    p_sort: query.sort,
    p_direction: query.direction,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  })

  if (error) throw mapRpcError(error)

  const rows = data ?? []
  const users: AdminUserSummary[] = rows.map((row) => ({
    id: row.user_id,
    email: row.email,
    fullName: row.full_name,
    matricula: row.matricula,
    role: asPlatformRole(row.role as Json),
    accountStatus: asAccountStatus(row.account_status as Json),
    suspensionKind:
      row.suspension_kind === "temporary" || row.suspension_kind === "indefinite"
        ? row.suspension_kind
        : null,
    suspensionEndsAt: row.suspension_ends_at,
    emailConfirmed: row.email_confirmed,
    registeredAt: row.registered_at,
    lastSignInAt: row.last_sign_in_at,
    providers: asStringArray(row.providers as Json),
    profileComplete: row.profile_complete,
  }))

  const total = rows.length > 0 ? asNumber(rows[0].total_count as Json) : 0

  return { users, total, page, pageSize }
}

export async function getAdminUserMetrics(): Promise<AdminUserMetrics> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.rpc("admin_user_metrics")

  if (error) throw mapRpcError(error)

  const metrics = asRecord(data)

  return {
    totalUsers: asNumber(metrics.totalUsers),
    activeUsers: asNumber(metrics.activeUsers),
    recentRegistrations: asNumber(metrics.recentRegistrations),
    pendingEmailConfirmation: asNumber(metrics.pendingEmailConfirmation),
    suspendedAccounts: asNumber(metrics.suspendedAccounts),
    trashedAccounts: asNumber(metrics.trashedAccounts),
    incompleteProfiles: asNumber(metrics.incompleteProfiles),
    usersWithPayslip: asNumber(metrics.usersWithPayslip),
  }
}

function parseActivity(raw: Json | null): AdminUserActivityEvent[] {
  if (!Array.isArray(raw)) return []
  const events: AdminUserActivityEvent[] = []

  for (const item of raw) {
    const record = asRecord(item)
    const kind = asString(record.kind)
    const at = asString(record.at)
    if (!kind || !at) continue
    if (kind !== "login" && kind !== "payslip_import" && kind !== "tool_usage" && kind !== "admin_action") continue

    const event: AdminUserActivityEvent = { kind, at }
    const route = asString(record.route)
    if (route) event.route = route
    if (typeof record.count === "number" || typeof record.count === "string") {
      event.count = asNumber(record.count)
    }
    const action = asString(record.action)
    if (action) event.action = action
    if (kind === "admin_action") event.reason = asString(record.reason)

    events.push(event)
  }

  return events
}

function parseUnionMemberships(raw: Json | undefined): AdminUnionMembership[] {
  if (!Array.isArray(raw)) return []

  const memberships: AdminUnionMembership[] = []
  for (const item of raw) {
    const record = asRecord(item)
    const id = asString(record.id)
    const delegationId = asString(record.delegationId)
    const role = asString(record.role)
    if (!id || !delegationId) continue
    if (role !== "union_rep" && role !== "union_admin") continue

    memberships.push({
      id,
      delegationId,
      delegationCode: asString(record.delegationCode) ?? "—",
      delegationName: asString(record.delegationName) ?? "—",
      role,
      active: asBoolean(record.active),
      createdAt: asString(record.createdAt),
      updatedAt: asString(record.updatedAt),
    })
  }

  return memberships
}

function parseUnionDelegations(raw: Json | undefined): AdminUnionDelegation[] {
  if (!Array.isArray(raw)) return []

  const delegations: AdminUnionDelegation[] = []
  for (const item of raw) {
    const record = asRecord(item)
    const id = asString(record.id)
    const code = asString(record.code)
    if (!id || !code) continue

    delegations.push({
      id,
      code,
      name: asString(record.name) ?? code,
      active: asBoolean(record.active),
    })
  }

  return delegations
}

function parseDetail(raw: Json | null): Omit<AdminUserDetail, "activity" | "permanentDeleteEnabled"> {
  const root = asRecord(raw)
  const user = asRecord(root.user)
  const status = asRecord(root.status)
  const union = asRecord(root.union)
  const counts = asRecord(root.counts)
  const diagnostics = asRecord(root.diagnostics)
  const flags = asRecord(root.flags)

  return {
    user: {
      id: asString(user.id) ?? "",
      email: asString(user.email),
      fullName: asString(user.fullName),
      matricula: asString(user.matricula),
      adscripcion: asString(user.adscripcion),
      categoria: asString(user.categoria),
      role: asPlatformRole(user.role),
      registeredAt: asString(user.registeredAt),
      profileCreatedAt: asString(user.profileCreatedAt),
      lastSignInAt: asString(user.lastSignInAt),
      emailConfirmedAt: asString(user.emailConfirmedAt),
      providers: asStringArray(user.providers),
    },
    status: {
      accountStatus: asAccountStatus(status.accountStatus),
      rawStatus: asAccountStatus(status.rawStatus),
      suspensionKind:
        status.suspensionKind === "temporary" || status.suspensionKind === "indefinite"
          ? status.suspensionKind
          : null,
      suspensionEndsAt: asString(status.suspensionEndsAt),
      suspensionExpired: asBoolean(status.suspensionExpired),
      reason: asString(status.reason),
      changedAt: asString(status.changedAt),
      changedBy: asString(status.changedBy),
      trashedAt: asString(status.trashedAt),
      purgeAfter: asString(status.purgeAfter),
      sessionsRevokedAt: asString(status.sessionsRevokedAt),
      authSyncAt: asString(status.authSyncAt),
      authSyncError: asString(status.authSyncError),
    },
    union: {
      memberships: parseUnionMemberships(union.memberships),
      delegations: parseUnionDelegations(union.delegations),
    },
    counts: {
      payslips: asNumber(counts.payslips),
      remoteDocuments: asNumber(counts.remoteDocuments),
      hasPayrollContext: asBoolean(counts.hasPayrollContext),
    },
    diagnostics: {
      authentication: diagnostics.authentication === "ERROR" ? "ERROR" : "OK",
      profile: diagnostics.profile === "INCOMPLETO" ? "INCOMPLETO" : "OK",
      payslip: diagnostics.payslip === "DISPONIBLE" ? "DISPONIBLE" : "NO_DISPONIBLE",
      documents:
        diagnostics.documents === "DISPONIBLE" || diagnostics.documents === "ERROR"
          ? diagnostics.documents
          : "NO_DISPONIBLE",
      storage: diagnostics.storage === "ERROR" ? "ERROR" : "OK",
      lastSyncAt: asString(diagnostics.lastSyncAt),
    },
    flags: {
      isSelf: asBoolean(flags.isSelf),
      canReactivate: asBoolean(flags.canReactivate),
      canRestore: asBoolean(flags.canRestore),
    },
  }
}

export async function getAdminUserDetail(targetId: string): Promise<AdminUserDetail | null> {
  const supabase = await createServerSupabase()

  const [detailResult, activityResult] = await Promise.all([
    supabase.rpc("admin_user_detail", { p_target: targetId }),
    supabase.rpc("admin_user_activity", { p_target: targetId, p_limit: 50 }),
  ])

  if (detailResult.error) throw mapRpcError(detailResult.error)
  if (detailResult.data === null || detailResult.data === undefined) return null

  const detail = parseDetail(detailResult.data)
  const activity = activityResult.error ? [] : parseActivity(activityResult.data)

  return {
    ...detail,
    activity,
    permanentDeleteEnabled: isPermanentDeleteEnabled(),
  }
}

export async function getAdminAuditPage(query: AdminAuditQuery): Promise<AdminAuditPage> {
  const supabase = await createServerSupabase()
  const page = Math.max(1, Math.trunc(query.page))
  const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize)))

  const { data, error } = await supabase.rpc("admin_list_audit_log", {
    p_action: query.action,
    p_target: query.targetId,
    p_actor: query.actorId,
    p_from: query.from,
    p_to: query.to,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  })

  if (error) throw mapRpcError(error)

  const rows = data ?? []
  const entries = rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityId: row.entity_id,
    targetEmail: row.target_email,
    targetName: row.target_name,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    actorName: row.actor_name,
    reason: row.reason,
    previousValue: row.previous_value,
    newValue: row.new_value,
    requestId: row.request_id,
    createdAt: row.created_at,
  }))

  const total = rows.length > 0 ? asNumber(rows[0].total_count as Json) : 0

  return { entries, total, page, pageSize }
}

// ───────────────────────── Auditoría complementaria ─────────────────────────

interface AuditContext {
  actorId: string
  targetId: string
  requestId?: string
}

async function writeAudit(
  context: AuditContext,
  action: string,
  details: Record<string, Json | undefined>,
): Promise<void> {
  try {
    const client = serviceRoleClient()
    await client.from("admin_audit_log").insert({
      actor_id: context.actorId,
      action,
      entity_type: "user",
      entity_id: context.targetId,
      details: details as Json,
      request_id: context.requestId ?? null,
    })
  } catch {
    // La auditoría complementaria nunca debe romper la operación principal.
  }
}

/**
 * Registra un intento administrativo rechazado (requisito de bitácora).
 * Se escribe fuera de la transacción rechazada para que quede constancia aun
 * cuando la RPC haya hecho rollback.
 */
export async function auditRejectedAttempt(
  context: AuditContext,
  attemptedAction: string,
  error: AdminUsersError,
  reason?: string | null,
): Promise<void> {
  await writeAudit(context, "user.action_rejected", {
    attempted: attemptedAction,
    code: error.code,
    reason: reason ? reason.trim().slice(0, 500) : undefined,
  })
}

async function markAuthSync(
  targetId: string,
  success: boolean,
  errorMessage?: string | null,
): Promise<void> {
  try {
    const client = serviceRoleClient()
    await client
      .from("user_admin_status")
      .update({
        auth_sync_at: new Date().toISOString(),
        auth_sync_error: success ? null : (errorMessage ?? "auth_sync_failed").slice(0, 300),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", targetId)
  } catch {
    // Metadato de diagnóstico; su fallo no altera la operación principal.
  }
}

function banDurationFor(kind: "temporary" | "indefinite", endsAt: string | null | undefined): string {
  if (kind === "indefinite") return "876000h"
  const end = endsAt ? new Date(endsAt).getTime() : Number.NaN
  if (!Number.isFinite(end)) return "1h"
  const hours = Math.max(1, Math.ceil((end - Date.now()) / 3_600_000))
  return `${hours}h`
}

async function syncAuthBan(
  context: AuditContext,
  kind: "temporary" | "indefinite",
  endsAt: string | null | undefined,
): Promise<"ok" | "failed"> {
  try {
    const client = serviceRoleClient()
    const { error } = await client.auth.admin.updateUserById(context.targetId, {
      ban_duration: banDurationFor(kind, endsAt),
    })
    if (error) throw new Error(error.message)
    await markAuthSync(context.targetId, true)
    return "ok"
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_sync_failed"
    await markAuthSync(context.targetId, false, message)
    await writeAudit(context, "user.auth_sync_failed", {
      attempted: "auth_ban",
      code: "auth_sync_failed",
    })
    return "failed"
  }
}

async function syncAuthUnban(context: AuditContext): Promise<"ok" | "failed"> {
  try {
    const client = serviceRoleClient()
    const { error } = await client.auth.admin.updateUserById(context.targetId, {
      ban_duration: "none",
    })
    if (error) throw new Error(error.message)
    await markAuthSync(context.targetId, true)
    return "ok"
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_sync_failed"
    await markAuthSync(context.targetId, false, message)
    await writeAudit(context, "user.auth_sync_failed", {
      attempted: "auth_unban",
      code: "auth_sync_failed",
    })
    return "failed"
  }
}

// ───────────────────────── Mutaciones administrativas ─────────────────────────

function newRequestId(): string {
  return globalThis.crypto.randomUUID()
}

export async function changeUserRole(
  actorId: string,
  targetId: string,
  role: PlatformRole,
  reason: string,
): Promise<AdminMutationResult> {
  const context: AuditContext = { actorId, targetId, requestId: newRequestId() }
  const client = serviceRoleClient()

  const { error } = await client.rpc("admin_apply_user_role", {
    p_actor: actorId,
    p_target: targetId,
    p_new_role: role,
    p_reason: reason,
    p_request_id: context.requestId,
  })

  if (error) throw mapRpcError(error)
  return { ok: true }
}

/**
 * Alta/baja auditada de una membresía sindical (Representación).
 * No modifica el rol de plataforma: los sistemas son ortogonales y el acceso
 * sindical depende de la membresía explícita (guardrail vigente).
 */
export async function setUnionMembership(
  actorId: string,
  targetId: string,
  delegationId: string,
  role: UnionRoleName,
  active: boolean,
  reason: string,
): Promise<AdminMutationResult> {
  const client = serviceRoleClient()

  const { error } = await client.rpc("admin_set_union_membership", {
    p_actor: actorId,
    p_target: targetId,
    p_delegation_id: delegationId,
    p_role: role,
    p_active: active,
    p_reason: reason,
    p_request_id: newRequestId(),
  })

  if (error) throw mapRpcError(error)

  return {
    ok: true,
    message: active
      ? "Rol sindical habilitado. El usuario ya puede acceder a Representación Sindical."
      : "Rol sindical retirado. Si no conserva otra membresía activa, perderá el acceso a Representación.",
  }
}

export async function suspendUser(
  actorId: string,
  targetId: string,
  kind: "temporary" | "indefinite",
  endsAt: string | null,
  reason: string,
): Promise<AdminMutationResult> {
  const context: AuditContext = { actorId, targetId, requestId: newRequestId() }
  const client = serviceRoleClient()

  const { error } = await client.rpc("admin_suspend_user", {
    p_actor: actorId,
    p_target: targetId,
    p_kind: kind,
    p_ends_at: kind === "temporary" ? endsAt : null,
    p_reason: reason,
    p_request_id: context.requestId,
  })

  if (error) throw mapRpcError(error)

  const authSync = await syncAuthBan(context, kind, endsAt)
  return { ok: true, authSync }
}

export async function reactivateUser(
  actorId: string,
  targetId: string,
  reason: string,
): Promise<AdminMutationResult> {
  const context: AuditContext = { actorId, targetId, requestId: newRequestId() }
  const client = serviceRoleClient()

  const { error } = await client.rpc("admin_reactivate_user", {
    p_actor: actorId,
    p_target: targetId,
    p_reason: reason,
    p_request_id: context.requestId,
  })

  if (error) throw mapRpcError(error)

  const authSync = await syncAuthUnban(context)
  return { ok: true, authSync }
}

export async function trashUser(
  actorId: string,
  targetId: string,
  reason: string,
): Promise<AdminMutationResult> {
  const context: AuditContext = { actorId, targetId, requestId: newRequestId() }
  const client = serviceRoleClient()

  const { error } = await client.rpc("admin_trash_user", {
    p_actor: actorId,
    p_target: targetId,
    p_reason: reason,
    p_request_id: context.requestId,
  })

  if (error) throw mapRpcError(error)

  // En papelera la cuenta queda bloqueada de inmediato: se refuerza con baneo
  // indefinido de Auth (mientras exista la retención de 30 días).
  const authSync = await syncAuthBan(context, "indefinite", null)
  return { ok: true, authSync }
}

export async function restoreUser(
  actorId: string,
  targetId: string,
  reason: string,
): Promise<AdminMutationResult> {
  const context: AuditContext = { actorId, targetId, requestId: newRequestId() }
  const client = serviceRoleClient()

  const { error } = await client.rpc("admin_restore_user", {
    p_actor: actorId,
    p_target: targetId,
    p_reason: reason,
    p_request_id: context.requestId,
  })

  if (error) throw mapRpcError(error)

  const authSync = await syncAuthUnban(context)
  return { ok: true, authSync }
}

export async function revokeUserSessions(
  actorId: string,
  targetId: string,
  reason: string,
): Promise<AdminMutationResult> {
  const client = serviceRoleClient()
  const { error } = await client.rpc("admin_revoke_user_sessions", {
    p_actor: actorId,
    p_target: targetId,
    p_reason: reason,
    p_request_id: newRequestId(),
  })

  if (error) throw mapRpcError(error)
  return { ok: true, message: "Sesiones cerradas. El usuario deberá iniciar sesión de nuevo." }
}

export async function purgeUser(
  actorId: string,
  targetId: string,
  confirmEmail: string,
  reason: string,
): Promise<AdminMutationResult> {
  if (!isPermanentDeleteEnabled()) {
    throw new AdminUsersError(
      "purge_disabled",
      RPC_ERROR_MAP.purge_disabled.message,
      403,
    )
  }

  const client = serviceRoleClient()
  const { error } = await client.rpc("admin_purge_user", {
    p_actor: actorId,
    p_target: targetId,
    p_confirm_email: confirmEmail,
    p_reason: reason,
    p_request_id: newRequestId(),
  })

  if (error) throw mapRpcError(error)
  return { ok: true }
}

// ───────────────────────── Flujos oficiales de Auth ─────────────────────────

async function requestOrigin(): Promise<string> {
  const { headers } = await import("next/headers")
  const headersList = await headers()
  const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000"
  const proto = headersList.get("x-forwarded-proto") || "http"
  return `${proto}://${host}`
}

async function targetEmail(targetId: string): Promise<string> {
  const detail = await getAdminUserDetail(targetId)
  if (!detail) {
    throw new AdminUsersError("not_found", RPC_ERROR_MAP.target_not_found.message, 404)
  }
  if (!detail.user.email) {
    throw new AdminUsersError("invalid_request", "La cuenta no tiene correo asociado.", 400)
  }
  return detail.user.email
}

function mapAuthFlowError(error: RpcLikeError | null | undefined, fallback: string): AdminUsersError {
  const message = error?.message ?? ""
  if (/captcha/i.test(message)) {
    return new AdminUsersError(
      "invalid_request",
      "El proveedor de autenticación exige verificación de seguridad para este envío; no es posible iniciarlo desde el panel.",
      409,
    )
  }
  if (/rate limit|too many|over_email_send_rate_limit/i.test(message)) {
    return new AdminUsersError("conflict", "Demasiados envíos recientes. Espera unos minutos e inténtalo de nuevo.", 429)
  }
  return new AdminUsersError("service_unavailable", fallback, 503)
}

export async function resendConfirmationEmail(
  actorId: string,
  targetId: string,
): Promise<AdminMutationResult> {
  const email = await targetEmail(targetId)
  const origin = await requestOrigin()
  const supabase = await createServerSupabase()

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/callback` },
  })

  if (error) throw mapAuthFlowError(error, "No se pudo reenviar el correo de confirmación.")

  await writeAudit({ actorId, targetId, requestId: newRequestId() }, "user.resend_confirmation", {})
  return { ok: true, message: "Correo de confirmación reenviado." }
}

export async function startPasswordRecovery(
  actorId: string,
  targetId: string,
): Promise<AdminMutationResult> {
  const email = await targetEmail(targetId)
  const origin = await requestOrigin()
  const supabase = await createServerSupabase()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/callback?next=/restablecer-password`,
  })

  if (error) throw mapAuthFlowError(error, "No se pudo iniciar la recuperación de contraseña.")

  await writeAudit({ actorId, targetId, requestId: newRequestId() }, "user.password_recovery", {})
  return { ok: true, message: "Se envió el enlace oficial de recuperación de contraseña." }
}

export function isDirection(value: string | null): value is SortDirection {
  return value === "asc" || value === "desc"
}
