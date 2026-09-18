import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"

vi.mock("@/shared/server/auth/require-user", () => ({ requireUser: vi.fn() }))
vi.mock("@/shared/server/admin/require-platform-admin", () => ({ requirePlatformAdmin: vi.fn() }))
vi.mock("@/features/admin-users/services/admin-users-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/admin-users/services/admin-users-service")>()
  return {
    ...actual,
    getAdminUserDetail: vi.fn(),
    changeUserRole: vi.fn(),
    setUnionMembership: vi.fn(),
    suspendUser: vi.fn(),
    reactivateUser: vi.fn(),
    trashUser: vi.fn(),
    restoreUser: vi.fn(),
    revokeUserSessions: vi.fn(),
    purgeUser: vi.fn(),
    resendConfirmationEmail: vi.fn(),
    startPasswordRecovery: vi.fn(),
    auditRejectedAttempt: vi.fn(),
  }
})

import { GET as getDetail } from "../route"
import { POST as postRole } from "../role/route"
import { POST as postUnionRole } from "../union-role/route"
import { POST as postSuspend } from "../suspend/route"
import { POST as postTrash } from "../trash/route"
import { POST as postPurge } from "../purge/route"
import { POST as postRevokeSessions } from "../sessions/revoke/route"
import { POST as postResend } from "../resend-confirmation/route"
import { POST as postRecovery } from "../password-recovery/route"
import { requireUser } from "@/shared/server/auth/require-user"
import { requirePlatformAdmin } from "@/shared/server/admin/require-platform-admin"
import {
  AdminUsersError,
  auditRejectedAttempt,
  changeUserRole,
  getAdminUserDetail,
  purgeUser,
  resendConfirmationEmail,
  revokeUserSessions,
  setUnionMembership,
  startPasswordRecovery,
  suspendUser,
  trashUser,
} from "@/features/admin-users/services/admin-users-service"

const TARGET = "11111111-1111-4111-8111-111111111111"

const ADMIN = {
  id: "admin-1",
  email: "admin@test.local",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
} as User

function context(id = TARGET) {
  return { params: Promise.resolve({ id }) }
}

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/admin/users/${TARGET}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function allowAdmin() {
  vi.mocked(requireUser).mockResolvedValue({ user: ADMIN, response: null } as never)
  vi.mocked(requirePlatformAdmin).mockResolvedValue({ user: ADMIN, response: null } as never)
}

