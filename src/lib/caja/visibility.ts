import "server-only"
import { createClient } from "@/lib/supabase/server"

interface CajaFeatureFlagDetails {
  public_enabled?: boolean
  updated_at?: string
}

/**
 * Consulta si la Caja de Ahorro está habilitada para el público general.
 * Consulta la última entrada administrativa en `admin_audit_log`.
 * Fallback a variable de entorno `CAJA_PUBLIC_ENABLED="true"` o `false`.
 */
export async function isCajaPubliclyEnabled(): Promise<boolean> {
  // 1. Fallback de variable de entorno
  if (process.env.CAJA_PUBLIC_ENABLED === "true") {
    return true
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("admin_audit_log")
      .select("details, created_at")
      .eq("entity_type", "caja_feature_flag")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data || !data.details) {
      return false
    }

    const details = data.details as CajaFeatureFlagDetails
    return Boolean(details.public_enabled)
  } catch {
    return false
  }
}

/**
 * Actualiza la visibilidad de la Caja de Ahorro para el público general.
 * Registra una acción administrativa auditable en `admin_audit_log`.
 */
export async function setCajaPubliclyEnabled(enabled: boolean, actorId: string): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action: enabled ? "enable_public_caja" : "disable_public_caja",
    entity_type: "caja_feature_flag",
    entity_id: "caja_sntss_module",
    details: {
      public_enabled: enabled,
      updated_at: new Date().toISOString(),
    },
  })

  if (error) {
    throw new Error(`Error al actualizar visibilidad de Caja: ${error.message}`)
  }

  return enabled
}
