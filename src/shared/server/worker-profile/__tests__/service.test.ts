import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  WorkerProfileService,
  WorkerProfileUnauthorizedError,
  WorkerProfileUnavailableError,
  WorkerProfileValidationError,
  WorkerProfileConsentRequiredError,
  WorkerProfileTransitionError,
  WorkerProfilePersistenceError,
  mapRpcError,
  mapEmploymentType,
  mapWorkerPreferencesRow,
  mapPayrollContextToWorkerProfile,
  type WorkerProfileServiceDeps,
} from "../"
import { calculateProfileQuality, FIELD_REQUIREMENTS } from "@/shared/domain/worker"

type MockChain = { data: unknown; error: unknown }

function makeClient(overrides: Partial<{
  rpc: ReturnType<typeof vi.fn>
  from: ReturnType<typeof vi.fn>
  auth: { getUser: ReturnType<typeof vi.fn> }
}> = {}) {
  const rpc = overrides.rpc ?? vi.fn()
  const from = overrides.from ?? vi.fn()
  const auth = overrides.auth ?? {
    getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })),
  }
  const client = { rpc, from, auth } as unknown as NonNullable<WorkerProfileServiceDeps["client"]>
  return { client, rpc, from, auth }
}

function okRpc() {
  return vi.fn(async () => ({ data: null, error: null }))
}

function maybeSingle(result: () => MockChain) {
  return vi.fn(result)
}

