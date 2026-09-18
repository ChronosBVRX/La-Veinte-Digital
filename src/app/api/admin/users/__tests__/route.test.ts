import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"

vi.mock("@/shared/server/auth/require-user", () => ({ requireUser: vi.fn() }))
vi.mock("@/shared/server/admin/require-platform-admin", () => ({ requirePlatformAdmin: vi.fn() }))
vi.mock("@/features/admin-users/services/admin-users-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/admin-users/services/admin-users-service")>()
  return {
    ...actual,
    getAdminUsersPage: vi.fn(),
    auditRejectedAttempt: vi.fn(),
  }
})

import { GET } from "../route"
import { requireUser } from "@/shared/server/auth/require-user"
import { requirePlatformAdmin } from "@/shared/server/admin/require-platform-admin"
import { getAdminUsersPage } from "@/features/admin-users/services/admin-users-service"

const USER = {
  id: "admin-1",
  email: "admin@test.local",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
} as User

function allowSession() {
  vi.mocked(requireUser).mockResolvedValue({ user: USER, response: null } as never)
  vi.mocked(requirePlatformAdmin).mockResolvedValue({ user: USER, response: null } as never)
}

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("responde 401 sin sesión y no consulta datos", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: "No autenticado", code: "unauthorized" }), { status: 401 }),
    } as never)

    const response = await GET(new NextRequest("http://localhost/api/admin/users"))
    expect(response.status).toBe(401)
    expect(getAdminUsersPage).not.toHaveBeenCalled()
  })

  it("responde 403 a un usuario sin rol admin (no revela datos)", async () => {
    vi.mocked(requireUser).mockResolvedValue({ user: USER, response: null } as never)
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: "No autorizado", code: "forbidden" }), { status: 403 }),
    } as never)

    const response = await GET(new NextRequest("http://localhost/api/admin/users"))
    expect(response.status).toBe(403)
    expect(getAdminUsersPage).not.toHaveBeenCalled()
  })

  it("valida, acota y delega la consulta al servicio", async () => {
    allowSession()
    vi.mocked(getAdminUsersPage).mockResolvedValue({
      users: [],
      total: 0,
      page: 3,
      pageSize: 100,
    } as never)

    const response = await GET(
      new NextRequest(
        "http://localhost/api/admin/users?page=3&pageSize=999&status=trashed&sort=email&direction=asc&search=ana&from=2026-01-01&to=2026-06-30",
      ),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toContain("no-store")
    expect(getAdminUsersPage).toHaveBeenCalledWith({
      search: "ana",
      status: "trashed",
      role: undefined,
      registeredFrom: "2026-01-01",
      registeredTo: "2026-06-30",
      sort: "email",
      direction: "asc",
      page: 3,
      pageSize: 100,
    })
  })

  it("ignora filtros inválidos y usa valores por defecto", async () => {
    allowSession()
    vi.mocked(getAdminUsersPage).mockResolvedValue({ users: [], total: 0, page: 1, pageSize: 25 } as never)

    await GET(new NextRequest("http://localhost/api/admin/users?status=hacked&sort=role&page=-5&from=ayer"))

    expect(getAdminUsersPage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: undefined,
        sort: "created_at",
        direction: "desc",
        page: 1,
        pageSize: 25,
        registeredFrom: undefined,
      }),
    )
  })

  it("devuelve un error estable si el servicio falla", async () => {
    allowSession()
    vi.mocked(getAdminUsersPage).mockRejectedValue(new Error("boom"))

    const response = await GET(new NextRequest("http://localhost/api/admin/users"))
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe("service_unavailable")
  })
})
