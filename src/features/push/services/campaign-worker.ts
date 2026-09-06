import "server-only"
import { createClient as createServiceRoleClient } from "@supabase/supabase-js"
import { sanitizeDestination } from "./push-admin"

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_NOT_CONFIGURED")
  return createServiceRoleClient(url, key)
}

interface FirebaseMulticastResult {
  responses: Array<{ success: boolean; error?: { code: string; message?: string } }>
}

type FirebaseMessaging = {
  sendEachForMulticast: (msg: unknown) => Promise<FirebaseMulticastResult>
}

let cachedMessaging: FirebaseMessaging | null = null

async function getFirebaseMessaging(): Promise<FirebaseMessaging> {
  if (cachedMessaging) return cachedMessaging
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error("PUSH_ADMIN_NOT_CONFIGURED")

  const admin = await import("firebase-admin")
  if (!admin.apps.length) {
    const parsed = JSON.parse(json)
    admin.initializeApp({ credential: admin.credential.cert(parsed) })
  }
  const messaging = (admin.messaging as unknown as () => FirebaseMessaging)()
  cachedMessaging = messaging
  return cachedMessaging
}

export interface CreateCampaignParams {
  announcementId?: string | null
  announcementRevision?: number
  purpose: "TEST" | "LIVE"
  audience: "ALL" | "SELF"
  title: string
  body: string
  destination?: string | null
  type?: "GENERAL" | "IMPORTANT_ALERT" | "AGENDA" | "DOCUMENT" | "UPDATE"
  scheduledAt?: string | null
  expiresAt?: string | null
  creatorId: string
  idempotencyKey?: string | null
}

export interface ProcessBatchResult {
  campaignId: string
  processed: number
  accepted: number
  failed: number
  invalid: number
  retryPending: number
  finished: boolean
  status: string
}

/**
 * Crea la campaña y congela el snapshot de destinatarios en push_campaign_deliveries.
 */
