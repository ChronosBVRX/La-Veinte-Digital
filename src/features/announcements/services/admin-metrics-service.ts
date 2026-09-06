import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

export interface AdminOperationalMetrics {
  announcements: {
    total: number
    published: number
    draft: number
    scheduled: number
    inBar: number
  }
  push: {
    totalDevices: number
    recentCampaignsCount: number
    lastCampaign: {
      id: string
      title: string
      status: string
      createdAt: string
      acceptedCount: number
      failedCount: number
    } | null
  }
  cron: {
    lastRunAt: string | null
    lastStatus: string | null
    recentRunsCount: number
  }
}

export const EMPTY_METRICS: AdminOperationalMetrics = {
  announcements: { total: 0, published: 0, draft: 0, scheduled: 0, inBar: 0 },
  push: { totalDevices: 0, recentCampaignsCount: 0, lastCampaign: null },
  cron: { lastRunAt: null, lastStatus: null, recentRunsCount: 0 },
}

/**
 * Obtiene métricas agregadas operativas para el panel de administración.
 * Realiza consultas agrupadas y protegidas contra fallos para nunca
 * romper la renderización del Hub administrativo.
 */
export async function fetchAdminOperationalMetrics(
  customClient?: ReturnType<typeof createSupabaseClient<Database>>,
): Promise<AdminOperationalMetrics> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return EMPTY_METRICS
  }

  const client =
    customClient ??
    createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

  try {
    const [
      announcementsRes,
      devicesRes,
      campaignsRes,
      cronRes,
    ] = await Promise.allSettled([
      client.from("announcements").select("status, show_in_bar"),
      client.from("push_devices").select("id", { count: "exact", head: true }),
      client
        .from("push_campaigns")
        .select("id, snapshot_title, status, created_at, accepted_count, failed_count")
        .order("created_at", { ascending: false })
        .limit(10),
      client
        .from("notification_job_runs")
        .select("started_at, status")
        .order("started_at", { ascending: false })
        .limit(10),
    ])

    const metrics: AdminOperationalMetrics = {
      announcements: { total: 0, published: 0, draft: 0, scheduled: 0, inBar: 0 },
      push: { totalDevices: 0, recentCampaignsCount: 0, lastCampaign: null },
      cron: { lastRunAt: null, lastStatus: null, recentRunsCount: 0 },
    }

    if (announcementsRes.status === "fulfilled" && announcementsRes.value.data) {
      const items = announcementsRes.value.data
      metrics.announcements.total = items.length
      metrics.announcements.published = items.filter((i) => i.status === "PUBLISHED").length
      metrics.announcements.draft = items.filter((i) => i.status === "DRAFT").length
      metrics.announcements.scheduled = items.filter((i) => i.status === "SCHEDULED").length
      metrics.announcements.inBar = items.filter((i) => i.show_in_bar).length
    }

    if (devicesRes.status === "fulfilled" && typeof devicesRes.value.count === "number") {
      metrics.push.totalDevices = devicesRes.value.count
    }

    if (campaignsRes.status === "fulfilled" && campaignsRes.value.data) {
      const camps = campaignsRes.value.data
      metrics.push.recentCampaignsCount = camps.length
      if (camps.length > 0) {
        const first = camps[0]
        metrics.push.lastCampaign = {
          id: first.id,
          title: first.snapshot_title,
          status: first.status,
          createdAt: first.created_at,
          acceptedCount: first.accepted_count,
          failedCount: first.failed_count,
        }
      }
    }

    if (cronRes.status === "fulfilled" && cronRes.value.data) {
      const runs = cronRes.value.data
      metrics.cron.recentRunsCount = runs.length
      if (runs.length > 0) {
        metrics.cron.lastRunAt = runs[0].started_at
        metrics.cron.lastStatus = runs[0].status
      }
    }

    return metrics
  } catch {
    return EMPTY_METRICS
  }
}
