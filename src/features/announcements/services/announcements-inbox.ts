import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { Announcement } from "@/shared/contracts/announcements"

export interface WorkerAnnouncementItem extends Announcement {
  is_read: boolean
  is_expired: boolean
}

export interface WorkerInboxResult {
  items: WorkerAnnouncementItem[]
  unreadCount: number
}

/**
 * Obtiene la bandeja de avisos publicados para el trabajador autenticado.
 */
export async function getWorkerInbox(userId: string): Promise<WorkerInboxResult> {
  const supabase = await createClient()

  // 1. Obtener avisos publicados visibles en bandeja
  const nowIso = new Date().toISOString()
  const { data: announcements, error: annErr } = await supabase
    .from("announcements")
    .select("*")
    .eq("status", "PUBLISHED")
    .eq("show_in_inbox", true)
    .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
    .order("publish_at", { ascending: false, nullsFirst: false })

  if (annErr || !announcements) {
    console.error("[announcements-inbox] Error fetching announcements:", annErr)
    return { items: [], unreadCount: 0 }
  }

  // 2. Obtener lecturas del usuario
  const { data: reads, error: readsErr } = await supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", userId)

  if (readsErr) {
    console.error("[announcements-inbox] Error fetching reads:", readsErr)
  }

  const readSet = new Set((reads ?? []).map((r) => r.announcement_id))
  const now = Date.now()

  let unreadCount = 0
  const items: WorkerAnnouncementItem[] = announcements.map((row) => {
    const is_read = readSet.has(row.id)
    const is_expired = row.expires_at ? new Date(row.expires_at).getTime() < now : false

    if (!is_read && !is_expired) {
      unreadCount++
    }

    return {
      ...(row as unknown as Announcement),
      is_read,
      is_expired,
    }
  })

  return { items, unreadCount }
}

/**
 * Marca un aviso como leído de forma idempotente.
 */
export async function markAnnouncementAsRead(
  announcementId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("announcement_reads")
    .upsert(
      {
        announcement_id: announcementId,
        user_id: userId,
        read_at: new Date().toISOString(),
      },
      { onConflict: "announcement_id,user_id" }
    )

  if (error) {
    console.error("[announcements-inbox] Error marking read:", error)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

/**
 * Obtiene las preferencias de notificación editorial del trabajador.
 * Si no existen, por omisión están activas (true).
 */
export async function getWorkerNotificationPreferences(
  userId: string
): Promise<{ announcements_push_enabled: boolean }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("announcements_push_enabled")
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    return { announcements_push_enabled: true }
  }

  return { announcements_push_enabled: data.announcements_push_enabled }
}

/**
 * Guarda las preferencias de notificación editorial del trabajador.
 */
export async function setWorkerNotificationPreferences(
  userId: string,
  enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        announcements_push_enabled: enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