describe("rutas de mutación /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    allowAdmin()
  })

  it("GET detalle: 400 con identificador inválido", async () => {
    const response = await getDetail(new NextRequest("http://localhost"), context("not-a-uuid"))
    expect(response.status).toBe(400)
    expect(getAdminUserDetail).not.toHaveBeenCalled()
  })

  it("GET detalle: 404 si la cuenta no existe", async () => {
    vi.mocked(getAdminUserDetail).mockResolvedValue(null)
    const response = await getDetail(new NextRequest("http://localhost"), context())
    expect(response.status).toBe(404)
  })

  it("GET detalle: devuelve la ficha con cache privada", async () => {
    vi.mocked(getAdminUserDetail).mockResolvedValue({ user: { id: TARGET } } as never)
    const response = await getDetail(new NextRequest("http://localhost"), context())
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toContain("private, no-store")
  })

  it("rol: rechaza cuerpos inválidos sin llamar al servicio", async () => {
    const response = await postRole(jsonRequest({ role: "super_admin", reason: "x" }), context())
    expect(response.status).toBe(400)
    expect(changeUserRole).not.toHaveBeenCalled()
  })

  it("rol: valida motivo mínimo y delega el cambio", async () => {
    vi.mocked(changeUserRole).mockResolvedValue({ ok: true } as never)
    const response = await postRole(jsonRequest({ role: "admin", reason: "ascenso aprobado" }), context())
    expect(response.status).toBe(200)
    expect(changeUserRole).toHaveBeenCalledWith("admin-1", TARGET, "admin", "ascenso aprobado")
  })

  it("rol: audita el intento rechazado del último administrador", async () => {
    vi.mocked(changeUserRole).mockRejectedValue(
      new AdminUsersError("last_admin", "Operación bloqueada: es la última cuenta administradora con acceso total.", 409),
    )
    const response = await postRole(jsonRequest({ role: "user", reason: "intento de autodegradacion" }), context())
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.code).toBe("last_admin")
    expect(auditRejectedAttempt).toHaveBeenCalledWith(
      { actorId: "admin-1", targetId: TARGET },
      "user.role_change",
      expect.objectContaining({ code: "last_admin" }),
      "intento de autodegradacion",
    )
  })

  it("suspensión: exige fecha futura para la modalidad temporal", async () => {
    const response = await postSuspend(
      jsonRequest({ kind: "temporary", endsAt: "2020-01-01T00:00:00.000Z", reason: "prueba temporal" }),
      context(),
    )
    expect(response.status).toBe(400)
    expect(suspendUser).not.toHaveBeenCalled()
  })

  it("suspensión: exige motivo y pasa la fecha ISO al servicio", async () => {
    vi.mocked(suspendUser).mockResolvedValue({ ok: true, authSync: "ok" } as never)
    const endsAt = new Date(Date.now() + 86_400_000).toISOString()
    const response = await postSuspend(
      jsonRequest({ kind: "temporary", endsAt, reason: "suspension temporal aprobada" }),
      context(),
    )
    expect(response.status).toBe(200)
    expect(suspendUser).toHaveBeenCalledWith("admin-1", TARGET, "temporary", endsAt, "suspension temporal aprobada")
  })

  it("suspensión: propagar self_target_forbidden y auditarlo", async () => {
    vi.mocked(suspendUser).mockRejectedValue(
      new AdminUsersError("self_target_forbidden", "No puedes aplicar esta acción sobre tu propia cuenta.", 409),
    )
    const response = await postSuspend(
      jsonRequest({ kind: "indefinite", reason: "intento propio" }),
      context(),
    )
    expect(response.status).toBe(409)
    expect(auditRejectedAttempt).toHaveBeenCalledWith(
      { actorId: "admin-1", targetId: TARGET },
      "user.suspend",
      expect.objectContaining({ code: "self_target_forbidden" }),
      "intento propio",
    )
  })

  it("papelera: delega el envío recuperable", async () => {
    vi.mocked(trashUser).mockResolvedValue({ ok: true, authSync: "ok" } as never)
    const response = await postTrash(jsonRequest({ reason: "cuenta duplicada" }), context())
    expect(response.status).toBe(200)
    expect(trashUser).toHaveBeenCalledWith("admin-1", TARGET, "cuenta duplicada")
  })

  it("purga: bloqueada por defecto y auditada", async () => {
    vi.mocked(purgeUser).mockRejectedValue(
      new AdminUsersError("purge_disabled", "La eliminación definitiva está deshabilitada.", 403),
    )
    const response = await postPurge(
      jsonRequest({ confirmEmail: "worker@test.local", reason: "purga solicitada" }),
      context(),
    )
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe("purge_disabled")
    expect(auditRejectedAttempt).toHaveBeenCalled()
  })

  it("purga: exige un correo con formato válido", async () => {
    const response = await postPurge(jsonRequest({ confirmEmail: "no-es-correo", reason: "purga" }), context())
    expect(response.status).toBe(400)
    expect(purgeUser).not.toHaveBeenCalled()
  })

  it("sesiones: delega el cierre de sesiones", async () => {
    vi.mocked(revokeUserSessions).mockResolvedValue({ ok: true, message: "cerradas" } as never)
    const response = await postRevokeSessions(jsonRequest({ reason: "incidente de seguridad" }), context())
    expect(response.status).toBe(200)
    expect(revokeUserSessions).toHaveBeenCalledWith("admin-1", TARGET, "incidente de seguridad")
  })

  it("rol sindical: valida delegación, rol y motivo antes de delegar", async () => {
    const invalid = await postUnionRole(
      jsonRequest({ delegationId: "no-uuid", role: "union_admin", active: true, reason: "alta" }),
      context(),
    )
    expect(invalid.status).toBe(400)
    expect(setUnionMembership).not.toHaveBeenCalled()

    vi.mocked(setUnionMembership).mockResolvedValue({ ok: true, message: "habilitado" } as never)
    const response = await postUnionRole(
      jsonRequest({
        delegationId: "22222222-2222-4222-8222-222222222222",
        role: "union_admin",
        active: true,
        reason: "alta de rol sindical",
      }),
      context(),
    )
    expect(response.status).toBe(200)
    expect(setUnionMembership).toHaveBeenCalledWith(
      "admin-1",
      TARGET,
      "22222222-2222-4222-8222-222222222222",
      "union_admin",
      true,
      "alta de rol sindical",
    )
  })

  it("rol sindical: propaga delegación inexistente sin inventar el estado", async () => {
    vi.mocked(setUnionMembership).mockRejectedValue(
      new AdminUsersError("not_found", "La delegación sindical no existe o está inactiva.", 404),
    )
    const response = await postUnionRole(
      jsonRequest({
        delegationId: "33333333-3333-4333-8333-333333333333",
        role: "union_rep",
        active: true,
        reason: "delegacion invalida",
      }),
      context(),
    )
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.code).toBe("not_found")
    expect(setUnionMembership).toHaveBeenCalledTimes(1)
  })

  it("rol sindical: exige privilegio de plataforma (403 sin rol admin)", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: "No autorizado", code: "forbidden" }), { status: 403 }),
    } as never)

    const response = await postUnionRole(
      jsonRequest({
        delegationId: "22222222-2222-4222-8222-222222222222",
        role: "union_rep",
        active: true,
        reason: "sin privilegio",
      }),
      context(),
    )
    expect(response.status).toBe(403)
    expect(setUnionMembership).not.toHaveBeenCalled()
  })

  it("confirmación: solo disponible para administradores (403 sin privilegio)", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      user: null,
      response: new Response(JSON.stringify({ error: "No autorizado", code: "forbidden" }), { status: 403 }),
    } as never)

    const response = await postResend(jsonRequest({}), context())
    expect(response.status).toBe(403)
    expect(resendConfirmationEmail).not.toHaveBeenCalled()
  })

  it("confirmación y recuperación: usan los flujos oficiales del servicio", async () => {
    vi.mocked(resendConfirmationEmail).mockResolvedValue({ ok: true } as never)
    vi.mocked(startPasswordRecovery).mockResolvedValue({ ok: true } as never)

    expect((await postResend(jsonRequest({}), context())).status).toBe(200)
    expect(resendConfirmationEmail).toHaveBeenCalledWith("admin-1", TARGET)

    expect((await postRecovery(jsonRequest({}), context())).status).toBe(200)
    expect(startPasswordRecovery).toHaveBeenCalledWith("admin-1", TARGET)
  })
})
