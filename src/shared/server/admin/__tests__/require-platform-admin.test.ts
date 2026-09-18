import { beforeEach, describe, expect, it, vi } from "vitest"
import type { User } from "@supabase/supabase-js"

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }))

import { requirePlatformAdmin } from "@/shared/server/admin/require-platform-admin"

const ADMIN_USER = {
  id: "00000000-0000-0000-0000-00000000d001",
  email: "admin@test.local",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
} as User

function mockClient(options: {
  user?: User | null
  role?: string | null
  profileError?: boolean
  authError?: boolean
}) {
  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.user ?? null },
        error: options.authError ? new Error("auth failed") : null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: options.role ? { role: options.role } : null,
            error: options.profileError ? new Error("db error") : null,
          })),
        })),
      })),
    })),
  }
  mocks.createClient.mockResolvedValue(client)
  return client
}

describe("requirePlatformAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deniega el acceso sin sesión (403)", async () => {
    mockClient({ user: null })
    const result = await requirePlatformAdmin()
    expect(result.user).toBeNull()
    expect(result.response?.status).toBe(403)
    const body = await result.response?.json()
    expect(body).toEqual({ error: "No autorizado", code: "forbidden" })
  })

  it("deniega a un usuario normal (403)", async () => {
    mockClient({ user: ADMIN_USER, role: "user" })
    const result = await requirePlatformAdmin()
    expect(result.user).toBeNull()
    expect(result.response?.status).toBe(403)
  })

  it("deniega a un representante sindical sin rol de plataforma (union_admin no otorga privilegios globales)", async () => {
    // Los roles sindicales viven en union_members; profiles.role sigue siendo 'user'.
    mockClient({ user: { ...ADMIN_USER, email: "rep@test.local" }, role: "user" })
    const result = await requirePlatformAdmin()
    expect(result.user).toBeNull()
    expect(result.response?.status).toBe(403)
  })

  it("deniega cuando el perfil no se puede leer (fail closed)", async () => {
    mockClient({ user: ADMIN_USER, role: null, profileError: true })
    const result = await requirePlatformAdmin()
    expect(result.user).toBeNull()
    expect(result.response?.status).toBe(403)
  })

  it("permite a un administrador de plataforma", async () => {
    mockClient({ user: ADMIN_USER, role: "admin" })
    const result = await requirePlatformAdmin()
    expect(result.response).toBeNull()
    expect(result.user?.id).toBe(ADMIN_USER.id)
  })

  it("reutiliza el usuario ya resuelto por requireUser sin segunda llamada a Auth", async () => {
    const client = mockClient({ role: "admin" })
    const result = await requirePlatformAdmin(ADMIN_USER)
    expect(result.response).toBeNull()
    expect(client.auth.getUser).not.toHaveBeenCalled()
  })
})
