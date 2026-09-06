import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

export interface AdminCapabilities {
  /** True si el usuario tiene rol 'admin' formal en la tabla profiles */
  isAdmin: boolean
  /** Acceso al shell /admin (true para role admin o para operador de push histórico) */
  canAccessAdminPanel: boolean
  /** Capacidad de crear, editar, publicar y archivar avisos */
  canManageAnnouncements: boolean
  /** Capacidad de programar y ejecutar campañas masivas o de prueba */
  canManageCampaigns: boolean
  /** Acceso exclusivo al formulario heredado /admin/push */
  canAccessLegacyPush: boolean
  /** Acceso a la consola de versiones de Android /admin/android */
  canAccessAndroidAdmin: boolean
  /** Acceso al panel de vacaciones /vacaciones/admin */
  canAccessVacationsAdmin: boolean
}

/**
 * Función pura para evaluar capacidades según matriz canónica (Sección 5).
 * - Usuario normal: todo false.
 * - Perfil admin: acceso completo (salvo legacy push que exige adicionalmente email si aplica su formulario).
 * - Correo en PUSH_ADMIN_ALLOWED_EMAILS (sin perfil admin): canAccessAdminPanel (solo para atravesar a /admin/push)
 *   y canAccessLegacyPush, pero NADA de avisos, campañas, vacaciones ni android.
 */
export function evaluateAdminCapabilities(params: {
  role?: string | null
  email?: string | null
  legacyAllowedEmails?: string | null
}): AdminCapabilities {
  const isAdmin = params.role === "admin"
  const email = params.email?.trim().toLowerCase() ?? ""
  
  const rawList = params.legacyAllowedEmails !== undefined
    ? (params.legacyAllowedEmails ?? "")
    : (process.env.PUSH_ADMIN_ALLOWED_EMAILS ?? "")
    
  const allowedList = rawList
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const isLegacyPushAllowed = email.length > 0 && allowedList.includes(email)

  return {
    isAdmin,
    // Puede ingresar a /admin si es admin o si necesita llegar a /admin/push
    canAccessAdminPanel: isAdmin || isLegacyPushAllowed,
    canManageAnnouncements: isAdmin,
    canManageCampaigns: isAdmin,
    canAccessLegacyPush: isLegacyPushAllowed,
    canAccessAndroidAdmin: isAdmin,
    canAccessVacationsAdmin: isAdmin,
  }
}

/**
 * Obtiene capacidades evaluadas en servidor para la sesión actual.
 */
export async function getAdminCapabilities(): Promise<{
  user: User | null
  role: string | null
  capabilities: AdminCapabilities
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      role: null,
      capabilities: evaluateAdminCapabilities({ role: null, email: null }),
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role ?? null
  const capabilities = evaluateAdminCapabilities({
    role,
    email: user.email,
  })

  return { user, role, capabilities }
}
