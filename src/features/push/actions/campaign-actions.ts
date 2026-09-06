"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getAdminCapabilities } from "@/shared/server/admin/admin-capabilities"
import { createPushCampaign, processCampaignBatch } from "../services/campaign-worker"
import { getAnnouncementById } from "@/features/announcements/services/announcements-service"
import { logAdminAudit } from "@/features/announcements/services/announcements-service"
import { createClient as createServiceRoleClient } from "@supabase/supabase-js"

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_NOT_CONFIGURED")
  return createServiceRoleClient(url, key)
}

export interface CampaignActionResponse {
  ok: boolean
  error?: string
  campaignId?: string
  accepted?: number
  failed?: number
  targetDevices?: number
  noRecipients?: boolean
}

/**
 * Server Action: Despacha una campaña push LIVE masiva a todos los usuarios elegibles.
 */
export async function sendLiveCampaignAction(
  _prevState: CampaignActionResponse | undefined,
  formData: FormData
): Promise<CampaignActionResponse> {
  const { user, capabilities } = await getAdminCapabilities()
  if (!user || !capabilities.canManageCampaigns) {
    return { ok: false, error: "No tienes permisos para despachar campañas masivas." }
  }

  const announcementId = formData.get("announcement_id") ? String(formData.get("announcement_id")) : null
  let title = String(formData.get("title") ?? "").trim()
  let body = String(formData.get("body") ?? "").trim()
  let destination = formData.get("destination") ? String(formData.get("destination")).trim() : null
  let revision = 1

  if (announcementId) {
    const ann = await getAnnouncementById(announcementId)
    if (!ann) return { ok: false, error: "Aviso no encontrado" }
    title = ann.title
    body = ann.push_summary || ann.body
    destination = ann.destination_path
    revision = ann.revision
  }

  if (!title || !body) {
    return { ok: false, error: "Título y mensaje son requeridos para la campaña." }
  }

  try {
    const { campaign, noRecipients } = await createPushCampaign({
      announcementId,
      announcementRevision: revision,
      purpose: "LIVE",
      audience: "ALL",
      title,
      body,
      destination,
      creatorId: user.id,
      idempotencyKey: `live_${announcementId ?? "direct"}_${revision}_${Date.now()}`,
    })

    await logAdminAudit({
      actorId: user.id,
      action: "push_campaign.create_live",
      entityType: "push_campaign",
      entityId: campaign.id,
      details: { title, target_devices: campaign.target_devices },
    })

    if (noRecipients) {
      return {
        ok: true,
        campaignId: campaign.id,
        targetDevices: 0,
        noRecipients: true,
      }
    }

    // Procesar primer lote sincrónico
    await processCampaignBatch(campaign.id, 500)

    revalidatePath(`/admin/campanas/${campaign.id}`)
    revalidatePath("/admin")
    redirect(`/admin/campanas/${campaign.id}`)
  } catch (err) {
    console.error("[campaign-actions] Error creating LIVE campaign:", err)
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido al procesar campaña" }
  }
}

/**
 * Server Action: Despacha una prueba (SELF) únicamente a los dispositivos del admin.
 */
