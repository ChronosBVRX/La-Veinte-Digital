import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { Announcement, AnnouncementStatus } from "@/shared/contracts/announcements"
import { validateAnnouncementInput } from "./announcements-validate"

export interface ServiceResult<T> {
  ok: boolean
  data?: T
  error?: string
  conflict?: boolean
}

/**
 * Registra una acción administrativa en public.admin_audit_log
 */
export async function logAdminAudit(params: {
  actorId: string | null
  action: string
  entityType: string
  entityId?: string | null
  details?: import("@/lib/supabase/types").Json
}) {
  try {
    const supabase = await createClient()
    await supabase.from("admin_audit_log").insert({
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      details: params.details ?? null,
    })
  } catch (err) {
    console.error("[admin_audit_log] Error writing log:", err)
  }
}

/**
 * Crea un borrador de aviso.
 */
export async function createAnnouncementDraft(
  input: unknown,
  creatorId: string
): Promise<ServiceResult<Announcement>> {
  const validated = validateAnnouncementInput(input)
  if (!validated.ok || !validated.value) {
    return { ok: false, error: validated.errors?.join(". ") }
  }

  const v = validated.value
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      kind: v.kind,
      title: v.title,
      push_summary: v.push_summary ?? null,
      body: v.body,
      bar_text: v.bar_text ?? null,
      destination_path: v.destination_path ?? null,
      status: "DRAFT",
      show_in_inbox: v.show_in_inbox,
      show_in_bar: v.show_in_bar,
      publish_at: v.publish_at ?? null,
      expires_at: v.expires_at ?? null,
      source_document: v.source_document ?? null,
      source_reference: v.source_reference ?? null,
      source_version: v.source_version ?? null,
      source_page: v.source_page ?? null,
      created_by: creatorId,
      updated_by: creatorId,
      revision: 1,
    })
    .select()
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Error al crear el borrador" }
  }

  await logAdminAudit({
    actorId: creatorId,
    action: "announcement.create_draft",
    entityType: "announcement",
    entityId: data.id,
    details: { title: data.title, kind: data.kind },
  })

  return { ok: true, data: data as unknown as Announcement }
}

/**
 * Actualiza un borrador existente utilizando control de concurrencia optimista (revision).
 */
