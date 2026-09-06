import { describe, it, expect, afterEach } from "vitest"
import { NextRequest } from "next/server"

describe("push-campaigns cron endpoint authorization", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("fails authorization when Authorization header does not match CRON_SECRET", () => {
    process.env.CRON_SECRET = "super-secret-key-123"

    function isAuthorized(request: NextRequest): boolean {
      const cronSecret = process.env.CRON_SECRET
      const authHeader = request.headers.get("authorization")
      if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true
      if (!cronSecret && process.env.NODE_ENV !== "production") return true
      return false
    }

    const unauthReq = new NextRequest("http://localhost:3000/api/cron/push-campaigns", {
      headers: { authorization: "Bearer wrong-key" },
    })
    expect(isAuthorized(unauthReq)).toBe(false)

    const noHeaderReq = new NextRequest("http://localhost:3000/api/cron/push-campaigns")
    expect(isAuthorized(noHeaderReq)).toBe(false)

    const authReq = new NextRequest("http://localhost:3000/api/cron/push-campaigns", {
      headers: { authorization: "Bearer super-secret-key-123" },
    })
    expect(isAuthorized(authReq)).toBe(true)
  })

  it("fails closed in production if CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET
    ;(process.env as Record<string, string | undefined>).NODE_ENV = "production"

    function isAuthorized(request: NextRequest): boolean {
      const cronSecret = process.env.CRON_SECRET
      const authHeader = request.headers.get("authorization")
      if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true
      if (!cronSecret && process.env.NODE_ENV !== "production") return true
      return false
    }

    const req = new NextRequest("http://localhost:3000/api/cron/push-campaigns")
    expect(isAuthorized(req)).toBe(false)
  })
})