export async function createPushCampaign(params: CreateCampaignParams) {
  const supabase = serviceClient()

  // 1. Verificar idempotencia
  if (params.idempotencyKey) {
    const { data: existing } = await supabase
      .from("push_campaigns")
      .select("*")
      .eq("idempotency_key", params.idempotencyKey)
      .maybeSingle()

    if (existing) {
      return { ok: true as const, campaign: existing, deduplicated: true }
    }
  }

  const finalTitle = params.purpose === "TEST"
    ? `[PRUEBA] ${params.title}`.slice(0, 200)
    : params.title.slice(0, 200)
  const finalBody = params.body.slice(0, 500)
  const finalDestination = sanitizeDestination(params.destination)

  // 2. Insertar fila de campaña en estado inicial
  const { data: campaign, error: campErr } = await supabase
    .from("push_campaigns")
    .insert({
      announcement_id: params.announcementId ?? null,
      announcement_revision: params.announcementRevision ?? 1,
      purpose: params.purpose,
      audience: params.audience,
      snapshot_title: finalTitle,
      snapshot_body: finalBody,
      snapshot_destination: finalDestination ?? null,
      snapshot_type: params.type ?? "GENERAL",
      status: "QUEUED",
      scheduled_at: params.scheduledAt ?? null,
      expires_at: params.expiresAt ?? null,
      created_by: params.creatorId,
      idempotency_key: params.idempotencyKey ?? null,
    })
    .select()
    .single()

  if (campErr || !campaign) {
    throw new Error(`Error al crear campaña: ${campErr?.message}`)
  }

  // 3. Congelar dispositivos elegibles para la audiencia con paginación
  const PAGE_SIZE = 1000
  let page = 0
  let hasMore = true
  const devices: Array<{ id: string; user_id: string; fcm_token: string }> = []

  while (hasMore) {
    let deviceQuery = supabase
      .from("push_devices")
      .select("id, user_id, fcm_token")
      .eq("notifications_enabled", true)

    if (params.audience === "SELF") {
      deviceQuery = deviceQuery.eq("user_id", params.creatorId)
    }

    const { data: pageDevices, error: devErr } = await deviceQuery
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (devErr) {
      await supabase.from("push_campaigns").update({ status: "FAILED" }).eq("id", campaign.id)
      throw new Error(`Error al consultar dispositivos: ${devErr.message}`)
    }

    if (!pageDevices || pageDevices.length === 0) {
      hasMore = false
    } else {
      devices.push(...pageDevices)
      if (pageDevices.length < PAGE_SIZE) {
        hasMore = false
      } else {
        page++
      }
    }
  }

  // Si la audiencia es ALL, filtrar usuarios que hayan deshabilitado avisos en notification_preferences
  let eligibleDevices = devices ?? []
  if (params.audience === "ALL" && eligibleDevices.length > 0) {
    const userIds = Array.from(new Set(eligibleDevices.map((d) => d.user_id)))
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("user_id, announcements_push_enabled")
      .in("user_id", userIds)

    const disabledUsers = new Set(
      (prefs ?? []).filter((p) => !p.announcements_push_enabled).map((p) => p.user_id)
    )

    if (disabledUsers.size > 0) {
      eligibleDevices = eligibleDevices.filter((d) => !disabledUsers.has(d.user_id))
    }
  }

  // Deduplicar tokens por dispositivo
  const seenTokens = new Set<string>()
  const uniqueDeliveries = eligibleDevices.filter((d) => {
    if (!d.fcm_token || seenTokens.has(d.fcm_token)) return false
    seenTokens.add(d.fcm_token)
    return true
  })

  const targetAccounts = new Set(uniqueDeliveries.map((d) => d.user_id)).size
  const targetDevices = uniqueDeliveries.length

  if (targetDevices === 0) {
    // Sin dispositivos elegibles: marcar completada de inmediato sin error falso
    const { data: updated } = await supabase
      .from("push_campaigns")
      .update({
        status: "COMPLETED",
        target_accounts: 0,
        target_devices: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .select()
      .single()

    return { ok: true as const, campaign: updated ?? campaign, noRecipients: true }
  }

  // Insertar entregas en lotes de 1000
  const BATCH_SIZE = 1000
  for (let i = 0; i < uniqueDeliveries.length; i += BATCH_SIZE) {
    const chunk = uniqueDeliveries.slice(i, i + BATCH_SIZE)
    const records = chunk.map((d) => ({
      campaign_id: campaign.id,
      snapshot_device_id: d.id,
      device_id: d.id,
      user_id: d.user_id,
      fcm_token: d.fcm_token,
      status: "PENDING",
      attempts: 0,
    }))

    const { error: insErr } = await supabase.from("push_campaign_deliveries").insert(records)
    if (insErr) {
      console.error("[campaign-worker] Error inserting deliveries batch:", insErr)
      await supabase
        .from("push_campaigns")
        .update({
          status: "FAILED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id)
      throw new Error(`Error al insertar lote de entregas de la campaña: ${insErr.message}`)
    }
  }

  // Actualizar contadores de la campaña
  const { data: finalCampaign } = await supabase
    .from("push_campaigns")
    .update({
      target_accounts: targetAccounts,
      target_devices: targetDevices,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaign.id)
    .select()
    .single()

  return { ok: true as const, campaign: finalCampaign ?? campaign, noRecipients: false }
}

/**
 * Reclama y procesa un lote de entregas de la campaña con locks de exclusión mutua.
 */
export async function processCampaignBatch(
  campaignId: string,
  batchLimit = 500
): Promise<ProcessBatchResult> {
  const supabase = serviceClient()

  // 1. Verificar estado de la campaña
  const { data: campaign, error: campErr } = await supabase
    .from("push_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single()

  if (campErr || !campaign) {
    throw new Error("Campaña no encontrada")
  }

  if (campaign.status === "PAUSED" || campaign.status === "CANCELLED" || campaign.status === "COMPLETED") {
    return {
      campaignId,
      processed: 0,
      accepted: 0,
      failed: 0,
      invalid: 0,
      retryPending: 0,
      finished: true,
      status: campaign.status,
    }
  }

  // Marcar como PROCESSING si estaba QUEUED
  if (campaign.status === "QUEUED") {
    await supabase.from("push_campaigns").update({ status: "PROCESSING" }).eq("id", campaignId)
  }

  const claimToken = crypto.randomUUID()
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + 2 * 60 * 1000).toISOString() // 2 min lease

  // 2. Reclamar filas atómicamente mediante RPC o fallback transaccional
  let availableRows: Array<{ id: string; fcm_token: string; attempts: number }> = []

  // Intentar reclamo atómico vía RPC (FOR UPDATE SKIP LOCKED)
  const { data: rpcRows, error: rpcErr } = await supabase.rpc("claim_campaign_deliveries", {
    p_campaign_id: campaignId,
    p_batch_limit: batchLimit,
    p_claim_token: claimToken,
    p_lease_until: leaseUntil,
  })

  if (!rpcErr && Array.isArray(rpcRows)) {
    availableRows = rpcRows.map((r) => ({
      id: r.id,
      fcm_token: r.fcm_token,
      attempts: r.attempts ?? 0,
    }))
  } else {
    // Fallback si la RPC aún no está creada en la base (ej. suite de pruebas unitarias o desarrollo)
    // Filtra PENDING y RETRY_PENDING únicamente si next_attempt_at <= now()
    const nowIso = now.toISOString()
    const { data: directRows } = await supabase
      .from("push_campaign_deliveries")
      .select("id, fcm_token, attempts, status, next_attempt_at")
      .eq("campaign_id", campaignId)
      .in("status", ["PENDING", "RETRY_PENDING"])
      .or(`lease_until.is.null,lease_until.lt.${nowIso}`)
      .limit(batchLimit)

    const eligibleRows = (directRows ?? []).filter((r) => {
      if (r.status === "PENDING") return true
      if (r.status === "RETRY_PENDING") {
        return !r.next_attempt_at || new Date(r.next_attempt_at).getTime() <= now.getTime()
      }
      return false
    })

    if (eligibleRows.length > 0) {
      const idsToClaim = eligibleRows.map((r) => r.id)
      await supabase
        .from("push_campaign_deliveries")
        .update({
          status: "PROCESSING",
          lease_until: leaseUntil,
          claim_token: claimToken,
          updated_at: nowIso,
        })
        .in("id", idsToClaim)

      availableRows = eligibleRows.map((r) => ({
        id: r.id,
        fcm_token: r.fcm_token,
        attempts: r.attempts ?? 0,
      }))
    }
  }

  if (availableRows.length === 0) {
    // Comprobar si quedan filas en proceso de otros workers
    const { count: pendingCount } = await supabase
      .from("push_campaign_deliveries")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["PENDING", "PROCESSING", "RETRY_PENDING"])

    const isFinished = !pendingCount || pendingCount === 0

    if (isFinished) {
      await finalizeCampaign(campaignId)
    }

    return {
      campaignId,
      processed: 0,
      accepted: 0,
      failed: 0,
      invalid: 0,
      retryPending: 0,
      finished: isFinished,
      status: isFinished ? "COMPLETED" : "PROCESSING",
    }
  }

  // 3. Enviar a Firebase Multicast
  let messaging: FirebaseMessaging | null = null
  let firebaseError: Error | null = null
  try {
    messaging = await getFirebaseMessaging()
  } catch (err) {
    firebaseError = err instanceof Error ? err : new Error("Firebase Admin no disponible")
  }

  const tokens = availableRows.map((r) => r.fcm_token)
  let accepted = 0
  let failed = 0
  let invalid = 0
  let retryPending = 0

  if (firebaseError || !messaging) {
    // Error al conectar con Firebase: marcar UNKNOWN o RETRY_PENDING sin duplicar
    console.error("[campaign-worker] Firebase connection error:", firebaseError)
    await supabase
      .from("push_campaign_deliveries")
      .update({
        status: "RETRY_PENDING",
        lease_until: null,
        claim_token: null,
        error_code: "FIREBASE_UNAVAILABLE",
        next_attempt_at: new Date(now.getTime() + 60 * 1000).toISOString(),
      })
      .eq("claim_token", claimToken)

    return {
      campaignId,
      processed: availableRows.length,
      accepted: 0,
      failed: availableRows.length,
      invalid: 0,
      retryPending: availableRows.length,
      finished: false,
      status: "PROCESSING",
    }
  }

  const message = {
    tokens,
    android: { priority: "HIGH" as const, ttl: 60 * 60 * 4 },
    data: {
      type: campaign.snapshot_type,
      title: campaign.snapshot_title,
      body: campaign.snapshot_body,
      destination: campaign.snapshot_destination ?? "",
      silent: "false",
      id: String(campaign.notification_id),
      campaign_id: campaign.id,
      ...(campaign.announcement_id ? { announcement_id: campaign.announcement_id } : {}),
    },
  }

  let responses: Array<{ success: boolean; error?: { code: string; message?: string } }> = []
  try {
    const result = await messaging.sendEachForMulticast(message)
    responses = result.responses ?? []
  } catch (err) {
    // Si la llamada multicast completa cae en timeout
    console.error("[campaign-worker] Multicast exception:", err)
    await supabase
      .from("push_campaign_deliveries")
      .update({
        status: "UNKNOWN",
        lease_until: null,
        claim_token: null,
        error_code: "MULTICAST_TIMEOUT",
        updated_at: new Date().toISOString(),
      })
      .eq("claim_token", claimToken)

    return {
      campaignId,
      processed: availableRows.length,
      accepted: 0,
      failed: availableRows.length,
      invalid: 0,
      retryPending: 0,
      finished: false,
      status: "NEEDS_REVIEW",
    }
  }

  const invalidTokensToRemove: string[] = []

  // 4. Mapear resultados a cada delivery
  for (let i = 0; i < responses.length; i++) {
    const r = responses[i]
    const row = availableRows[i]
    const attempts = (row.attempts ?? 0) + 1

    if (r.success) {
      accepted++
      await supabase
        .from("push_campaign_deliveries")
        .update({
          status: "ACCEPTED",
          accepted_at: new Date().toISOString(),
          lease_until: null,
          claim_token: null,
          attempts,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("claim_token", claimToken)
    } else {
      const errorCode = r.error?.code ?? "UNKNOWN_ERROR"
      const isUnregistered =
        errorCode === "messaging/registration-token-not-registered" ||
        errorCode === "UNREGISTERED"

      if (isUnregistered) {
        invalid++
        invalidTokensToRemove.push(row.fcm_token)
        await supabase
          .from("push_campaign_deliveries")
          .update({
            status: "INVALID",
            error_code: "UNREGISTERED",
            lease_until: null,
            claim_token: null,
            attempts,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("claim_token", claimToken)
      } else if (attempts < 3) {
        // Reintento transitorio con backoff exponencial (1, 5, 15 min)
        retryPending++
        const backoffMinutes = attempts === 1 ? 1 : attempts === 2 ? 5 : 15
        const nextAttempt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()

        await supabase
          .from("push_campaign_deliveries")
          .update({
            status: "RETRY_PENDING",
            next_attempt_at: nextAttempt,
            error_code: errorCode,
            lease_until: null,
            claim_token: null,
            attempts,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("claim_token", claimToken)
      } else {
        // Superó 3 intentos: FAILED
        failed++
        await supabase
          .from("push_campaign_deliveries")
          .update({
            status: "FAILED",
            error_code: errorCode,
            lease_until: null,
            claim_token: null,
            attempts,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("claim_token", claimToken)
      }
    }
  }

  // 4b. Control de entregas huérfanas si Firebase devolvió menos respuestas que tokens
  if (responses.length < availableRows.length) {
    const unhandledRows = availableRows.slice(responses.length)
    const unhandledIds = unhandledRows.map((r) => r.id)
    await supabase
      .from("push_campaign_deliveries")
      .update({
        status: "RETRY_PENDING",
        error_code: "RESPONSE_COUNT_MISMATCH",
        next_attempt_at: new Date(Date.now() + 60 * 1000).toISOString(),
        lease_until: null,
        claim_token: null,
        updated_at: new Date().toISOString(),
      })
      .in("id", unhandledIds)
      .eq("claim_token", claimToken)

    retryPending += unhandledRows.length
  }

  // 5. Limpieza de tokens inválidos de push_devices
  if (invalidTokensToRemove.length > 0) {
    await supabase.from("push_devices").delete().in("fcm_token", invalidTokensToRemove)
  }

  // 6. Reconciliar contadores agregados en la campaña
  await reconcileCampaignCounters(campaignId)

  // 7. Comprobar si la campaña concluyó
  const { count: remainingCount } = await supabase
    .from("push_campaign_deliveries")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["PENDING", "PROCESSING", "RETRY_PENDING"])

  const isFinished = !remainingCount || remainingCount === 0
  if (isFinished) {
    await finalizeCampaign(campaignId)
  }

  return {
    campaignId,
    processed: availableRows.length,
    accepted,
    failed,
    invalid,
    retryPending,
    finished: isFinished,
    status: isFinished ? "COMPLETED" : "PROCESSING",
  }
}

/**
 * Reconcilia los contadores en la tabla push_campaigns consultando las entregas reales.
 */
async function reconcileCampaignCounters(campaignId: string) {
  const supabase = serviceClient()

  const { data: deliveries } = await supabase
    .from("push_campaign_deliveries")
    .select("status")
    .eq("campaign_id", campaignId)

  if (!deliveries) return

  let accepted = 0
  let failed = 0
  let invalid = 0
  let skipped = 0
  let unknown = 0

  for (const d of deliveries) {
    if (d.status === "ACCEPTED") accepted++
    else if (d.status === "FAILED") failed++
    else if (d.status === "INVALID") invalid++
    else if (d.status === "SKIPPED") skipped++
    else if (d.status === "UNKNOWN") unknown++
  }

  await supabase
    .from("push_campaigns")
    .update({
      accepted_count: accepted,
      failed_count: failed,
      invalid_tokens_count: invalid,
      skipped_count: skipped,
      unknown_count: unknown,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
}

/**
 * Concluye la campaña calculando si fue COMPLETED o PARTIAL.
 */
async function finalizeCampaign(campaignId: string) {
  const supabase = serviceClient()

  const { data: campaign } = await supabase
    .from("push_campaigns")
    .select("target_devices, accepted_count, failed_count, status")
    .eq("id", campaignId)
    .single()

  if (!campaign) return

  let finalStatus = "COMPLETED"
  if (campaign.failed_count > 0 && campaign.accepted_count > 0) {
    finalStatus = "PARTIAL"
  } else if (campaign.failed_count > 0 && campaign.accepted_count === 0) {
    finalStatus = "FAILED"
  }

  await supabase
    .from("push_campaigns")
    .update({
      status: finalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
}
