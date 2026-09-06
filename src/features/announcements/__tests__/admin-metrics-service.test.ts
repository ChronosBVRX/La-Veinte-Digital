import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  fetchAdminOperationalMetrics,
  EMPTY_METRICS,
} from "../services/admin-metrics-service"

describe("admin-metrics-service", () => {
  it("devuelve EMPTY_METRICS si no hay variables de entorno", async () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL

    const res = await fetchAdminOperationalMetrics()
    expect(res).toEqual(EMPTY_METRICS)

    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl
  })

  it("calcula agregados correctamente cuando se pasa un cliente simulado", async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "announcements") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { status: "PUBLISHED", show_in_bar: true },
                { status: "PUBLISHED", show_in_bar: false },
                { status: "DRAFT", show_in_bar: false },
                { status: "SCHEDULED", show_in_bar: true },
              ],
              error: null,
            }),
          }
        }
        if (table === "push_devices") {
          return {
            select: vi.fn().mockResolvedValue({
              count: 42,
              error: null,
            }),
          }
        }
        if (table === "push_campaigns") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "c-1",
                      snapshot_title: "Campaña de prueba",
                      status: "COMPLETED",
                      created_at: "2026-09-06T10:00:00Z",
                      accepted_count: 40,
                      failed_count: 2,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === "notification_job_runs") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      started_at: "2026-09-06T12:00:00Z",
                      status: "COMPLETED",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-key"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await fetchAdminOperationalMetrics(mockClient as any)

    expect(res.announcements.total).toBe(4)
    expect(res.announcements.published).toBe(2)
    expect(res.announcements.draft).toBe(1)
    expect(res.announcements.scheduled).toBe(1)
    expect(res.announcements.inBar).toBe(2)

    expect(res.push.totalDevices).toBe(42)
    expect(res.push.recentCampaignsCount).toBe(1)
    expect(res.push.lastCampaign?.id).toBe("c-1")
    expect(res.push.lastCampaign?.acceptedCount).toBe(40)

    expect(res.cron.recentRunsCount).toBe(1)
    expect(res.cron.lastStatus).toBe("COMPLETED")

    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey
  })
})
