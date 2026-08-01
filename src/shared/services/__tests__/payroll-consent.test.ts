import { describe, it, expect, vi } from "vitest"
import {
  fetchPayrollConsent,
  grantPayrollConsent,
  revokePayrollConsent,
  type PayrollConsentDeps,
} from "../payroll-consent"

type ChainResult = { data: unknown; error: unknown }

function makeClient(result: () => ChainResult) {
  const maybeSingle = vi.fn(result)
  const selectEq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq: selectEq }))
  const updateEq = vi.fn(result)
  const update = vi.fn(() => ({ eq: updateEq }))
  const upsert = vi.fn(result)
  const from = vi.fn((table: string) => {
    if (table === "payroll_contexts") return { select, upsert, update }
    throw new Error(`tabla inesperada: ${table}`)
  })
  const getUser = vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }))
  const client = { from, auth: { getUser } } as unknown as PayrollConsentDeps["client"]
  return { client, from, select, selectEq, maybeSingle, upsert, update, updateEq, getUser }
}

function deps(result: () => ChainResult): PayrollConsentDeps {
  const { client } = makeClient(result)
  return { client, user: { id: "user-1" } }
}

describe("payroll-consent", () => {
  it("fetchPayrollConsent devuelve true cuando consent_given es true", async () => {
    const d = deps(() => ({ data: { consent_given: true }, error: null }))
    await expect(fetchPayrollConsent(d)).resolves.toBe(true)
  })

  it("fetchPayrollConsent devuelve false sin fila o sin consentimiento", async () => {
    await expect(fetchPayrollConsent(deps(() => ({ data: null, error: null })))).resolves.toBe(false)
    await expect(fetchPayrollConsent(deps(() => ({ data: { consent_given: false }, error: null })))).resolves.toBe(false)
  })

  it("fetchPayrollConsent propaga errores de lectura", async () => {
    const d = deps(() => ({ data: null, error: new Error("read failed") }))
    await expect(fetchPayrollConsent(d)).rejects.toThrow("read failed")
  })

  it("grantPayrollConsent hace upsert con consentimiento y fecha", async () => {
    const { client, upsert } = makeClient(() => ({ data: null, error: null }))
    const d: PayrollConsentDeps = { client, user: { id: "user-1" } }
    await grantPayrollConsent(d)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        consent_given: true,
        consent_given_at: expect.any(String),
      }),
      { onConflict: "user_id" }
    )
  })

  it("grantPayrollConsent propaga errores de escritura", async () => {
    const d = deps(() => ({ data: null, error: new Error("write failed") }))
    await expect(grantPayrollConsent(d)).rejects.toThrow("write failed")
  })

  it("revokePayrollConsent actualiza a false y limpia la fecha", async () => {
    const { client, update, updateEq } = makeClient(() => ({ data: null, error: null }))
    const d: PayrollConsentDeps = { client, user: { id: "user-1" } }
    await revokePayrollConsent(d)
    expect(update).toHaveBeenCalledWith({ consent_given: false, consent_given_at: null })
    expect(updateEq).toHaveBeenCalledWith("user_id", "user-1")
  })

  it("revokePayrollConsent propaga errores", async () => {
    const d = deps(() => ({ data: null, error: new Error("revoke failed") }))
    try {
      await revokePayrollConsent(d)
      expect.unreachable("debió rechazar")
    } catch (err) {
      expect((err as Error).message).toBe("revoke failed")
    }
  })
})