export async function updateAnnouncementDraft(
  id: string,
  expectedRevision: number,
  input: unknown,
  updaterId: string
): Promise<ServiceResult<Announcement>> {
  const validated = validateAnnouncementInput(input)
  if (!validated.ok || !validated.value) {
    return { ok: false, error: validated.errors?.join(". ") }
  }

  const v = validated.value
  const supabase = await createClient()

  // 1. Verificar revisión actual y estado
  const { data: current, error: fetchErr } = await supabase
    .from("announcements")
    .select("revision, status")
    .eq("id", id)
    .single()

  if (fetchErr || !current) {
    return { ok: false, error: "Aviso no encontrado" }
  }

  if (current.status !== "DRAFT") {
    return { ok: false, error: "Solo se pueden editar avisos en estado borrador (DRAFT). Para modificar un publicado, duplícalo como nuevo borrador." }
  }

  if (current.revision !== expectedRevision) {
    return {
      ok: false,
      conflict: true,
      error: `Conflicto de edición: el aviso fue modificado por otro usuario (revisión actual: ${current.revision}, esperada: ${expectedRevision}).`,
    }
  }

  const nextRevision = current.revision + 1

  const { data, error } = await supabase
    .from("announcements")
    .update({
      kind: v.kind,
      title: v.title,
      push_summary: v.push_summary ?? null,
      body: v.body,
      bar_text: v.bar_text ?? null,
      destination_path: v.destination_path ?? null,
      show_in_inbox: v.show_in_inbox,
      show_in_bar: v.show_in_bar,
      publish_at: v.publish_at ?? null,
      expires_at: v.expires_at ?? null,
      source_document: v.source_document ?? null,
      source_reference: v.source_reference ?? null,
      source_version: v.source_version ?? null,
      source_page: v.source_page ?? null,
      revision: nextRevision,
      updated_by: updaterId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("revision", expectedRevision)
    .select()
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Error al actualizar borrador" }
  }

  await logAdminAudit({
    actorId: updaterId,
    action: "announcement.update_draft",
    entityType: "announcement",
    entityId: id,
    details: { revision: nextRevision },
  })

  return { ok: true, data: data as unknown as Announcement }
}

/**
 * Publica un aviso (inmediato a PUBLISHED, o programado a SCHEDULED si publish_at > now()).
 */
export async function publishAnnouncement(
  id: string,
  expectedRevision: number,
  updaterId: string,
  options?: { publish_at?: string | null; expires_at?: string | null }
): Promise<ServiceResult<Announcement>> {
  const supabase = await createClient()

  const { data: current, error: fetchErr } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchErr || !current) {
    return { ok: false, error: "Aviso no encontrado" }
  }

  if (current.revision !== expectedRevision) {
    return {
      ok: false,
      conflict: true,
      error: `Conflicto de versión al publicar (revisión actual: ${current.revision}, esperada: ${expectedRevision}).`,
    }
  }

  const publishAtStr = options?.publish_at ?? current.publish_at
  const expiresAtStr = options?.expires_at ?? current.expires_at

  const now = Date.now()
  let targetStatus: AnnouncementStatus = "PUBLISHED"
  let publishAtIso: string = new Date(now).toISOString()

  if (publishAtStr) {
    const pubTime = new Date(publishAtStr).getTime()
    if (!isNaN(pubTime)) {
      publishAtIso = new Date(pubTime).toISOString()
      if (pubTime > now) {
        targetStatus = "SCHEDULED"
      }
    }
  }

  const nextRevision = current.revision + 1

  const { data, error } = await supabase
    .from("announcements")
    .update({
      status: targetStatus,
      publish_at: publishAtIso,
      expires_at: expiresAtStr ?? null,
      revision: nextRevision,
      updated_by: updaterId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("revision", expectedRevision)
    .select()
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Error al publicar aviso" }
  }

  await logAdminAudit({
    actorId: updaterId,
    action: targetStatus === "SCHEDULED" ? "announcement.schedule" : "announcement.publish",
    entityType: "announcement",
    entityId: id,
    details: { status: targetStatus, publish_at: publishAtIso },
  })

  return { ok: true, data: data as unknown as Announcement }
}

/**
 * Archiva un aviso y cancela transaccionalmente entregas pendientes mediante RPC.
 */
export async function archiveAnnouncement(
  id: string,
  updaterId: string
): Promise<ServiceResult<void>> {
  const supabase = await createClient()

  // Intentar llamar a la RPC atómica
  const { error: rpcErr } = await supabase.rpc("archive_announcement_atomic", {
    p_announcement_id: id,
  })

  if (rpcErr) {
    // Fallback directo por si la RPC no estuviese desplegada en base remota de pruebas
    const { error: updateErr } = await supabase
      .from("announcements")
      .update({
        status: "ARCHIVED",
        updated_by: updaterId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (updateErr) {
      return { ok: false, error: updateErr.message }
    }

    // Cancelar campañas asociadas encoladas, en proceso o pausadas
    const { data: activeCampaigns } = await supabase
      .from("push_campaigns")
      .update({
        status: "CANCELLED",
        updated_at: new Date().toISOString(),
      })
      .eq("announcement_id", id)
      .in("status", ["QUEUED", "PROCESSING", "PAUSED"])
      .select("id")

    if (activeCampaigns && activeCampaigns.length > 0) {
      const campIds = activeCampaigns.map((c) => c.id)
      await supabase
        .from("push_campaign_deliveries")
        .update({
          status: "SKIPPED",
          error_code: "ANNOUNCEMENT_ARCHIVED",
          lease_until: null,
          claim_token: null,
          updated_at: new Date().toISOString(),
        })
        .in("campaign_id", campIds)
        .in("status", ["PENDING", "RETRY_PENDING", "PROCESSING"])
    }
  }

  await logAdminAudit({
    actorId: updaterId,
    action: "announcement.archive",
    entityType: "announcement",
    entityId: id,
  })

  return { ok: true }
}

/**
 * Duplica un aviso existente como nuevo borrador (DRAFT).
 */
export async function duplicateAnnouncementAsDraft(
  sourceId: string,
  creatorId: string
): Promise<ServiceResult<Announcement>> {
  const supabase = await createClient()

  const { data: source, error: fetchErr } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", sourceId)
    .single()

  if (fetchErr || !source) {
    return { ok: false, error: "Aviso original no encontrado" }
  }

  const newTitle = `Copia de ${source.title}`.slice(0, 100)

  return createAnnouncementDraft(
    {
      kind: source.kind,
      title: newTitle,
      push_summary: source.push_summary,
      body: source.body,
      bar_text: source.bar_text,
      destination_path: source.destination_path,
      show_in_inbox: source.show_in_inbox,
      show_in_bar: source.show_in_bar,
      source_document: source.source_document,
      source_reference: source.source_reference,
      source_version: source.source_version,
      source_page: source.source_page,
    },
    creatorId
  )
}

/**
 * Obtiene un aviso por ID.
 */
export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) return null
  return data as unknown as Announcement
}

/**
 * Lista avisos con filtros opcionales para la consola de administración.
 */
export async function listAdminAnnouncements(params?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<{ items: Announcement[]; total: number }> {
  const supabase = await createClient()
  let query = supabase
    .from("announcements")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })

  if (params?.status && params.status !== "ALL") {
    query = query.eq("status", params.status)
  }

  const limit = params?.limit ?? 50
  const offset = params?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query
  if (error || !data) {
    return { items: [], total: 0 }
  }

  return {
    items: data as unknown as Announcement[],
    total: count ?? data.length,
  }
}
