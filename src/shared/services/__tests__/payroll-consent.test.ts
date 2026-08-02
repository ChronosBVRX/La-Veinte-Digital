import { describe, it, expect, vi } from "vitest"
import {
  fetchPayrollConsent,
  grantPayrollConsent,
  revokePayrollConsent,
  deletePayrollDataRemote,
  savePayrollProfileRemote,
  type PayrollConsentDeps,
} from "../payroll-consent"
import type { EmployeePayrollProfile } from "@/features/nomina/lib/types"

type ChainResult = { data: unknown; error: unknown }

function makeClient(result: () => ChainResult) {
  const maybeSingle = vi.fn(result)
  const selectEq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq: selectEq }))
  const updateEq = vi.fn(result)
  const update = vi.fn(() => ({ eq: updateEq }))
  const upsert = vi.fn(result)
  const deleteEq = vi.fn(result)
  const del = vi.fn(() => ({ eq: deleteEq }))
  const from = vi.fn((table: string) => {
    if (table === "payroll_contexts") return { select, upsert, update, delete: del }
    if (table === "imported_payslips") return { delete: del }
    throw new Error(`tabla inesperada: ${table}`)
  })
  const rpc = vi.fn(result)
  const getUser = vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }))
  const client = { from, rpc, auth: { getUser } } as unknown as PayrollConsentDeps["client"]
  return { client, from, rpc, select, selectEq, maybeSingle, upsert, update, updateEq, getUser, del, deleteEq }
}

function deps(result: () => ChainResult): PayrollConsentDeps {
  const { client } = makeClient(result)
  return { client, user: { id: "user-1" } }
}

function profile(overrides: Partial<EmployeePayrollProfile> = {}): EmployeePayrollProfile {
  return {
    id: "profile-1",
    userId: "user-1",
    consentGiven: true,
    categoryId: "cat-1",
    categoryCode: "C01",
    categoryName: "TECNICO RADIOLOGO 80",
    workdayHours: 8,
    employmentType: "base",
    occupationalConditions: [{ type: "radiation_non_medical", enabled: true }],
    facts: [{ key: "has_discontinuous_schedule", value: false, source: "user", confidence: 0.8, updatedAt: "2026-01-01T00:00:00Z" }],
    recurringConcepts: [],
    siapConceptMarks: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
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

  it("deletePayrollDataRemote borra todo en un solo RPC atómico", async () => {
    const { client, rpc, from } = makeClient(() => ({ data: null, error: null }))
    const d: PayrollConsentDeps = { client, user: { id: "user-1" } }
    await deletePayrollDataRemote(d)
    expect(rpc).toHaveBeenCalledWith("erase_user_payroll_data")
    expect(from).not.toHaveBeenCalled()
  })

  it("deletePayrollDataRemote propaga errores del RPC sin borrado parcial", async () => {
    const d = deps(() => ({ data: null, error: new Error("erase failed") }))
    await expect(deletePayrollDataRemote(d)).rejects.toThrow("erase failed")
  })

  it("savePayrollProfileRemote sincroniza el perfil al servidor", async () => {
    const { client, upsert } = makeClient(() => ({ data: null, error: null }))
    const d: PayrollConsentDeps = { client, user: { id: "user-1" } }
    await savePayrollProfileRemote(profile(), d)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        consent_given: true,
        category_id: "cat-1",
        category_code: "C01",
        category_name: "TECNICO RADIOLOGO 80",
        workday_hours: 8,
        employment_type: "base",
        occupational_conditions: expect.any(Array),
        payroll_facts: expect.any(Array),
        recurring_concepts: expect.any(Array),
        siap_concept_marks: expect.any(Array),
        updated_at: expect.any(String),
      }),
      { onConflict: "user_id" }
    )
  })

  it("savePayrollProfileRemote usa null cuando el perfil no tiene datos opcionales", async () => {
    const { client, upsert } = makeClient(() => ({ data: null, error: null }))
    const d: PayrollConsentDeps = { client, user: { id: "user-1" } }
    await savePayrollProfileRemote(profile({ categoryId: undefined, effectiveSeniorityDate: undefined }), d)
    const payload = (upsert as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(payload.category_id).toBeNull()
    expect(payload.effective_seniority_date).toBeNull()
  })

  it("savePayrollProfileRemote propaga errores de escritura", async () => {
    const d = deps(() => ({ data: null, error: new Error("sync failed") }))
    await expect(savePayrollProfileRemote(profile(), d)).rejects.toThrow("sync failed")
  })
})
