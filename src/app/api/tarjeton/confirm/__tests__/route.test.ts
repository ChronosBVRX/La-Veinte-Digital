import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => {
  const rpc = vi.fn()
  const from = vi.fn()
  const confirmTarjetonService = vi.fn()
  const requireUser = vi.fn()
  return { rpc, from, confirmTarjetonService, requireUser }
})

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mocks.rpc, from: mocks.from })),
}))
vi.mock("@/shared/server/auth/require-user", () => ({ requireUser: mocks.requireUser }))
vi.mock("@/features/tarjeton/services/confirm-tarjeton", () => ({
  confirmTarjetonService: mocks.confirmTarjetonService,
}))

import { POST } from "@/app/api/tarjeton/confirm/route"

function request(body: unknown = { schemaVersion: "1.0" }) {
  return new NextRequest("https://la20.com.mx/api/tarjeton/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function authedUser(id = "user-ordinary-uuid") {
  mocks.requireUser.mockResolvedValue({ user: { id }, response: null })
}

describe("POST /api/tarjeton/confirm — bootstrap de perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rpc.mockResolvedValue({ data: true, error: null })
  })

  it("sin sesión conserva 401 y no inicializa ni confirma", async () => {
    const { NextResponse } = await import("next/server")
    mocks.requireUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    })

    const res = await POST(request())

    expect(res.status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.confirmTarjetonService).not.toHaveBeenCalled()
  })

  it("usuario ordinario ejecuta ensure_profile_exists ANTES de confirmar", async () => {
    authedUser()
    const callOrder: string[] = []
    mocks.rpc.mockImplementation(async (fn: string) => {
      callOrder.push(`rpc:${fn}`)
      return { data: true, error: null }
    })
    mocks.confirmTarjetonService.mockImplementation(async () => {
      callOrder.push("confirm")
      return { ok: true, data: { schemaVersion: "1.0", id: "payslip-1", duplicate: false } }
    })

    const res = await POST(request())

    expect(res.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith("ensure_profile_exists")
    expect(callOrder).toEqual(["rpc:ensure_profile_exists", "confirm"])
    // El servicio recibe la identidad autenticada, nunca un rol.
    expect(mocks.confirmTarjetonService).toHaveBeenCalledTimes(1)
    const deps = mocks.confirmTarjetonService.mock.calls[0][0]
    expect(deps.userId).toBe("user-ordinary-uuid")
    expect(deps).not.toHaveProperty("role")
  })

  it("si ensure_profile_exists falla: 500, no confirma y no filtra detalles internos", async () => {
    authedUser()
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42P01", message: "relation public.profiles does not exist", details: "detail", hint: "hint" },
    })

    const res = await POST(request())
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(mocks.confirmTarjetonService).not.toHaveBeenCalled()
    expect(body.error).toBe("No se pudo preparar tu perfil para guardar el tarjetón.")
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain("42P01")
    expect(serialized).not.toContain("profiles")
    expect(serialized).not.toContain("detail")
    expect(serialized).not.toContain("hint")
  })

  it("no consulta roles (no usa .from ni condiciona por rol)", async () => {
    authedUser()
    mocks.confirmTarjetonService.mockResolvedValue({
      ok: true,
      data: { schemaVersion: "1.0", id: "payslip-1", duplicate: false },
    })

    await POST(request())

    expect(mocks.from).not.toHaveBeenCalled()
  })

  it("propaga la confirmación idempotente sin alterar su resultado", async () => {
    authedUser()
    mocks.confirmTarjetonService.mockResolvedValue({
      ok: true,
      data: { schemaVersion: "1.0", id: "payslip-1", duplicate: true, warnings: [] },
    })

    const res = await POST(request())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.duplicate).toBe(true)
    expect(body.id).toBe("payslip-1")
  })
})
