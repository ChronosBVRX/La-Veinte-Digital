import type {
  AccountStatus,
  AdminUserDiagnostics,
  AdminUserStatusDetails,
  PlatformRole,
  SuspensionKind,
} from "@/shared/contracts/admin-users"

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Activo",
  suspended: "Suspendido",
  trashed: "En papelera",
}

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  user: "Usuario",
  admin: "Administrador",
}

export const SUSPENSION_KIND_LABELS: Record<SuspensionKind, string> = {
  temporary: "Temporal",
  indefinite: "Indefinida",
}

export const DIAGNOSTIC_LABELS: Record<string, string> = {
  OK: "OK",
  ERROR: "ERROR",
  INCOMPLETO: "INCOMPLETO",
  DISPONIBLE: "DISPONIBLE",
  NO_DISPONIBLE: "NO DISPONIBLE",
}

export const ADMIN_ACTION_LABELS: Record<string, string> = {
  "user.role_change": "Cambio de rol",
  "user.suspend": "Suspensión",
  "user.reactivate": "Reactivación",
  "user.trash": "Envío a papelera",
  "user.restore": "Restauración",
  "user.purge": "Eliminación definitiva",
  "user.sessions_revoked": "Cierre de sesiones",
  "user.resend_confirmation": "Reenvío de confirmación",
  "user.password_recovery": "Recuperación de contraseña",
  "user.action_rejected": "Intento rechazado",
  "user.auth_sync_failed": "Aviso de sincronización con Auth",
}

const TOOL_LABELS: Record<string, string> = {
  "/api/consulta": "Asistente IA",
  "/api/escritos/generar": "Generador de escritos",
  "/api/tarjeton/confirm": "Importación de tarjetón",
  "/api/calculator-prefill": "Calculadoras",
  "/api/worker-context": "Perfil laboral",
  "/api/push/register": "Notificaciones",
  "/api/normativa/search": "Biblioteca normativa",
  "/api/calendario": "Calendario",
}

export function toolLabel(route: string | undefined): string {
  if (!route) return "Herramienta"
  return TOOL_LABELS[route] ?? "Herramienta"
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
}

export function statusColor(status: AccountStatus): { bg: string; fg: string } {
  switch (status) {
    case "active":
      return { bg: "rgba(5,150,105,0.12)", fg: "#047857" }
    case "suspended":
      return { bg: "rgba(217,119,6,0.14)", fg: "#b45309" }
    case "trashed":
      return { bg: "rgba(220,38,38,0.12)", fg: "#b91c1c" }
  }
}

export function diagnosticsSummary(diagnostics: AdminUserDiagnostics): { label: string; value: string; ok: boolean }[] {
  return [
    {
      label: "Autenticación",
      value: DIAGNOSTIC_LABELS[diagnostics.authentication] ?? diagnostics.authentication,
      ok: diagnostics.authentication === "OK",
    },
    {
      label: "Perfil",
      value: DIAGNOSTIC_LABELS[diagnostics.profile] ?? diagnostics.profile,
      ok: diagnostics.profile === "OK",
    },
    {
      label: "Tarjetón",
      value: DIAGNOSTIC_LABELS[diagnostics.payslip] ?? diagnostics.payslip,
      ok: diagnostics.payslip === "DISPONIBLE",
    },
    {
      label: "Documentos",
      value: DIAGNOSTIC_LABELS[diagnostics.documents] ?? diagnostics.documents,
      ok: diagnostics.documents === "DISPONIBLE",
    },
    {
      label: "Almacenamiento",
      value: DIAGNOSTIC_LABELS[diagnostics.storage] ?? diagnostics.storage,
      ok: diagnostics.storage === "OK",
    },
  ]
}

export function suspensionSummary(status: AdminUserStatusDetails): string | null {
  if (status.rawStatus !== "suspended") return null
  if (status.suspensionKind === "indefinite") return "Suspensión indefinida"
  const until = formatDateTime(status.suspensionEndsAt)
  return status.suspensionExpired
    ? `Suspensión temporal vencida el ${until}`
    : `Suspensión temporal hasta ${until}`
}

export function providerLabel(provider: string): string {
  switch (provider) {
    case "email":
      return "Correo y contraseña"
    case "google":
      return "Google"
    case "facebook":
      return "Facebook"
    default:
      return provider
  }
}
