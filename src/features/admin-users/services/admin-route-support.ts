import "server-only"
import { NextResponse } from "next/server"
import { z } from "zod"
import {
  AdminUsersError,
  auditRejectedAttempt,
  isDirection,
} from "@/features/admin-users/services/admin-users-service"
import type {
  AccountStatus,
  AdminUserListQuery,
  AdminUserSortField,
  PlatformRole,
  SortDirection,
} from "@/shared/contracts/admin-users"
import { ADMIN_USERS_DEFAULT_PAGE_SIZE } from "@/shared/contracts/admin-users"

export function adminJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  })
}

/** Códigos que representan un intento administrativo rechazado (auditable). */
const REJECTED_CODES = new Set([
  "forbidden",
  "last_admin",
  "self_target_forbidden",
  "blocked_references",
  "email_mismatch",
  "purge_disabled",
])

export interface RejectedAuditContext {
  actorId: string
  targetId: string
  attemptedAction: string
  reason?: string | null
}

export async function handleAdminError(
  error: unknown,
  audit?: RejectedAuditContext,
): Promise<NextResponse> {
  const mapped =
    error instanceof AdminUsersError
      ? error
      : new AdminUsersError("service_unavailable", "No se pudo completar la operación administrativa.", 503)

  if (audit && REJECTED_CODES.has(mapped.code)) {
    await auditRejectedAttempt(
      { actorId: audit.actorId, targetId: audit.targetId },
      audit.attemptedAction,
      mapped,
      audit.reason,
    )
  }

  return adminJson({ error: mapped.message, code: mapped.code }, mapped.status)
}

export async function readJsonBody(request: Request, limitBytes = 16384): Promise<unknown> {
  const text = await request.text()
  if (text.length > limitBytes) {
    throw new AdminUsersError("invalid_request", "Cuerpo de solicitud demasiado grande.", 413)
  }
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new AdminUsersError("invalid_request", "Cuerpo de solicitud inválido.", 400)
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseUuidParam(value: string | undefined): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new AdminUsersError("invalid_request", "Identificador inválido.", 400)
  }
  return value
}

export const roleChangeSchema = z.object({
  role: z.enum(["user", "admin"]),
  reason: z.string().trim().min(3).max(500),
})

export const suspendSchema = z.object({
  kind: z.enum(["temporary", "indefinite"]),
  endsAt: z.string().datetime({ offset: true }).nullish(),
  reason: z.string().trim().min(3).max(500),
})

export const reasonSchema = z.object({
  reason: z.string().trim().min(3).max(500),
})

export const purgeSchema = z.object({
  confirmEmail: z.string().trim().email().max(320),
  reason: z.string().trim().min(3).max(500),
})

export const unionRoleSchema = z.object({
  delegationId: z.string().uuid(),
  role: z.enum(["union_rep", "union_admin"]),
  active: z.boolean(),
  reason: z.string().trim().min(3).max(500),
})

const SORT_FIELDS: readonly AdminUserSortField[] = [
  "created_at",
  "last_sign_in_at",
  "email",
  "full_name",
]

const ACCOUNT_STATUSES: readonly AccountStatus[] = ["active", "suspended", "trashed"]
const PLATFORM_ROLES: readonly PlatformRole[] = ["user", "admin"]
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parsePage(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

function optionalDate(value: string | null): string | undefined {
  return value && DATE_PATTERN.test(value) ? value : undefined
}

export function parseUserListQuery(searchParams: URLSearchParams): AdminUserListQuery {
  const status = searchParams.get("status")
  const role = searchParams.get("role")
  const sort = searchParams.get("sort")
  const direction = searchParams.get("direction")

  return {
    search: searchParams.get("search")?.slice(0, 200) || undefined,
    status: status && ACCOUNT_STATUSES.includes(status as AccountStatus) ? (status as AccountStatus) : undefined,
    role: role && PLATFORM_ROLES.includes(role as PlatformRole) ? (role as PlatformRole) : undefined,
    registeredFrom: optionalDate(searchParams.get("from")),
    registeredTo: optionalDate(searchParams.get("to")),
    sort: sort && SORT_FIELDS.includes(sort as AdminUserSortField) ? (sort as AdminUserSortField) : "created_at",
    direction: isDirection(direction) ? direction : ("desc" as SortDirection),
    page: parsePage(searchParams.get("page"), 1, 10_000),
    pageSize: parsePage(searchParams.get("pageSize"), ADMIN_USERS_DEFAULT_PAGE_SIZE, 100),
  }
}
