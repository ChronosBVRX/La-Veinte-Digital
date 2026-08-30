import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "../route"
import type { NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"

const ADMIN = "admin@laveinte.mx"
const MOCK_USER = {
  id: "user-admin",
  email: ADMIN,
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
} as User

// The route only uses request.text()/headers/json(); a plain Request is fine, but the handler is
// typed as NextRequest, so we produce a typed value.
function jsonRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const request = new Request("http://localhost/api/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-push-admin-key": "k-secret", ...headers },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
  return request
}

vi.mock("@/shared/server/auth/require-user", () => ({ requireUser: vi.fn() }))
vi.mock("@/features/push/services/push-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/push/services/push-admin")>()
  return {
    ...actual,
    sendBroadcast: vi.fn(),
    sendToUser: vi.fn(),
    sendToUsers: vi.fn(),
  }
})
vi.mock("@/features/push/services/push-rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/push/services/push-rate-limit")>()
  return { ...actual, fixedWindow: vi.fn(() => ({ allowed: true, remaining: 9, retryAfterSeconds: 0 })) }
})

import { requireUser } from "@/shared/server/auth/require-user"
import { sendBroadcast, sendToUser, sendToUsers } from "@/features/push/services/push-admin"

describe("POST /api/push/send", () => {
  beforeEach(() => {
    vi.mocked(requireUser).mockReset()
    vi.mocked(sendBroadcast).mockReset()
    vi.mocked(sendToUser).mockReset()
    vi.mocked(sendToUsers).mockReset()
    vi.mocked(sendBroadcast).mockResolvedValue({ sent: 1, failed: 0, invalidTokens: 0 } as never)
    vi.mocked(sendToUser).mockResolvedValue({ sent: 1, failed: 0, invalidTokens: 0 } as never)
    vi.mocked(sendToUsers).mockResolvedValue({ sent: 2, failed: 0, invalidTokens: 0 } as never)
    process.env.PUSH_ADMIN_KEY = "k-secret"
    process.env.PUSH_ADMIN_EMAILS = ADMIN
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  function authed() {
    vi.mocked(requireUser).mockResolvedValue({ user: MOCK_USER, response: null } as never)
  }
  function anonymous() {
    vi.mocked(requireUser).mockResolvedValue({ user: null, response: new Response(JSON.stringify({ error: "No autenticado" }), { status: 401 }) } as never)
  }

  it("denies anonymous callers (401)", async () => {
    anonymous()
    const res = await POST(jsonRequest({ title: "t", message: "m" }))
    expect(res.status).toBe(401)
    expect(sendBroadcast).not.toHaveBeenCalled()
  })

  it("denies a non-admin authenticated user (403)", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: { ...MOCK_USER, email: "worker@mail.com" }, response: null } as never)
    const res = await POST(jsonRequest({ title: "t", message: "m" }))
    expect(res.status).toBe(403)
    expect(sendBroadcast).not.toHaveBeenCalled()
  })

  it("denies admin with a wrong admin key (403)", async () => {
    authed()
    const res = await POST(jsonRequest({ title: "t", message: "m" }, { "x-push-admin-key": "wrong" }))
    expect(res.status).toBe(403)
    expect(sendBroadcast).not.toHaveBeenCalled()
  })

  it("fails closed (503) when unconfigured", async () => {
    authed()
    delete process.env.PUSH_ADMIN_KEY
    const res = await POST(jsonRequest({ title: "t", message: "m" }))
    expect(res.status).toBe(503)
  })

  it("rejects a body larger than the size guard (413)", async () => {
    authed()
    const res = await POST(jsonRequest({ title: "t", message: "m", junk: "x".repeat(64 * 1024) }))
    // 64KB body → 413 (content-length guard); not even parsed.
    expect(res.status).toBe(413)
    expect(sendBroadcast).not.toHaveBeenCalled()
  })

  it("rejects an invalid body (400) without sending", async () => {
    authed()
    const res = await POST(jsonRequest({ message: "m" })) // missing title
    expect(res.status).toBe(400)
    expect(sendBroadcast).not.toHaveBeenCalled()
  })

  it("rejects an external destination (400)", async () => {
    authed()
    const res = await POST(jsonRequest({ title: "t", message: "m", destination: "https://evil.example.com" }))
    expect(res.status).toBe(400)
    expect(sendBroadcast).not.toHaveBeenCalled()
  })

  it("broadcasts to every device when no userIds", async () => {
    authed()
    const res = await POST(jsonRequest({ title: "Anuncio", message: "Hola", category: "IMPORTANT_ALERT" }))
    expect(res.status).toBe(200)
    expect(sendBroadcast).toHaveBeenCalledTimes(1)
    expect(sendToUser).not.toHaveBeenCalled()
  })

  it("sends to a single user (UUID) and to a batch", async () => {
    authed()
    const id = "11111111-1111-4111-8111-111111111111"
    const res1 = await POST(jsonRequest({ title: "t", message: "m", userIds: [id] }))
    expect(res1.status).toBe(200)
    expect(sendToUser).toHaveBeenCalledWith(id, expect.objectContaining({ type: "GENERAL" }))

    const id2 = "22222222-2222-4222-8222-222222222222"
    const res2 = await POST(jsonRequest({ title: "t", message: "m", userIds: [id, id2] }))
    expect(res2.status).toBe(200)
    expect(sendToUsers).toHaveBeenCalledTimes(1)
  })

  it("rejects userIds that are not UUIDs", async () => {
    authed()
    const res = await POST(jsonRequest({ title: "t", message: "m", userIds: ["member@x", "member@y"] }))
    expect(res.status).toBe(400)
    expect(sendToUsers).not.toHaveBeenCalled()
  })

  it("sets Cache-Control private, no-store", async () => {
    authed()
    const res = await POST(jsonRequest({ title: "t", message: "m" }))
    expect(res.headers.get("Cache-Control")).toContain("private, no-store")
  })
})