export async function sendTestSelfCampaignAction(
  _prevState: CampaignActionResponse | undefined,
  formData: FormData
): Promise<CampaignActionResponse> {
  const { user, capabilities } = await getAdminCapabilities()
  if (!user || !capabilities.canManageCampaigns) {
    return { ok: false, error: "No tienes permisos para realizar pruebas push." }
  }

  const announcementId = formData.get("announcement_id") ? String(formData.get("announcement_id")) : null
  let title = String(formData.get("title") ?? "").trim()
  let body = String(formData.get("body") ?? "").trim()
  let destination = formData.get("destination") ? String(formData.get("destination")).trim() : null

  if (announcementId) {
    const ann = await getAnnouncementById(announcementId)
    if (ann) {
      title = ann.title
      body = ann.push_summary || ann.body
      destination = ann.destination_path
    }
  }

  if (!title || !body) {
    return { ok: false, error: "Título y mensaje requeridos." }
  }

  try {
    const { campaign, noRecipients } = await createPushCampaign({
      announcementId,
      purpose: "TEST",
      audience: "SELF",
      title,
      body,
      destination,
      creatorId: user.id,
    })

    if (noRecipients) {
      return {
        ok: false,
        error: "No tienes ningún dispositivo Android registrado y activo en tu cuenta para recibir la prueba.",
        noRecipients: true,
      }
    }

    const batchResult = await processCampaignBatch(campaign.id, 50)

    return {
      ok: true,
      campaignId: campaign.id,
      accepted: batchResult.accepted,
      failed: batchResult.failed,
      targetDevices: campaign.target_devices,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al enviar prueba" }
  }
}

/**
 * Pausar campaña activa.
 */
export async function pauseCampaignAction(formData: FormData): Promise<void> {
  const campaignId = String(formData.get("campaignId") ?? "")
  if (!campaignId) return
  const { user, capabilities } = await getAdminCapabilities()
  if (!user || !capabilities.canManageCampaigns) return

  const supabase = serviceClient()
  await supabase
    .from("push_campaigns")
    .update({ status: "PAUSED", updated_at: new Date().toISOString() })
    .eq("id", campaignId)
    .in("status", ["QUEUED", "PROCESSING"])

  revalidatePath(`/admin/campanas/${campaignId}`)
}

/**
 * Reanudar campaña pausada.
 */
export async function resumeCampaignAction(formData: FormData): Promise<void> {
  const campaignId = String(formData.get("campaignId") ?? "")
  if (!campaignId) return
  const { user, capabilities } = await getAdminCapabilities()
  if (!user || !capabilities.canManageCampaigns) return

  const supabase = serviceClient()
  await supabase
    .from("push_campaigns")
    .update({ status: "PROCESSING", updated_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("status", "PAUSED")

  // Procesar un lote inmediatamente
  await processCampaignBatch(campaignId, 500)

  revalidatePath(`/admin/campanas/${campaignId}`)
}

/**
 * Cancelar campaña.
 */
export async function cancelCampaignAction(formData: FormData): Promise<void> {
  const campaignId = String(formData.get("campaignId") ?? "")
  if (!campaignId) return
  const { user, capabilities } = await getAdminCapabilities()
  if (!user || !capabilities.canManageCampaigns) return

  const supabase = serviceClient()
  await supabase
    .from("push_campaigns")
    .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
    .eq("id", campaignId)
    .in("status", ["QUEUED", "PROCESSING", "PAUSED"])

  // Cancelar entregas pendientes
  await supabase
    .from("push_campaign_deliveries")
    .update({ status: "SKIPPED", error_code: "CAMPAIGN_CANCELLED", updated_at: new Date().toISOString() })
    .eq("campaign_id", campaignId)
    .in("status", ["PENDING", "RETRY_PENDING"])

  revalidatePath(`/admin/campanas/${campaignId}`)
}

/**
 * Reintentar entregas fallidas.
 */
export async function retryFailedDeliveriesAction(formData: FormData): Promise<void> {
  const campaignId = String(formData.get("campaignId") ?? "")
  if (!campaignId) return
  const { user, capabilities } = await getAdminCapabilities()
  if (!user || !capabilities.canManageCampaigns) return

  const supabase = serviceClient()

  // Resetear entregas FAILED a PENDING con attempts = 0
  await supabase
    .from("push_campaign_deliveries")
    .update({
      status: "PENDING",
      attempts: 0,
      next_attempt_at: null,
      error_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("campaign_id", campaignId)
    .eq("status", "FAILED")

  // Asegurar que la campaña vuelva a PROCESSING si estaba COMPLETED o PARTIAL
  await supabase
    .from("push_campaigns")
    .update({ status: "PROCESSING", updated_at: new Date().toISOString() })
    .eq("id", campaignId)

  await processCampaignBatch(campaignId, 500)

  revalidatePath(`/admin/campanas/${campaignId}`)
}
