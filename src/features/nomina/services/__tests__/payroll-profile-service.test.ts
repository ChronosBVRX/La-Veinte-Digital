import { describe, expect, it, vi, beforeEach } from "vitest"
import { saveProfileToSupabase } from "../payroll-profile-service"
import type { EmployeePayrollProfile } from "../../lib/types"

type ChainResult = { data: unknown; error: unknown }

function makeClient(
  rpcResult?: () => ChainResult,
  updateResult?: () => ChainResult
) {
  const ok = () => ({ data: null, error: null })
  const updateEq = vi.fn(updateResult ?? ok)
  const update = vi.fn(() => ({ eq: updateEq }))
  const from = vi.fn((table: string) => {
    if (table === "profiles") return { update }
    throw new Error(`tabla inesperada: ${table}`)
  })
  const rpc = vi.fn(rpcResult ?? ok)
  const getUser = vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }))
  const client = { from, rpc, auth: { getUser } } as unknown as ReturnType<
    typeof import("@/lib/supabase/client").createClient
  >
  return { client, from, update, updateEq, rpc, getUser }
}

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))

import { createClient } from "@/lib/supabase/client"

const mockCreateClient = vi.mocked(createClient)

function profile(overrides: Partial<EmployeePayrollProfile> = {}): EmployeePayrollProfile {
  return {
    id: "profile-1",
    userId: "user-1",
    consentGiven: true,
    categoryName: "TECNICO RADIOLOGO 80",
    workdayHours: 8,
    employmentType: "base",
    occupationalConditions: [],
    facts: [],
    siapConceptMarks: [],
    recurringConcepts: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("saveProfileToSupabase", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("ejecuta ensure_profile_exists antes del update", async () => {
    const { client, rpc, update, updateEq } = makeClient(() => ({ data: null, error: null }))
    mockCreateClient.mockReturnValue(client)

    await saveProfileToSupabase(profile())

    expect(rpc).toHaveBeenCalledWith("ensure_profile_exists")
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0])
    expect(updateEq).toHaveBeenCalledWith("id", "user-1")
  })

  it("un error del RPC impide el update", async () => {
    const { client, update } = makeClient(() => ({ data: null, error: new Error("rpc failed") }))
    mockCreateClient.mockReturnValue(client)

    await expect(saveProfileToSupabase(profile())).rejects.toThrow(
      "No se pudo preparar el perfil para escribir."
    )
    expect(update).not.toHaveBeenCalled()
  })

  it("el payload de update solo contiene categoria, sin id ni role", async () => {
    const { client, update } = makeClient(() => ({ data: null, error: null }))
    mockCreateClient.mockReturnValue(client)

    await saveProfileToSupabase(profile())

    const updateMock = update as unknown as { mock: { calls: unknown[][] } }
    const firstCall = updateMock.mock.calls[0]
    const payload = (firstCall?.[0] ?? null) as Record<string, unknown>
    expect(payload).toEqual({ categoria: "TECNICO RADIOLOGO 80" })
    expect(payload).not.toHaveProperty("id")
    expect(payload).not.toHaveProperty("role")
    expect(payload).not.toHaveProperty("created_at")
    expect(payload).not.toHaveProperty("updated_at")
    expect(payload).not.toHaveProperty("is_online")
  })

  it("usa el userId autenticado, no el del objeto del perfil", async () => {
    const { client, updateEq } = makeClient(() => ({ data: null, error: null }))
    mockCreateClient.mockReturnValue(client)

    await saveProfileToSupabase(profile({ userId: "otro-usuario" }))

    expect(updateEq).toHaveBeenCalledWith("id", "user-1")
  })

  it("no escribe en Supabase si no hay sesión", async () => {
    const { client, rpc, update } = makeClient(() => ({ data: null, error: null }))
    ;(client.auth as { getUser: unknown }).getUser = vi.fn(async () => ({
      data: { user: null },
      error: null,
    }))
    mockCreateClient.mockReturnValue(client)

    await saveProfileToSupabase(profile())

    expect(rpc).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it("un error del update se propaga", async () => {
    const { client } = makeClient(undefined, () => ({ data: null, error: new Error("update failed") }))
    mockCreateClient.mockReturnValue(client)

    await expect(saveProfileToSupabase(profile())).rejects.toThrow("update failed")
  })
})
