import type {
  AdminApiErrorCode,
  AdminAuditPage,
  AdminAuditQuery,
  AdminMutationResult,
  AdminUserDetail,
  AdminUserListQuery,
  AdminUserPage,
} from "@/shared/contracts/admin-users"

export class AdminClientError extends Error {
  readonly code: AdminApiErrorCode | "network_error"
  readonly status: number

  constructor(code: AdminApiErrorCode | "network_error", message: string, status: number) {
    super(message)
    this.name = "AdminClientError"
    this.code = code
    this.status = status
  }
}

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    })
  } catch {
    throw new AdminClientError("network_error", "No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.", 0)
  }

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const body = (payload ?? {}) as { error?: string; code?: string }
    throw new AdminClientError(
      (body.code as AdminApiErrorCode | undefined) ?? "service_unavailable",
      body.error ?? "No se pudo completar la operación.",
      response.status,
    )
  }

  return payload as T
}

export function buildUsersQuery(query: AdminUserListQuery): string {
  const params = new URLSearchParams()
  if (query.search) params.set("search", query.search)
  if (query.status) params.set("status", query.status)
  if (query.role) params.set("role", query.role)
  if (query.registeredFrom) params.set("from", query.registeredFrom)
  if (query.registeredTo) params.set("to", query.registeredTo)
  params.set("sort", query.sort)
  params.set("direction", query.direction)
  params.set("page", String(query.page))
  params.set("pageSize", String(query.pageSize))
  return params.toString()
}

export function fetchAdminUsers(query: AdminUserListQuery, signal?: AbortSignal): Promise<AdminUserPage> {
  return adminFetch<AdminUserPage>(`/api/admin/users?${buildUsersQuery(query)}`, { signal })
}

export function fetchAdminUserDetail(id: string, signal?: AbortSignal): Promise<AdminUserDetail> {
  return adminFetch<AdminUserDetail>(`/api/admin/users/${id}`, { signal })
}

export function buildAuditQuery(query: AdminAuditQuery): string {
  const params = new URLSearchParams()
  if (query.action) params.set("action", query.action)
  if (query.targetId) params.set("target", query.targetId)
  if (query.actorId) params.set("actor", query.actorId)
  if (query.from) params.set("from", query.from)
  if (query.to) params.set("to", query.to)
  params.set("page", String(query.page))
  params.set("pageSize", String(query.pageSize))
  return params.toString()
}

export function fetchAdminAudit(query: AdminAuditQuery, signal?: AbortSignal): Promise<AdminAuditPage> {
  return adminFetch<AdminAuditPage>(`/api/admin/audit-log?${buildAuditQuery(query)}`, { signal })
}

export function postAdminAction(
  id: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<AdminMutationResult> {
  return adminFetch<AdminMutationResult>(`/api/admin/users/${id}/${action}`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  })
}
