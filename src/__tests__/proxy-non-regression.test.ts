import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }))

vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }))

import { proxy } from "@/proxy"

/**
 * No-regresión transversal del proxy: la verificación de suspensión/papelera
 * no debe alterar el paso de usuarios activos (normales, sindicales y admin).
 * La autorización sindical y administrativa vive en layouts/rutas/RPC; el
 * proxy solo clasifica y bloquea cuentas suspendidas o en papelera.
 */

function activeUserClient(userId = "user-1") {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } }, error: null })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
  }
}

function request(path: string): NextRequest {
  return new NextRequest(`https://example.com${path}`)
}

describe("proxy — no regresión para cuentas activas", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    mocks.createServerClient.mockReturnValue(activeUserClient())
  })

  it.each([
    "/",
    "/calculadoras",
    "/profile",
    "/profile/mi-informacion-laboral",
    "/guia",
    "/vacaciones",
    "/documentos-personales",
    "/agenda",
    "/representacion",
    "/representacion/trabajadores",
    "/representacion/licencias",
    "/representacion/lockers",
    "/admin",
    "/admin/usuarios",
    "/admin/usuarios/auditoria",
  ])("permite navegar a %s sin redirigir a /cuenta-suspendida", async (path) => {
    const response = await proxy(request(path))
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.headers.get("location")).toBeNull()
  })

  it.each([
    "/api/consulta",
    "/api/worker-context",
    "/api/tarjeton/confirm",
    "/api/union/workers",
    "/api/union/lockers",
    "/api/union/licenses",
    "/api/admin/users",
    "/api/admin/audit-log",
  ])("permite la API %s (la autorización fina vive en cada ruta)", async (path) => {
    const response = await proxy(request(path))
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.status).not.toBe(403)
  })

  it("consulta el estado de cuenta exactamente una vez por request", async () => {
    await proxy(request("/calculadoras"))
    const client = mocks.createServerClient.mock.results[0].value as ReturnType<typeof activeUserClient>
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(client.from).toHaveBeenCalledWith("user_admin_status")
  })

  it("no bloquea a un administrador activo", async () => {
    mocks.createServerClient.mockReturnValue(activeUserClient("admin-1"))
    const response = await proxy(request("/admin/usuarios"))
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("no bloquea a un representante sindical activo en su área", async () => {
    mocks.createServerClient.mockReturnValue(activeUserClient("union-rep-1"))
    const response = await proxy(request("/representacion/trabajadores"))
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })
})