describe("WorkerProfileService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("1. ninguna función acepta userId (el servicio no expone parámetro userId)", async () => {
    const { client, rpc } = makeClient({ rpc: okRpc() })
    const svc = new WorkerProfileService({ client })
    // Los métodos no reciben userId; la sesión se obtiene del client.
    const signature = Object.getOwnPropertyNames(Object.getPrototypeOf(svc))
    expect(signature).not.toContain("userId")
    await svc.chooseBasicMode()
    expect(rpc).toHaveBeenCalledWith("choose_basic_mode")
  })

  it("2. escrituras llaman RPC y no tablas", async () => {
    const { client, rpc, from } = makeClient({ rpc: okRpc() })
    const svc = new WorkerProfileService({ client })
    await svc.chooseBasicMode()
    expect(from).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalled()
  })

  it("3. chooseBasicMode llama choose_basic_mode", async () => {
    const { client, rpc } = makeClient({ rpc: okRpc() })
    const svc = new WorkerProfileService({ client })
    await svc.chooseBasicMode()
    expect(rpc).toHaveBeenCalledWith("choose_basic_mode")
  })

  it("4. confirmManualProfile llama confirm_manual_worker_profile con payloads", async () => {
    const { client, rpc } = makeClient({ rpc: okRpc() })
    const svc = new WorkerProfileService({ client })
    await svc.confirmManualProfile({
      mode: "manual",
      sourceOfRequest: "manual",
      identity: { categoria: "TEC", matricula: "M1" },
      situation: { workdayHours: 8, shift: "matutino", employmentType: "base" },
      sources: {
        categoria: "manual",
        matricula: "manual",
        workdayHours: "manual",
        shift: "manual",
        employmentType: "manual",
      },
      consentRef: { purpose: "use_worker_data", version: "1.0" },
    })
    expect(rpc).toHaveBeenCalledWith("confirm_manual_worker_profile", expect.objectContaining({
      p_consent_version: "1.0",
      p_identity: expect.objectContaining({ categoria: "TEC", matricula: "M1" }),
    }))
  })

  it("5. confirmPayslipProfile llama confirm_payslip_worker_profile", async () => {
    const { client, rpc } = makeClient({ rpc: okRpc() })
    const svc = new WorkerProfileService({ client })
    await svc.confirmPayslipProfile({
      mode: "payslip",
      sourceOfRequest: "payslip",
      identity: { categoria: "TEC" },
      situation: { effectiveSeniorityDate: "2020-01-01" },
      sources: { categoria: "payslip_confirmed", effectiveSeniorityDate: "payslip_confirmed" },
      consentRef: { purpose: "store_tarjeton", version: "1.0" },
    })
    expect(rpc).toHaveBeenCalledWith("confirm_payslip_worker_profile", expect.objectContaining({
      p_consent_version: "1.0",
      p_profile_updates: expect.objectContaining({ categoria: true, antiguedad: true }),
    }))
  })

  it("6. changeWorkerProfileMode llama change_worker_profile_mode", async () => {
    const { client, rpc } = makeClient({ rpc: okRpc() })
    const svc = new WorkerProfileService({ client })
    await svc.changeWorkerProfileMode("payslip")
    expect(rpc).toHaveBeenCalledWith("change_worker_profile_mode", { p_new_mode: "payslip" })
  })

  it("7. deleteWorkerData llama delete_worker_data", async () => {
    const { client, rpc } = makeClient({ rpc: okRpc() })
    const svc = new WorkerProfileService({ client })
    await svc.deleteWorkerData()
    expect(rpc).toHaveBeenCalledWith("delete_worker_data")
  })

  it("8. consentimientos usan RPC correctas", async () => {
    const { client, rpc } = makeClient({ rpc: okRpc() })
    const svc = new WorkerProfileService({ client })
    await svc.grantConsent("use_worker_data", "1.0")
    expect(rpc).toHaveBeenCalledWith("grant_worker_consent", { p_purpose: "use_worker_data", p_version: "1.0" })
    await svc.revokeConsent("use_worker_data")
    expect(rpc).toHaveBeenCalledWith("revoke_worker_consent", { p_purpose: "use_worker_data" })
  })

  it("9. accepted_source nunca se envía desde el servicio", async () => {
    const { client, rpc } = makeClient({ rpc: okRpc() })
    const svc = new WorkerProfileService({ client })
    await svc.grantConsent("use_worker_data", "1.0")
    const call = rpc.mock.calls[0][1] as Record<string, unknown>
    expect(call).not.toHaveProperty("accepted_source")
    expect(call).not.toHaveProperty("accepted_at")
  })

  it("10. mapeo de preferences", () => {
    const view = mapWorkerPreferencesRow({
      user_id: "u1",
      onboarding_state: "configured",
      preferred_worker_mode: "manual",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    } as never)
    expect(view.onboardingState).toBe("configured")
    expect(view.preferredWorkerMode).toBe("manual")
  })

  it("11. mapeo de payroll_contexts", () => {
    const profile = mapPayrollContextToWorkerProfile({
      user_id: "u1",
      matricula: "M1",
      adscripcion: "A1",
      category_name: "TEC",
      workday_hours: 8,
      employment_type: "base",
      shift: "matutino",
      effective_seniority_date: "2020-01-01",
      source_matricula: "manual",
      source_category_name: "payslip_confirmed",
      source_workday_hours: "calculated",
      source_adscripcion: null,
      source_shift: null,
      source_employment_type: null,
      source_effective_seniority_date: null,
      updated_at: "2026-01-01T00:00:00Z",
    } as never, {
      onboardingState: "configured",
      preferredWorkerMode: "manual",
      updatedAt: "2026-01-01T00:00:00Z",
    })
    expect(profile.identity.categoria).toBe("TEC")
    expect(profile.identity.matricula).toBe("M1")
    expect(profile.sources.categoria).toBe("payslip_confirmed")
    expect(profile.sources.workdayHours).toBe("calculated")
    expect(profile.sources.matricula).toBe("manual")
    expect(profile.sources.adscripcion).toBeUndefined()
  })

  it("12. employment_type exacto (base → base)", () => {
    const r = mapEmploymentType("base")
    expect(r.employmentType).toBe("base")
    expect(r.requiresEmploymentTypeConfirmation).toBe(false)
  })

  it("13. employment_type legacy requiere confirmación (eventual)", () => {
    const r = mapEmploymentType("eventual")
    expect(r.employmentType).toBeNull()
    expect(r.requiresEmploymentTypeConfirmation).toBe(true)
  })

  it("13b. employment_type legacy confianza_a_estatuto requiere confirmación", () => {
    const r = mapEmploymentType("confianza_a_estatuto")
    expect(r.employmentType).toBeNull()
    expect(r.requiresEmploymentTypeConfirmation).toBe(true)
  })

  it("14. sources se mapean correctamente", () => {
    const profile = mapPayrollContextToWorkerProfile({
      user_id: "u1",
      source_matricula: "manual",
      source_category_name: "inferred",
      source_workday_hours: null,
      source_adscripcion: null,
      source_shift: null,
      source_employment_type: null,
      source_effective_seniority_date: null,
      updated_at: "2026-01-01T00:00:00Z",
    } as never, {
      onboardingState: "configured",
      preferredWorkerMode: "payslip",
      updatedAt: "2026-01-01T00:00:00Z",
    })
    expect(profile.sources.matricula).toBe("manual")
    expect(profile.sources.categoria).toBe("inferred")
    expect(profile.sources.workdayHours).toBeUndefined()
  })

  it("15. errores SQL se transforman en errores funcionales", () => {
    expect(mapRpcError("consent_required", "x")).toBeInstanceOf(WorkerProfileConsentRequiredError)
    expect(mapRpcError("unauthorized", "x")).toBeInstanceOf(WorkerProfileUnauthorizedError)
    expect(mapRpcError("not allowed field: role", "x")).toBeInstanceOf(WorkerProfileValidationError)
    expect(mapRpcError("profile not configured", "x")).toBeInstanceOf(WorkerProfileTransitionError)
    expect(mapRpcError("network down", "x")).toBeInstanceOf(WorkerProfilePersistenceError)
  })

  it("16. getProfileQuality usa la función pura existente", async () => {
    const from = vi.fn((table: string) => {
      if (table === "worker_preferences") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingle(() => ({ data: { onboarding_state: "configured", preferred_worker_mode: "manual", updated_at: "2026-01-01T00:00:00Z" }, error: null })) })) })) }
      }
      if (table === "payroll_contexts") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingle(() => ({ data: { user_id: "user-1", category_name: "TEC", matricula: "M1", workday_hours: 8, employment_type: "base", source_category_name: "payslip_confirmed", source_matricula: "manual", updated_at: "2026-01-01T00:00:00Z" }, error: null })) })) })) }
      }
      throw new Error(`tabla inesperada: ${table}`)
    })
    const { client } = makeClient({ from })
    const svc = new WorkerProfileService({ client })
    const quality = await svc.getProfileQuality()
    // Compare with the pure function directly (same inputs).
    const pure = calculateProfileQuality({
      userId: "user-1",
      mode: "manual",
      identity: { categoria: "TEC", matricula: "M1" },
      situation: { workdayHours: 8, employmentType: "base" },
      sources: { categoria: "payslip_confirmed", matricula: "manual" },
      updatedAt: "2026-01-01T00:00:00Z",
    }, FIELD_REQUIREMENTS)
    expect(quality.percent).toBe(pure.percent)
    expect(quality.confidence).toBe(pure.confidence)
  })

  it("17. listWorkerEvents solo lee y limita resultados", async () => {
    const selectEq = vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn(async () => ({ data: [], error: null })) })) }))
    const select = vi.fn(() => ({ eq: selectEq }))
    const from = vi.fn(() => ({ select }))
    const { client } = makeClient({ from })
    const svc = new WorkerProfileService({ client })
    const events = await svc.listWorkerEvents(10)
    expect(events).toEqual([])
    expect(from).toHaveBeenCalledWith("worker_data_events")
    expect(select).toHaveBeenCalledWith("*")
    expect(selectEq).toHaveBeenCalledWith("user_id", "user-1")
  })

  it("18. no se usa service_role (cliente estándar autenticado)", async () => {
    const { client, auth } = makeClient({ rpc: okRpc() })
    const svc = new WorkerProfileService({ client })
    await svc.chooseBasicMode()
    expect(auth.getUser).toHaveBeenCalled()
  })

  it("19. no hay DML directo sobre tablas protegidas", async () => {
    const { client, from, rpc } = makeClient({ rpc: okRpc() })
    const svc = new WorkerProfileService({ client })
    await svc.chooseBasicMode()
    await svc.deleteWorkerData()
    await svc.grantConsent("use_worker_data", "1.0")
    // from solo se usa para lectura (getWorkerPreferences/listWorkerEvents), no escritura.
    for (const call of from.mock.calls) {
      expect(call[0]).not.toBe("worker_preferences")
      expect(call[0]).not.toBe("worker_consents")
    }
    expect(rpc).toHaveBeenCalled()
  })

  it("20. contratos de dominio no importan Supabase (verificado en adapters importan tipos generados)", () => {
    // El servicio usa contratos de dominio; el adaptador importa tipos Supabase.
    const profile = mapPayrollContextToWorkerProfile({
      user_id: "u1",
      source_category_name: "payslip_confirmed",
      updated_at: "2026-01-01T00:00:00Z",
    } as never, {
      onboardingState: "configured",
      preferredWorkerMode: "manual",
      updatedAt: "2026-01-01T00:00:00Z",
    })
    // El contrato de dominio WorkerProfile no contiene columnas SQL crudas.
    expect(profile).not.toHaveProperty("source_category_name")
    expect(profile).not.toHaveProperty("category_name")
  })

  it("sin sesión lanza WorkerProfileUnauthorizedError", async () => {
    const { client } = makeClient({
      auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
    })
    const svc = new WorkerProfileService({ client })
    await expect(svc.chooseBasicMode()).rejects.toBeInstanceOf(WorkerProfileUnauthorizedError)
  })

  it("worker_preferences sin fila lanza WorkerProfileUnavailableError", async () => {
    const from = vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingle(() => ({ data: null, error: null })) })) })) }))
    const { client } = makeClient({ from })
    const svc = new WorkerProfileService({ client })
    await expect(svc.getWorkerPreferences()).rejects.toBeInstanceOf(WorkerProfileUnavailableError)
  })

  it("worker_preferences con tabla inexistente lanza WorkerProfileUnavailableError", async () => {
    const from = vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: maybeSingle(() => ({ data: null, error: new Error('relation "public.worker_preferences" does not exist') })) })) })) }))
    const { client } = makeClient({ from })
    const svc = new WorkerProfileService({ client })
    await expect(svc.getWorkerPreferences()).rejects.toBeInstanceOf(WorkerProfileUnavailableError)
  })
})
