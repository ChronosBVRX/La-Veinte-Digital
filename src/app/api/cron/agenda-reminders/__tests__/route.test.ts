import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, POST } from "../route"

vi.mock("@/features/agenda-laboral/services/commitment-reminders", () => ({
  processPendingCommitmentReminders: vi.fn().mockResolvedValue({
    dayBeforeSent: 1,
    hoursBeforeSent: 2,
    atStartSent: 0,
    totalProcessed: 5,
    errors: [],
  }),
}))

describe("/api/cron/agenda-reminders", () => {
  const origEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...origEnv }
    process.env.CRON_SECRET = "test-cron-secret"
    process.env.PUSH_ADMIN_KEY = "test-admin-key"
  })

  it("rejects unauthorized request with 401", async () => {
    const req = new NextRequest("https://la20.com.mx/api/cron/agenda-reminders")
    const res = await GET(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.code).toBe("unauthorized")
  })

  it("accepts request with valid CRON_SECRET Bearer token", async () => {
    const req = new NextRequest("https://la20.com.mx/api/cron/agenda-reminders", {
      headers: {
        authorization: "Bearer test-cron-secret",
      },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.summary.dayBeforeSent).toBe(1)
  })

  it("accepts request with valid x-push-admin-key header via POST", async () => {
    const req = new NextRequest("https://la20.com.mx/api/cron/agenda-reminders", {
      method: "POST",
      headers: {
        "x-push-admin-key": "test-admin-key",
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.summary.hoursBeforeSent).toBe(2)
  })
})
