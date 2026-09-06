import type { Announcement } from "@/shared/contracts/announcements"
import type { MobileValueItem } from "@/shared/components/app/mobileValueItems"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

/**
 * Determina si un aviso/tip hace referencia a fuentes normativas
 * (CCT, LFT, LSS, estatutos o reglamentos).
 */
export function isNormativeAnnouncement(
  item: Pick<Announcement, "source_document" | "source_reference">,
): boolean {
  return Boolean(
    (item.source_document && item.source_document.trim().length > 0) ||
    (item.source_reference && item.source_reference.trim().length > 0),
  )
}

/**
 * Regla de gobernanza normativa:
 * Un tip/aviso con contenido normativo REQUIERE revisión editorial formal
 * antes de poder difundirse en la barra móvil (`reviewed_at` no nulo).
 */
export function requiresNormativaReview(
  item: Pick<Announcement, "source_document" | "source_reference" | "reviewed_at">,
): boolean {
  if (!isNormativeAnnouncement(item)) {
    return false
  }
  return !item.reviewed_at
}

/**
 * Verifica si un aviso está activo y habilitado para mostrarse en la barra móvil.
 */
export function isAnnouncementEligibleForBar(
  item: Announcement,
  now: Date = new Date(),
): boolean {
  if (!item.show_in_bar) return false
  if (item.status !== "PUBLISHED") return false

  const text = (item.bar_text || item.title || "").trim()
  if (!text) return false

  // Validar ventana temporal
  if (item.publish_at && now < new Date(item.publish_at)) return false
  if (item.expires_at && now > new Date(item.expires_at)) return false

  // Bloquear si requiere revisión editorial pendiente
  if (requiresNormativaReview(item)) return false

  return true
}

/**
 * Convierte un anuncio publicado y verificado en un item para la barra móvil.
 */
export function announcementToMobileValueItem(item: Announcement): MobileValueItem {
  const type = item.kind === "tool" ? "tool" : (item.kind === "tip" ? "tip" : "announcement")
  const eyebrow = item.kind === "tool" ? "Herramienta" : (item.kind === "tip" ? "Consejo" : "Aviso")
  const text = (item.bar_text || item.title).trim()
  const href = item.destination_path || `/avisos/${item.id}`

  const source =
    item.source_document && item.source_reference
      ? { document: item.source_document, reference: item.source_reference }
      : undefined

  return {
    id: item.id,
    type,
    eyebrow,
    text,
    href,
    ctaLabel: "Ver",
    source,
    startsAt: item.publish_at ?? undefined,
    endsAt: item.expires_at ?? undefined,
    enabled: true,
  }
}

/**
 * Combina los items dinámicos del servidor con el catálogo local de fallback.
 * Evita duplicados por id y coloca los dinámicos al inicio.
 */
export function mergeMobileBarItems(
  localItems: MobileValueItem[],
  remoteItems: MobileValueItem[],
): MobileValueItem[] {
  if (!remoteItems || remoteItems.length === 0) return localItems
  const seenIds = new Set(remoteItems.map((r) => r.id))
  const filteredLocal = localItems.filter((l) => !seenIds.has(l.id))
  return [...remoteItems, ...filteredLocal]
}

/**
 * Obtiene los items de la barra desde la base de datos de forma segura.
 * Si no hay conexión o falla la consulta, retorna un arreglo vacío (para que aplique el fallback local).
 */
export async function fetchPublishedBarItems(
  customClient?: ReturnType<typeof createSupabaseClient<Database>>,
): Promise<MobileValueItem[]> {
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
      .eq("show_in_bar", true)
      .eq("status", "PUBLISHED")
      .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("publish_at", { ascending: false, nullsFirst: false })
      .limit(10)

    if (error || !data) {
      return []
    }

    const eligible = (data as Announcement[]).filter((a) => isAnnouncementEligibleForBar(a))
    return eligible.map(announcementToMobileValueItem)
  } catch {
    return []
  }
}
