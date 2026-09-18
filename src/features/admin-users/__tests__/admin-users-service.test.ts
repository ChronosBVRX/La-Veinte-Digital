import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  serverCreateClient: vi.fn(),
  serviceCreateClient: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.serverCreateClient }))
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.serviceCreateClient }))
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" }),
}))

import {
  AdminUsersError,
  changeUserRole,
  getAdminAuditPage,
  getAdminUserDetail,
  getAdminUserMetrics,
  getAdminUsersPage,
  isPermanentDeleteEnabled,
  mapRpcError,
  purgeUser,
  resendConfirmationEmail,
  setUnionMembership,
  suspendUser,
  trashUser,
} from "@/features/admin-users/services/admin-users-service"

type RpcHandler = (fn: string, args: Record<string, unknown>) => { data?: unknown; error?: unknown }

function sessionClient(handlers: { rpc?: RpcHandler; auth?: Record<string, unknown> } = {}) {
  return {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) =>
      handlers.rpc ? handlers.rpc(fn, args) : { data: null, error: null },
    ),
    auth: handlers.auth ?? {},
    from: vi.fn(),
  }
}

function serviceClient(handlers: { rpc?: RpcHandler; updateUser?: () => Promise<unknown> } = {}) {
  const insert = vi.fn(async () => ({ error: null }))
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
  return {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) =>
      handlers.rpc ? handlers.rpc(fn, args) : { data: null, error: null },
    ),
    auth: {
      admin: {
        updateUserById: vi.fn(handlers.updateUser ?? (async () => ({ data: {}, error: null }))),
      },
    },
    from: vi.fn(() => ({ insert, update })),
    __insert: insert,
    __update: update,
  }
}

