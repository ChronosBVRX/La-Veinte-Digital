import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }))

vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }))

import { proxy } from "@/proxy"

interface MockOptions {
  user?: { id: string } | null
  status?: Record<string, unknown> | null
  statusError?: { message: string } | null
}

function clientMock(options: MockOptions) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user ?? null }, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: options.status ?? null,
            error: options.statusError ?? null,
          })),
        })),
      })),
    })),
  }
}

function request(path: string, method = "GET"): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method })
}

describe("proxy — suspensión y papelera", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
  })

  it("mantiene el bloqueo de APIs desconocidas (404)", async () => {
    const response = await proxy(request("/api/admin/usuarios-fantasma"))
    expect(response.status).toBe(404)
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it("permite páginas públicas sin consultar sesión", async () => {
    const response = await proxy(request("/cuenta-suspendida"))
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it("exige sesión en APIs autenticadas (401)", async () => {
    mocks.createServerClient.mockReturnValue(clientMock({ user: null }))
    const response = await proxy(request("/api/consulta"))
    expect(response.status).toBe(401)
  })

  it.each([
    "/api/admin/users/11111111-1111-4111-8111-111111111111",
    "/api/admin/users/11111111-1111-4111-8111-111111111111/trash",
    "/api/admin/users/11111111-1111-4111-8111-111111111111/role",
    "/api/admin/users/11111111-1111-4111-8111-111111111111/sessions/revoke",
  ])(
    "clasifica la ruta admin dinámica %s como autenticada (401 sin sesión, nunca 404 del proxy)",
    async (pathname) => {
      mocks.createServerClient.mockReturnValue(clientMock({ user: null }))
      const response = await proxy(request(pathname))
      expect(response.status).toBe(401)
    },
  )

  it("mantiene en 404 las formas administrativas no registradas", async () => {
    const response = await proxy(request("/api/admin/users/11111111-1111-4111-8111-111111111111/unknown"))
    expect(response.status).toBe(404)
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it("redirige a /login sin sesión en páginas protegidas", async () => {
    mocks.createServerClient.mockReturnValue(clientMock({ user: null }))
    const response = await proxy(request("/profile"))
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/login")
  })

  it("bloquea con 403 y código estable una cuenta suspendida en APIs", async () => {
    mocks.createServerClient.mockReturnValue(
      clientMock({
        user: { id: "user-1" },
        status: { status: "suspended", suspension_kind: "indefinite", suspension_ends_at: null },
      }),
    )
    const response = await proxy(request("/api/consulta"))
    expect(response.status).toBe(403)
    expect(response.headers.get("Cache-Control")).toContain("no-store")
    const body = await response.json()
    expect(body.code).toBe("account_suspended")
    expect(body.error).toContain("suspendida")
  })

  it("bloquea con código de papelera una cuenta en retención", async () => {
    mocks.createServerClient.mockReturnValue(
      clientMock({
        user: { id: "user-1" },
        status: { status: "trashed", suspension_kind: null, suspension_ends_at: null },
      }),
    )
    const response = await proxy(request("/api/consulta"))
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe("account_trashed")
  })

  it("redirige páginas protegidas al aviso público sin datos internos", async () => {
    mocks.createServerClient.mockReturnValue(
      clientMock({
        user: { id: "user-1" },
        status: { status: "suspended", suspension_kind: "indefinite", suspension_ends_at: null },
      }),
    )
    const response = await proxy(request("/profile"))
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/cuenta-suspendida")
  })

  it("usa 303 en Server Actions (POST) para convertir a GET seguro", async () => {
    mocks.createServerClient.mockReturnValue(
      clientMock({
        user: { id: "user-1" },
        status: { status: "trashed", suspension_kind: null, suspension_ends_at: null },
      }),
    )
    const response = await proxy(request("/profile", "POST"))
    expect(response.status).toBe(303)
  })

  it("permite el paso de una cuenta activa", async () => {
    mocks.createServerClient.mockReturnValue(clientMock({ user: { id: "user-1" }, status: null }))
    const response = await proxy(request("/api/consulta"))
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("libera una suspensión temporal vencida (no bloquea)", async () => {
    mocks.createServerClient.mockReturnValue(
      clientMock({
        user: { id: "user-1" },
        status: {
          status: "suspended",
          suspension_kind: "temporary",
          suspension_ends_at: "2020-01-01T00:00:00.000Z",
        },
      }),
    )
    const response = await proxy(request("/api/consulta"))
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("no rompe la disponibilidad si la lectura del estado falla (fail-open documentado)", async () => {
    mocks.createServerClient.mockReturnValue(
      clientMock({ user: { id: "user-1" }, statusError: { message: "relation does not exist" } }),
    )
    const response = await proxy(request("/api/consulta"))
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })
})
