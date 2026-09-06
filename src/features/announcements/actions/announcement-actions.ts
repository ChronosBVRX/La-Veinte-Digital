"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import {
  createAnnouncementDraft,
  updateAnnouncementDraft,
  publishAnnouncement,
  archiveAnnouncement,
  duplicateAnnouncementAsDraft,
} from "../services/announcements-service"
import {
  markAnnouncementAsRead,
  setWorkerNotificationPreferences,
} from "../services/announcements-inbox"

export interface ActionResponse {
  ok: boolean
  error?: string
  conflict?: boolean
  announcementId?: string
}

/**
 * Server Action: Guardar borrador nuevo o actualizar existente.
 */
export async function saveAnnouncementAction(
  _prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse> {
  const { user, capabilities } = await getAdminCapabilities()
  if (!user || !capabilities.canManageAnnouncements) {
    return { ok: false, error: "No tienes permisos para administrar avisos." }
  }

  const id = formData.get("id") ? String(formData.get("id")) : null
  const revisionStr = formData.get("revision")
  const expectedRevision = revisionStr ? Number(revisionStr) : 1

  const title = String(formData.get("title") ?? "").trim()
  const body = String(formData.get("body") ?? "").trim()
  const kind = String(formData.get("kind") ?? "announcement")
  const push_summary = formData.get("push_summary") ? String(formData.get("push_summary")).trim() : null
  const bar_text = formData.get("bar_text") ? String(formData.get("bar_text")).trim() : null
  const destination_path = formData.get("destination_path") ? String(formData.get("destination_path")).trim() : null
  const show_in_inbox = formData.get("show_in_inbox") === "on" || formData.get("show_in_inbox") === "true"
  const show_in_bar = formData.get("show_in_bar") === "on" || formData.get("show_in_bar") === "true"
  const publish_at = formData.get("publish_at") ? String(formData.get("publish_at")) : null
  const expires_at = formData.get("expires_at") ? String(formData.get("expires_at")) : null

  const input = {
    title,
    body,
    kind,
    push_summary,
    bar_text,
    destination_path,
    show_in_inbox,
    show_in_bar,
    publish_at,
    expires_at,
    source_document: formData.get("source_document") ? String(formData.get("source_document")) : null,
    source_reference: formData.get("source_reference") ? String(formData.get("source_reference")) : null,
    source_version: formData.get("source_version") ? String(formData.get("source_version")) : null,
    source_page: formData.get("source_page") ? String(formData.get("source_page")) : null,
  }

  if (id) {
    const res = await updateAnnouncementDraft(id, expectedRevision, input, user.id)
    if (!res.ok) {
      return { ok: false, error: res.error, conflict: res.conflict }
    }
    revalidatePath("/admin/avisos")
    revalidatePath(`/admin/avisos/${id}`)
    return { ok: true, announcementId: id }
  } else {
    const res = await createAnnouncementDraft(input, user.id)
    if (!res.ok || !res.data) {
      return { ok: false, error: res.error }
    }
    revalidatePath("/admin/avisos")
    redirect(`/admin/avisos/${res.data.id}`)
  }
}

/**
 * Server Action: Publicar aviso (inmediato o programado).
 */
export async function publishAnnouncementAction(
  _prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse> {
  const { user, capabilities } = await getAdminCapabilities()
  if (!user || !capabilities.canManageAnnouncements) {
    return { ok: false, error: "No tienes permisos para publicar avisos." }
  }

  const id = String(formData.get("id") ?? "")
  const revision = Number(formData.get("revision") ?? 1)
  const publish_at = formData.get("publish_at") ? String(formData.get("publish_at")) : null
  const expires_at = formData.get("expires_at") ? String(formData.get("expires_at")) : null

  if (!id) {
    return { ok: false, error: "ID de aviso requerido" }
  }

  const res = await publishAnnouncement(id, revision, user.id, { publish_at, expires_at })
  if (!res.ok) {
    return { ok: false, error: res.error, conflict: res.conflict }
  }

  revalidatePath("/admin/avisos")
  revalidatePath(`/admin/avisos/${id}`)
  revalidatePath("/avisos")
  return { ok: true, announcementId: id }
}

/**
 * Server Action: Archivar aviso.
 */
export async function archiveAnnouncementAction(
  _prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse> {
  const { user, capabilities } = await getAdminCapabilities()
  if (!user || !capabilities.canManageAnnouncements) {
    return { ok: false, error: "No tienes permisos para archivar avisos." }
  }

  const id = String(formData.get("id") ?? "")
  if (!id) return { ok: false, error: "ID de aviso requerido" }

  const res = await archiveAnnouncement(id, user.id)
  if (!res.ok) {
    return { ok: false, error: res.error }
  }

  revalidatePath("/admin/avisos")
  revalidatePath(`/admin/avisos/${id}`)
  revalidatePath("/avisos")
  return { ok: true, announcementId: id }
}

/**
 * Server Action: Duplicar aviso como nuevo borrador.
 */
export async function duplicateAnnouncementAction(
  _prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse> {
  const { user, capabilities } = await getAdminCapabilities()
  if (!user || !capabilities.canManageAnnouncements) {
    return { ok: false, error: "No tienes permisos para duplicar avisos." }
  }

  const id = String(formData.get("id") ?? "")
  if (!id) return { ok: false, error: "ID de aviso requerido" }

  const res = await duplicateAnnouncementAsDraft(id, user.id)
  if (!res.ok || !res.data) {
    return { ok: false, error: res.error }
  }

  revalidatePath("/admin/avisos")
  redirect(`/admin/avisos/${res.data.id}`)
}

/**
 * Server Action: Marcar aviso como leído por el trabajador autenticado.
 */
export async function markAnnouncementReadAction(announcementId: string): Promise<{ ok: boolean }> {
  const { user } = await getAdminCapabilities()
  if (!user) return { ok: false }

  const res = await markAnnouncementAsRead(announcementId, user.id)
  if (res.ok) {
    revalidatePath("/avisos")
    revalidatePath(`/avisos/${announcementId}`)
  }
  return res
}

/**
 * Server Action: Actualizar preferencias de push de comunicados.
 */
export async function updatePreferencesAction(
  _prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse> {
  const { user } = await getAdminCapabilities()
  if (!user) {
    return { ok: false, error: "No autenticado" }
  }

  const enabled = formData.get("announcements_push_enabled") === "on" || formData.get("announcements_push_enabled") === "true"
  const res = await setWorkerNotificationPreferences(user.id, enabled)
  if (!res.ok) {
    return { ok: false, error: res.error }
  }

  revalidatePath("/avisos/preferencias")
  return { ok: true }
}
