import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceRoleClient } from "@supabase/supabase-js"
import { processCampaignBatch } from "@/features/push/services/campaign-worker"

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_NOT_CONFIGURED")
  return createServiceRoleClient(url, key)
}

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true
  // En desarrollo local permite probar sin secreto
  if (!cronSecret && process.env.NODE_ENV !== "production") return true

  return false
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "No autorizado", code: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  }

  const supabase = serviceClient()
  const startedAt = new Date().toISOString()

  // 1. Iniciar registro en notification_job_runs
  const { data: jobRun } = await supabase
    .from("notification_job_runs")
    .insert({
      job_kind: "push_campaigns_cron",
      status: "RUNNING",
      started_at: startedAt,
    })
    .select("id")
    .single()

  const jobRunId = jobRun?.id

  let processedCampaignsCount = 0
  let processedDeliveriesCount = 0

  try {
    const nowIso = new Date().toISOString()
    const now = Date.now()

    // 2. Procesar avisos programados cuya fecha publish_at ya haya llegado
    const { data: scheduledAnnouncements } = await supabase
      .from("announcements")
      .select("id, title")
      .eq("status", "SCHEDULED")
      .lte("publish_at", nowIso)

    if (scheduledAnnouncements && scheduledAnnouncements.length > 0) {
      for (const ann of scheduledAnnouncements) {
        await supabase
          .from("announcements")
          .update({ status: "PUBLISHED", updated_at: nowIso })
          .eq("id", ann.id)
      }
    }

    // 3. Procesar campañas activas (QUEUED o PROCESSING)
    const { data: activeCampaigns } = await supabase
      .from("push_campaigns")
      .select("id, status, expires_at")
      .in("status", ["QUEUED", "PROCESSING"])
      .order("created_at", { ascending: true })
      .limit(5)

    if (activeCampaigns && activeCampaigns.length > 0) {
      for (const camp of activeCampaigns) {
        // Comprobar caducidad de la campaña
        if (camp.expires_at && new Date(camp.expires_at).getTime() < now) {
          await supabase
            .from("push_campaigns")
            .update({ status: "PARTIAL", updated_at: nowIso })
            .eq("id", camp.id)

          await supabase
            .from("push_campaign_deliveries")
            .update({ status: "SKIPPED", error_code: "CAMPAIGN_EXPIRED", updated_at: nowIso })
            .eq("campaign_id", camp.id)
            .in("status", ["PENDING", "RETRY_PENDING"])

          continue
        }

        const batchResult = await processCampaignBatch(camp.id, 500)
        processedCampaignsCount++
        processedDeliveriesCount += batchResult.processed
      }
    }

    // 4. Concluir registro de job run
    if (jobRunId) {
      await supabase
        .from("notification_job_runs")
        .update({
          status: "COMPLETED",
          finished_at: new Date().toISOString(),
          processed_campaigns: processedCampaignsCount,
          processed_deliveries: processedDeliveriesCount,
          details: {
            scheduled_announcements_published: scheduledAnnouncements?.length ?? 0,
          },
        })
        .eq("id", jobRunId)
    }

    return NextResponse.json(
      {
        ok: true,
        timestamp: new Date().toISOString(),
        summary: {
          jobRunId,
          processedCampaigns: processedCampaignsCount,
          processedDeliveries: processedDeliveriesCount,
          publishedAnnouncements: scheduledAnnouncements?.length ?? 0,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (error) {
    console.error("[cron/push-campaigns] Execution error:", error)

    if (jobRunId) {
      await supabase
        .from("notification_job_runs")
        .update({
          status: "FAILED",
          finished_at: new Date().toISOString(),
          error_code: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        })
        .eq("id", jobRunId)
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Error interno del cron" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
