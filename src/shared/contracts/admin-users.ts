/**
 * Contratos del Centro de Administración de Usuarios.
 *
 * Tipos puros compartidos entre servidor y cliente: sin imports de
 * infraestructura. Reflejan el contrato de las RPC de la migración
 * 20260919040000_admin_user_control_center.sql y de las APIs /api/admin/*.
 */

export type PlatformRole = "user" | "admin"

export type AccountStatus = "active" | "suspended" | "trashed"

export type SuspensionKind = "temporary" | "indefinite"

/** Roles sindicales (Representación). Ortogonales al rol de plataforma. */
export type UnionRoleName = "union_rep" | "union_admin"

export type AdminUserSortField = "created_at" | "last_sign_in_at" | "email" | "full_name"

export type SortDirection = "asc" | "desc"

export type AuthenticationDiagnostic = "OK" | "ERROR"
export type ProfileDiagnostic = "OK" | "INCOMPLETO"
export type AvailabilityDiagnostic = "DISPONIBLE" | "NO_DISPONIBLE"
export type DocumentsDiagnostic = AvailabilityDiagnostic | "ERROR"
export type StorageDiagnostic = "OK" | "ERROR"

/** Tamaños de página permitidos (el servidor acota a 1..100). */
export const ADMIN_USERS_PAGE_SIZES = [10, 25, 50] as const
export const ADMIN_USERS_DEFAULT_PAGE_SIZE = 25

/** Consulta inicial del listado administrativo de usuarios. */
export const DEFAULT_ADMIN_USERS_QUERY: AdminUserListQuery = {
  search: undefined,
  status: undefined,
  role: undefined,
  registeredFrom: undefined,
  registeredTo: undefined,
  sort: "created_at",
  direction: "desc",
  page: 1,
  pageSize: ADMIN_USERS_DEFAULT_PAGE_SIZE,
}

/** Días de retención antes de la eliminación definitiva. */
export const ADMIN_TRASH_RETENTION_DAYS = 30

/** Acciones auditables por el Centro de Administración de Usuarios. */
export const ADMIN_AUDIT_ACTIONS = [
  "user.role_change",
  "user.suspend",
  "user.reactivate",
  "user.trash",
  "user.restore",
  "user.purge",
  "user.sessions_revoked",
  "user.resend_confirmation",
  "user.password_recovery",
  "user.union_role_change",
  "user.action_rejected",
  "user.auth_sync_failed",
] as const

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number]

export interface AdminUserListQuery {
  search?: string
  status?: AccountStatus
  role?: PlatformRole
  registeredFrom?: string
  registeredTo?: string
  sort: AdminUserSortField
  direction: SortDirection
  page: number
  pageSize: number
}

export interface AdminUserSummary {
  id: string
  email: string | null
  fullName: string | null
  matricula: string | null
  role: PlatformRole
  accountStatus: AccountStatus
  suspensionKind: SuspensionKind | null
  suspensionEndsAt: string | null
  emailConfirmed: boolean
  registeredAt: string
  lastSignInAt: string | null
  providers: string[]
  profileComplete: boolean
}

export interface AdminUserPage {
  users: AdminUserSummary[]
  total: number
  page: number
  pageSize: number
}

export interface AdminUserStatusDetails {
  accountStatus: AccountStatus
  rawStatus: AccountStatus
  suspensionKind: SuspensionKind | null
  suspensionEndsAt: string | null
  suspensionExpired: boolean
  reason: string | null
  changedAt: string | null
  changedBy: string | null
  trashedAt: string | null
  purgeAfter: string | null
  sessionsRevokedAt: string | null
  authSyncAt: string | null
  authSyncError: string | null
}

export interface AdminUserDiagnostics {
  authentication: AuthenticationDiagnostic
  profile: ProfileDiagnostic
  payslip: AvailabilityDiagnostic
  documents: DocumentsDiagnostic
  storage: StorageDiagnostic
  lastSyncAt: string | null
}

export interface AdminUserActivityEvent {
  kind: "login" | "payslip_import" | "tool_usage" | "admin_action"
  at: string
  route?: string
  count?: number
  action?: string
  reason?: string | null
}

/** Membresía sindical del usuario (Representación). */
export interface AdminUnionMembership {
  id: string
  delegationId: string
  delegationCode: string
  delegationName: string
  role: UnionRoleName
  active: boolean
  createdAt: string | null
  updatedAt: string | null
}

/** Delegación sindical activa disponible para asignar. */
export interface AdminUnionDelegation {
  id: string
  code: string
  name: string
  active: boolean
}

export interface AdminUserDetail {
  user: {
    id: string
    email: string | null
    fullName: string | null
    matricula: string | null
    adscripcion: string | null
    categoria: string | null
    role: PlatformRole
    registeredAt: string | null
    profileCreatedAt: string | null
    lastSignInAt: string | null
    emailConfirmedAt: string | null
    providers: string[]
  }
  status: AdminUserStatusDetails
  /** Información sindical: membresías del usuario y delegaciones activas. */
  union: {
    memberships: AdminUnionMembership[]
    delegations: AdminUnionDelegation[]
  }
  counts: {
    payslips: number
    remoteDocuments: number
    hasPayrollContext: boolean
  }
  diagnostics: AdminUserDiagnostics
  flags: {
    isSelf: boolean
    canReactivate: boolean
    canRestore: boolean
  }
  activity: AdminUserActivityEvent[]
  /** La API expone si la purga física está habilitada en el servidor. */
  permanentDeleteEnabled: boolean
}

export interface AdminUserMetrics {
  totalUsers: number
  activeUsers: number
  recentRegistrations: number
  pendingEmailConfirmation: number
  suspendedAccounts: number
  trashedAccounts: number
  incompleteProfiles: number
  usersWithPayslip: number
}

export interface AdminAuditEntry {
  id: string
  action: string
  entityId: string | null
  targetEmail: string | null
  targetName: string | null
  actorId: string | null
  actorEmail: string | null
  actorName: string | null
  reason: string | null
  previousValue: string | null
  newValue: string | null
  requestId: string | null
  createdAt: string
}

export interface AdminAuditPage {
  entries: AdminAuditEntry[]
  total: number
  page: number
  pageSize: number
}

export interface AdminAuditQuery {
  action?: string
  targetId?: string
  actorId?: string
  from?: string
  to?: string
  page: number
  pageSize: number
}

export interface AdminRoleChangePayload {
  role: PlatformRole
  reason: string
}

export interface AdminSuspendPayload {
  kind: SuspensionKind
  endsAt?: string | null
  reason: string
}

export interface AdminReasonPayload {
  reason: string
}

export interface AdminPurgePayload {
  confirmEmail: string
  reason: string
}

export type AdminAuthSyncState = "ok" | "failed"

export interface AdminMutationResult {
  ok: true
  authSync?: AdminAuthSyncState
  message?: string
}

/** Códigos estables devueltos por las APIs administrativas. */
export type AdminApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_request"
  | "not_found"
  | "conflict"
  | "last_admin"
  | "self_target_forbidden"
  | "role_unchanged"
  | "not_suspended"
  | "not_trashed"
  | "already_trashed"
  | "email_mismatch"
  | "blocked_references"
  | "purge_disabled"
  | "admin_backend_unavailable"
  | "service_unavailable"

export interface AdminApiErrorBody {
  error: string
  code: AdminApiErrorCode
}