describe("admin-users-service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"
    delete process.env.ADMIN_PERMANENT_DELETE_ENABLED
  })

  it("mapea el listado paginado y su total", async () => {
    mocks.serverCreateClient.mockResolvedValue(
      sessionClient({
        rpc: () => ({
          data: [
            {
              user_id: "u-1",
              email: "worker@test.local",
              full_name: "Worker",
              matricula: "M-1",
              role: "user",
              account_status: "active",
              suspension_kind: null,
              suspension_ends_at: null,
              email_confirmed: true,
              registered_at: "2026-01-01T00:00:00.000Z",
              last_sign_in_at: null,
              providers: ["email"],
              profile_complete: true,
              total_count: 42,
            },
          ],
          error: null,
        }),
      }),
    )

    const page = await getAdminUsersPage({ sort: "created_at", direction: "desc", page: 2, pageSize: 25 })
    expect(page.total).toBe(42)
    expect(page.page).toBe(2)
    expect(page.users[0]).toMatchObject({
      id: "u-1",
      email: "worker@test.local",
      role: "user",
      accountStatus: "active",
      providers: ["email"],
    })
  })

  it("no expone contenido privado en la ficha (privacidad)", async () => {
    mocks.serverCreateClient.mockResolvedValue(
      sessionClient({
        rpc: (fn) => {
          if (fn === "admin_user_detail") {
            return {
              data: {
                user: {
                  id: "u-1",
                  email: "worker@test.local",
                  fullName: "Worker",
                  role: "user",
                  providers: ["email"],
                },
                status: { accountStatus: "active", rawStatus: "active" },
                union: {
                  memberships: [
                    {
                      id: "m-1",
                      delegationId: "00000000-0000-0000-0000-00000000d001",
                      delegationCode: "XXI",
                      delegationName: "Delegación XXI",
                      role: "union_admin",
                      active: true,
                      createdAt: "2026-09-01T00:00:00.000Z",
                      updatedAt: "2026-09-02T00:00:00.000Z",
                    },
                  ],
                  delegations: [
                    { id: "00000000-0000-0000-0000-00000000d001", code: "XXI", name: "Delegación XXI", active: true },
                  ],
                },
                counts: { payslips: 2, remoteDocuments: 3, hasPayrollContext: true },
                diagnostics: {
                  authentication: "OK",
                  profile: "OK",
                  payslip: "DISPONIBLE",
                  documents: "DISPONIBLE",
                  storage: "OK",
                  lastSyncAt: "2026-09-01T00:00:00.000Z",
                },
                flags: { isSelf: false, canReactivate: false, canRestore: false },
                // Campos que jamás deben salir de la base:
                employee_data: { rfc: "XAXX010101000", curp: "XXXX000000XXXXXX00" },
                imported_payslip_lines: [{ concept: "002", amount: 1000 }],
                encrypted_password: "secret",
                refresh_token: "token",
                fiscal_folio_hash: "hash",
              },
              error: null,
            }
          }
          return { data: [], error: null }
        },
      }),
    )

    const detail = await getAdminUserDetail("u-1")
    expect(detail).not.toBeNull()
    const serialized = JSON.stringify(detail)
    expect(serialized).not.toContain("XAXX010101000")
    expect(serialized).not.toContain("imported_payslip_lines")
    expect(serialized).not.toContain("encrypted_password")
    expect(serialized).not.toContain("refresh_token")
    expect(serialized).not.toContain("fiscal_folio_hash")
    expect(detail?.user.providers).toEqual(["email"])
    expect(detail?.permanentDeleteEnabled).toBe(false)
    expect(detail?.union.memberships[0]).toMatchObject({
      delegationCode: "XXI",
      role: "union_admin",
      active: true,
    })
    expect(detail?.union.delegations[0]).toMatchObject({ code: "XXI", active: true })
  })

  it("parsea métricas reales", async () => {
    mocks.serverCreateClient.mockResolvedValue(
      sessionClient({
        rpc: () => ({
          data: {
            totalUsers: 10,
            activeUsers: 9,
            recentRegistrations: 2,
            pendingEmailConfirmation: 1,
            suspendedAccounts: 1,
            trashedAccounts: 0,
            incompleteProfiles: 4,
            usersWithPayslip: 6,
          },
          error: null,
        }),
      }),
    )

    const metrics = await getAdminUserMetrics()
    expect(metrics).toEqual({
      totalUsers: 10,
      activeUsers: 9,
      recentRegistrations: 2,
      pendingEmailConfirmation: 1,
      suspendedAccounts: 1,
      trashedAccounts: 0,
      incompleteProfiles: 4,
      usersWithPayslip: 6,
    })
  })

  it("mapea la bitácora paginada", async () => {
    mocks.serverCreateClient.mockResolvedValue(
      sessionClient({
        rpc: () => ({
          data: [
            {
              id: "a-1",
              action: "user.suspend",
              entity_id: "u-1",
              target_email: "worker@test.local",
              target_name: "Worker",
              actor_id: "admin-1",
              actor_email: "admin@test.local",
              actor_name: "Admin",
              reason: "prueba",
              previous_value: "active",
              new_value: "suspended",
              request_id: "req-1",
              created_at: "2026-09-01T00:00:00.000Z",
              total_count: 1,
            },
          ],
          error: null,
        }),
      }),
    )

    const page = await getAdminAuditPage({ page: 1, pageSize: 25 })
    expect(page.total).toBe(1)
    expect(page.entries[0]).toMatchObject({ action: "user.suspend", reason: "prueba", requestId: "req-1" })
  })

  it("traduce errores de RPC a códigos estables", () => {
    expect(mapRpcError({ message: "last_admin" }).code).toBe("last_admin")
    expect(mapRpcError({ message: "last_admin" }).status).toBe(409)
    expect(mapRpcError({ message: "self_target_forbidden" }).code).toBe("self_target_forbidden")
    expect(mapRpcError({ message: "blocked_references" }).code).toBe("blocked_references")
    expect(mapRpcError({ message: "email_mismatch" }).status).toBe(400)
    expect(mapRpcError({ message: "Could not find the function public.admin_list_users", code: "PGRST202" }).code).toBe(
      "admin_backend_unavailable",
    )
    expect(mapRpcError(null).code).toBe("service_unavailable")
  })

  it("cambia el rol mediante la RPC de servicio y propaga rechazos", async () => {
    const client = serviceClient({
      rpc: () => ({ data: { current: "admin" }, error: null }),
    })
    mocks.serviceCreateClient.mockReturnValue(client)

    const result = await changeUserRole("admin-1", "u-1", "admin", "ascenso aprobado")
    expect(result.ok).toBe(true)
    expect(client.rpc).toHaveBeenCalledWith(
      "admin_apply_user_role",
      expect.objectContaining({
        p_actor: "admin-1",
        p_target: "u-1",
        p_new_role: "admin",
        p_reason: "ascenso aprobado",
      }),
    )

    mocks.serviceCreateClient.mockReturnValue(
      serviceClient({ rpc: () => ({ data: null, error: { message: "last_admin" } }) }),
    )
    await expect(changeUserRole("admin-1", "admin-1", "user", "autodegradacion")).rejects.toMatchObject({
      code: "last_admin",
      status: 409,
    })
  })

  it("gestiona el rol sindical por RPC de servicio y propaga rechazos", async () => {
    const client = serviceClient({ rpc: () => ({ data: { active: true }, error: null }) })
    mocks.serviceCreateClient.mockReturnValue(client)

    const result = await setUnionMembership(
      "admin-1",
      "u-1",
      "00000000-0000-0000-0000-00000000d001",
      "union_admin",
      true,
      "alta de rol sindical",
    )
    expect(result.ok).toBe(true)
    expect(result.message).toContain("Representación")
    expect(client.rpc).toHaveBeenCalledWith(
      "admin_set_union_membership",
      expect.objectContaining({
        p_actor: "admin-1",
        p_target: "u-1",
        p_role: "union_admin",
        p_active: true,
        p_reason: "alta de rol sindical",
      }),
    )

    mocks.serviceCreateClient.mockReturnValue(
      serviceClient({ rpc: () => ({ data: null, error: { message: "delegation_not_found" } }) }),
    )
    await expect(
      setUnionMembership("admin-1", "u-1", "d-x", "union_rep", false, "retiro"),
    ).rejects.toMatchObject({ code: "not_found", status: 404 })
  })

  it("suspende con baneo temporal calculado en horas", async () => {
    const client = serviceClient()
    mocks.serviceCreateClient.mockReturnValue(client)

    const endsAt = new Date(Date.now() + 3 * 3_600_000 + 30 * 60_000).toISOString()
    const result = await suspendUser("admin-1", "u-1", "temporary", endsAt, "falta grave")
    expect(result).toEqual({ ok: true, authSync: "ok" })

    const updateUser = client.auth.admin.updateUserById
    expect(updateUser).toHaveBeenCalledWith("u-1", { ban_duration: "4h" })
  })

  it("reporta authSync failed sin degradar la operación (sin silencio)", async () => {
    const client = serviceClient({
      updateUser: async () => ({ data: null, error: { message: "auth down" } }),
    })
    mocks.serviceCreateClient.mockReturnValue(client)

    const result = await suspendUser("admin-1", "u-1", "indefinite", null, "suspension indefinida")
    expect(result).toEqual({ ok: true, authSync: "failed" })
    expect(client.__insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.auth_sync_failed" }),
    )
  })

  it("la purga está deshabilitada por defecto y solo procede con la bandera explícita", async () => {
    expect(isPermanentDeleteEnabled()).toBe(false)
    await expect(purgeUser("admin-1", "u-1", "user@test.local", "purga")).rejects.toMatchObject({
      code: "purge_disabled",
      status: 403,
    })

    process.env.ADMIN_PERMANENT_DELETE_ENABLED = "true"
    expect(isPermanentDeleteEnabled()).toBe(true)

    const client = serviceClient({ rpc: () => ({ data: { purged: true }, error: null }) })
    mocks.serviceCreateClient.mockReturnValue(client)
    const result = await purgeUser("admin-1", "u-1", "user@test.local", "purga aprobada")
    expect(result.ok).toBe(true)
    expect(client.rpc).toHaveBeenCalledWith(
      "admin_purge_user",
      expect.objectContaining({ p_confirm_email: "user@test.local" }),
    )
  })

  it("reenvía la confirmación con el flujo oficial y audita la acción", async () => {
    const resend = vi.fn(async () => ({ error: null }))
    const service = serviceClient()
    mocks.serviceCreateClient.mockReturnValue(service)
    mocks.serverCreateClient.mockResolvedValue(
      sessionClient({
        rpc: (fn) => {
          if (fn === "admin_user_detail") {
            return { data: { user: { id: "u-1", email: "worker@test.local", providers: [], role: "user" }, status: {}, counts: {}, diagnostics: {}, flags: {} }, error: null }
          }
          return { data: [], error: null }
        },
        auth: { resend },
      }),
    )

    const result = await resendConfirmationEmail("admin-1", "u-1")
    expect(result.ok).toBe(true)
    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: "worker@test.local",
      options: { emailRedirectTo: "http://localhost:3000/callback" },
    })
    expect(service.__insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.resend_confirmation", entity_id: "u-1" }),
    )
  })

  it("devuelve not_found si la cuenta objetivo no existe al enviar correo", async () => {
    mocks.serverCreateClient.mockResolvedValue(
      sessionClient({ rpc: () => ({ data: null, error: null }) }),
    )
    mocks.serviceCreateClient.mockReturnValue(serviceClient())

    await expect(resendConfirmationEmail("admin-1", "missing")).rejects.toBeInstanceOf(AdminUsersError)
  })

  it("trash aplica baneo indefinido para bloquear de inmediato", async () => {
    const client = serviceClient()
    mocks.serviceCreateClient.mockReturnValue(client)

    const result = await trashUser("admin-1", "u-1", "cuenta duplicada")
    expect(result).toEqual({ ok: true, authSync: "ok" })
    expect(client.auth.admin.updateUserById).toHaveBeenCalledWith("u-1", { ban_duration: "876000h" })
  })
})
