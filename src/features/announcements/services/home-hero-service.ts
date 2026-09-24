import type { Announcement } from "@/shared/contracts/announcements"
import { requiresNormativaReview } from "./mobile-bar-service"
import { isExcludedByQuickActions } from "@/features/dashboard/lib/highlight-exclusion-policy"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

/**
 * Comprueba si un anuncio publicado está habilitado y vigente para el carrusel de Inicio.
 */
export function isAnnouncementEligibleForHero(
  item: Announcement,
  now: Date = new Date(),
): boolean {
  if (!item.show_in_home_hero) return false
  if (item.status !== "PUBLISHED") return false

  const title = (item.title || "").trim()
  if (!title) return false

  // Validar ventana temporal
  if (item.publish_at && now < new Date(item.publish_at)) return false
  if (item.expires_at && now > new Date(item.expires_at)) return false

  // Bloquear si requiere revisión editorial normativa pendiente
  if (requiresNormativaReview(item)) return false

  // Bloquear si duplica alguna de las 6 funciones de HomeQuickActions por ID, título o destination_path
  if (
    isExcludedByQuickActions({
      id: item.id,
      title: item.title,
      href: item.destination_path ?? undefined,
    })
  ) {
    return false
  }

  return true
}

/**
 * Consulta los avisos y comunicados activos configurados para el hero de Inicio.
 * Si la base de datos no está disponible o falla la red, devuelve [] de forma segura.
 */
export async function fetchPublishedHeroAnnouncements(
  customClient?: ReturnType<typeof createSupabaseClient<Database>>,
): Promise<Announcement[]> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return []
    }

    const client =
      customClient ??
      createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

    const nowIso = new Date().toISOString()

    const { data, error } = await client
      .from("announcements")
      .select("*")
      .eq("show_in_home_hero", true)
      .eq("status", "PUBLISHED")
      .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("publish_at", { ascending: false, nullsFirst: false })
      .limit(5)

    if (error || !data) {
      return []
    }

    return (data as unknown as Announcement[]).filter((a) =>
      isAnnouncementEligibleForHero(a),
    )
  } catch {
    return []
  }
}
