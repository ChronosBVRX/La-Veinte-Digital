import { describe, expect, it, vi } from "vitest"
import {
  ACCOUNT_SUSPENDED_MESSAGE,
  ACCOUNT_TRASHED_MESSAGE,
  evaluateAccountAccess,
  loadAccountAccessState,
} from "@/shared/server/admin/account-access"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

const NOW = new Date("2026-09-17T12:00:00.000Z")

describe("evaluateAccountAccess", () => {
  it("considera activa una fila ausente", () => {
    expect(evaluateAccountAccess(null, NOW)).toEqual({ blocked: false, code: null, message: null })
    expect(evaluateAccountAccess(undefined, NOW).blocked).toBe(false)
  })

  it("bloquea una suspensión indefinida con mensaje humano", () => {
    const result = evaluateAccountAccess(
      { status: "suspended", suspension_kind: "indefinite", suspension_ends_at: null },
      NOW,
    )
    expect(result.blocked).toBe(true)
    expect(result.code).toBe("account_suspended")
    expect(result.message).toBe(ACCOUNT_SUSPENDED_MESSAGE)
  })

  it("bloquea una suspensión temporal vigente", () => {
    const result = evaluateAccountAccess(
      { status: "suspended", suspension_kind: "temporary", suspension_ends_at: "2026-09-20T00:00:00.000Z" },
      NOW,
    )
    expect(result.blocked).toBe(true)
    expect(result.code).toBe("account_suspended")
  })

  it("libera una suspensión temporal vencida", () => {
    const result = evaluateAccountAccess(
      { status: "suspended", suspension_kind: "temporary", suspension_ends_at: "2026-09-16T00:00:00.000Z" },
      NOW,
    )
    expect(result.blocked).toBe(false)
  })

  it("bloquea una cuenta en papelera con mensaje específico", () => {
    const result = evaluateAccountAccess({ status: "trashed" }, NOW)
    expect(result.blocked).toBe(true)
    expect(result.code).toBe("account_trashed")
    expect(result.message).toBe(ACCOUNT_TRASHED_MESSAGE)
  })

  it("no bloquea cuentas activas", () => {
    expect(evaluateAccountAccess({ status: "active" }, NOW).blocked).toBe(false)
  })
})

describe("loadAccountAccessState", () => {
  function clientWith(result: { data: unknown; error: unknown }): SupabaseClient<Database> {
    return {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => result),
          })),
        })),
      })),
    } as unknown as SupabaseClient<Database>
  }

  it("lee el estado propio con el cliente de sesión", async () => {
    const state = await loadAccountAccessState(
      clientWith({ data: { status: "suspended", suspension_kind: "indefinite", suspension_ends_at: null }, error: null }),
      "user-1",
    )
    expect(state?.blocked).toBe(true)
  })

  it("retorna null (fail-open documentado) si la consulta falla", async () => {
    const state = await loadAccountAccessState(
      clientWith({ data: null, error: { message: "relation does not exist" } }),
      "user-1",
    )
    expect(state).toBeNull()
  })

  it("retorna null si el cliente no expone la tabla (compatibilidad pre-migración)", async () => {
    const client = {} as unknown as SupabaseClient<Database>
    const state = await loadAccountAccessState(client, "user-1")
    expect(state).toBeNull()
  })
})
