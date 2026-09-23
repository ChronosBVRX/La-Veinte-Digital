import { describe, it, expect } from "vitest"
import {
  buildRecurringConceptsFromPayslipLines,
  buildWorkerContextPayroll,
  parseJsonArraySafe,
  type PayslipLineRow,
} from "../worker-context-builder"
import type { RecurringConceptEvidence } from "@/features/nomina/lib/types"

/**
 * PRUEBA DE INTEGRACIÓN DEL PIPELINE DE DATOS (bug $200.00 en producción).
 *
 * Historia: el RPC confirm_imported_payslip solo persiste recurrentes
 * 050/023/063 en payroll_contexts; hidratar el simulador desde ahí hacía que
 * la portada mostrara $200.00 (una sola percepción) en lugar del total
 * comprobado $14,256.87 del tarjetón real 2A-AGO-2026.
 *
 * Este test recorre el pipeline REAL:
 *   líneas del tarjetón (imported_payslip_lines)
 *     → buildRecurringConceptsFromPayslipLines (worker-context)
 *     → perfil hidratado en el simulador
 *     → sumComprobadoTarjeton (selector de la portada)
 */

/** Líneas sintéticas de prueba (ejemplo categoría técnica 80). */
const SYNTHETIC_PAYSLIP_LINES: PayslipLineRow[] = [
  { concept_code: "002", description: "Sueldo Base", amount: 4000.00, kind: "earning", confirmed_by_user: true },
  { concept_code: "011", description: "Ayuda Renta", amount: 3200.00, kind: "earning", confirmed_by_user: true },
  { concept_code: "020", description: "Ayuda Renta", amount: 250.00, kind: "earning", confirmed_by_user: true },
  { concept_code: "022", description: "Ayuda Renta Cláusula 63 Bis Inc c", amount: 1900.00, kind: "earning", confirmed_by_user: true },
  { concept_code: "032", description: "Estímulo Asistencia", amount: 1700.00, kind: "earning", confirmed_by_user: true },
  { concept_code: "033", description: "Estímulo Puntualidad", amount: 1150.00, kind: "earning", confirmed_by_user: true },
  { concept_code: "050", description: "Ayuda Despensa", amount: 200.00, kind: "earning", confirmed_by_user: true },
  { concept_code: "054", description: "Emanaciones Radiactivas", amount: 1400.00, kind: "earning", confirmed_by_user: true },
  { concept_code: "072", description: "Libros no Médicos", amount: 300.00, kind: "earning", confirmed_by_user: true },
]

const TOTAL_PERCEPCIONES_SINTETICO = 14100.00

describe("Pipeline tarjetón → worker-context", () => {
  it("reconstruye TODAS las percepciones confirmadas, no solo el subset del RPC", () => {
    // Simula el estado legacy que dejaba el RPC: SOLO 050 persistido.
    const legacyRcFromRpc = [
      { conceptCode: "050", appearsNormally: true, lastAmount: 200, source: "last_payslip", confirmed: true },
    ]

    const rc = buildRecurringConceptsFromPayslipLines(
      SYNTHETIC_PAYSLIP_LINES,
      "2026-08-31",
      legacyRcFromRpc,
    )

    const codes = rc.map((e) => e.conceptCode).sort()
    expect(codes).toEqual(["002", "011", "020", "022", "032", "033", "050", "054", "072"])

    // Invariantes del cálculo con líneas sintéticas:
    const byCode = new Map(rc.map((e) => [e.conceptCode, e]))
    expect(byCode.get("002")!.lastAmount).toBe(4000.00)
    expect(byCode.get("011")!.lastAmount).toBe(3200.00)
    expect(byCode.get("050")!.lastAmount).toBe(200.00)
    expect(byCode.get("050")!.lastAmount!).not.toBe(TOTAL_PERCEPCIONES_SINTETICO)

    for (const e of rc) {
      expect(e.confirmed).toBe(true)
      expect(e.occurrenceType).not.toBe("one_time")
    }
  })

  it("buildWorkerContextPayroll mantiene los totales declarados del tarjetón", () => {
    const payroll = buildWorkerContextPayroll(
      {
        period_raw: "2A-AGO-2026",
        payroll_totals: { totalEarnings: 14100.00, totalDeductions: 10100.00, netPay: 4000.00 },
      },
      [],
      [],
      SYNTHETIC_PAYSLIP_LINES,
    )
    expect(payroll!.totalEarnings).toBe(14100.00)
    expect(payroll!.totalDeductions).toBe(10100.00)
    expect(payroll!.netPay).toBe(4000.00)
    expect(payroll!.recurringConcepts).toHaveLength(9)

    // La suma de anclas coincide con el total declarado (todas confirmadas):
    const sum = (payroll!.recurringConcepts as RecurringConceptEvidence[])
      .reduce((s, e) => s + (e.lastAmount ?? 0), 0)
    expect(sum).toBeCloseTo(TOTAL_PERCEPCIONES_SINTETICO, 2)
  })

  it("preserva entradas previas de códigos ausentes en el último tarjetón", () => {
    const previo = [
      { conceptCode: "063", appearsNormally: true, lastAmount: 150, source: "last_payslip", lastSeenAt: "2026-07-31", confirmed: true, occurrenceType: "recurring", eligibilityPersistence: "until_changed" },
    ]
    const rc = buildRecurringConceptsFromPayslipLines(SYNTHETIC_PAYSLIP_LINES, "2026-08-31", previo)
    const c063 = rc.find((e) => e.conceptCode === "063")
    expect(c063).toBeDefined()
    expect(c063!.lastAmount).toBe(150)
    expect(c063!.lastSeenAt).toBe("2026-07-31") // no lo toca el merge
  })

  it("tolera JSONB malformado u objeto legacy en existing (p. ej. {}) sin lanzar TypeError", () => {
    // Si la columna JSONB en la BD contiene {} en vez de [], no debe crashear
    const rc = buildRecurringConceptsFromPayslipLines(
      SYNTHETIC_PAYSLIP_LINES,
      "2026-08-31",
      {} as unknown as RecurringConceptEvidence[],
    )
    expect(rc).toHaveLength(9)
    expect(rc.find((e) => e.conceptCode === "002")?.lastAmount).toBe(4000.00)
  })

  it("incluye percepciones confirmadas con importe 0 (p. ej. concepto 011 en 0)", () => {
    const linesWithZero: PayslipLineRow[] = [
      { concept_code: "002", description: "Sueldo Base", amount: 4500, kind: "earning", confirmed_by_user: true },
      { concept_code: "011", description: "Ayuda Renta", amount: 0, kind: "earning", confirmed_by_user: true },
    ]
    const rc = buildRecurringConceptsFromPayslipLines(linesWithZero, "2026-08-31", [])
    expect(rc).toHaveLength(2)
    const c011 = rc.find((e) => e.conceptCode === "011")
    expect(c011).toBeDefined()
    expect(c011!.lastAmount).toBe(0)
  })

  it("acumula múltiples líneas del mismo código de percepción en el mismo tarjetón (p. ej. dos líneas 008 de sustitución)", () => {
    const linesWithDouble008: PayslipLineRow[] = [
      { concept_code: "008", description: "Sustitución Guardia 1", amount: 1800.50, kind: "earning", confirmed_by_user: true },
      { concept_code: "008", description: "Sustitución Guardia 2", amount: 1400.25, kind: "earning", confirmed_by_user: true },
      { concept_code: "011", description: "Ayuda Renta", amount: 2600.00, kind: "earning", confirmed_by_user: true },
    ]
    const rc = buildRecurringConceptsFromPayslipLines(linesWithDouble008, "2026-09-30", [])
    expect(rc).toHaveLength(2)
    const c008 = rc.find((e) => e.conceptCode === "008")
    expect(c008).toBeDefined()
    expect(c008!.lastAmount).toBe(3200.75)
    expect(c008!.confirmed).toBe(true)
    const c011 = rc.find((e) => e.conceptCode === "011")
    expect(c011?.lastAmount).toBe(2600.00)
  })

  it("parseJsonArraySafe normaliza nulos, malformados y tipos incorrectos a arreglo vacío", () => {
    expect(parseJsonArraySafe(null)).toEqual([])
    expect(parseJsonArraySafe(undefined)).toEqual([])
    expect(parseJsonArraySafe("malformed-not-json")).toEqual([])
    expect(parseJsonArraySafe("{}")).toEqual([])
    expect(parseJsonArraySafe({ foo: "bar" })).toEqual([])
    expect(parseJsonArraySafe(12345)).toEqual([])
    expect(parseJsonArraySafe(true)).toEqual([])
    expect(parseJsonArraySafe('["ok", 1]')).toEqual(["ok", 1])
    expect(parseJsonArraySafe([{ conceptCode: "002" }])).toEqual([{ conceptCode: "002" }])
  })
})

describe("getWorkerContext - propagación de errores de Supabase", () => {
  it("propaga WorkerContextQueryError cuando la consulta de profiles falla con error de base de datos", async () => {
    const { getWorkerContext, WorkerContextQueryError } = await import("../worker-context")
    const mockUser = { id: "user-test-123" } as unknown as import("@supabase/supabase-js").User

    const mockSupabase = {
      auth: {
        getUser: async () => ({ data: { user: mockUser }, error: null }),
      },
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: null,
                  error: { code: "42P01", message: "relation profiles does not exist" },
                }),
              }),
            }),
          }
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient<import("@/lib/supabase/types").Database>

    await expect(getWorkerContext(mockUser, mockSupabase, "req-test-999")).rejects.toThrow(
      WorkerContextQueryError,
    )

    try {
      await getWorkerContext(mockUser, mockSupabase, "req-test-999")
    } catch (err) {
      const qErr = err as InstanceType<typeof WorkerContextQueryError>
      expect(qErr.code).toBe("profile_query_failed")
      expect(qErr.requestId).toBe("req-test-999")
      expect(qErr.message).toBe("Error al consultar perfil del trabajador")
    }
  })

  it("comprueba el tarjetón persistido y sus líneas en la base, y resuelve el contexto laboral con procedencia comprobada", async () => {
    const { getWorkerContext } = await import("../worker-context")
    const { selectSalaryEstimateInputs } = await import("@/features/salary-estimate/services/salary-estimate-selector")
    const mockUser = { id: "user-persisted-456" } as unknown as import("@supabase/supabase-js").User

    const mockPayslipRow = {
      id: "payslip-db-789",
      user_id: "user-persisted-456",
      employee_number: "987654",
      period_raw: "2026-16",
      period_year: 2026,
      period_month: 8,
      period_half: 2,
      created_at: "2026-08-31T10:00:00Z",
      raw_payload: {},
      parsed_payload: {
        document: { periodRaw: "2026-16" },
        payroll: {
          earnings: [
            { code: "002", description: "SUELDO", amount: 5200.0, confirmedByUser: true },
            { code: "011", description: "AYUDA RENTA", amount: 2600.0, confirmedByUser: true },
          ],
          deductions: [],
          totalEarnings: 7800.0,
          totalDeductions: 0,
          netPay: 7800.0,
        },
      },
    }

    interface MockQueryResult {
      data: unknown
      error: null
    }

    interface MockQueryBuilder {
      select: () => MockQueryBuilder
      eq: () => MockQueryBuilder
      order: () => MockQueryBuilder
      limit: () => MockQueryBuilder
      single: () => Promise<MockQueryResult>
      maybeSingle: () => Promise<MockQueryResult>
      then: <TResult = MockQueryResult>(
        resolve?: ((value: MockQueryResult) => TResult | PromiseLike<TResult>) | null,
      ) => Promise<TResult>
    }

    function makeQuery(data: unknown): MockQueryBuilder {
      const q: MockQueryBuilder = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        single: async () => ({ data: Array.isArray(data) ? data[0] : data, error: null }),
        maybeSingle: async () => ({ data: Array.isArray(data) ? data[0] : data, error: null }),
        then: (resolve) => Promise.resolve({ data, error: null }).then(resolve),
      }
      return q
    }

    const mockSupabase = {
      from: (table: string) => {
        if (table === "profiles") {
          return makeQuery({
            id: "user-persisted-456",
            matricula: "987654",
            full_name: "Usuario Persistido",
            categoria: "ENFERMERA GENERAL",
            antiguedad: "10",
            adscripcion: "HGZ",
          })
        }
        if (table === "worker_active_context") {
          return makeQuery({
            employee_number: "987654",
            active_payslip_id: "payslip-db-789",
            selection_mode: "AUTO_LATEST",
            updated_at: "2026-08-31T10:00:00Z",
          })
        }
        if (table === "imported_payslips") {
          return makeQuery([mockPayslipRow])
        }
        if (table === "imported_payslip_lines") {
          return makeQuery([
            { concept_code: "002", description: "SUELDO", amount: 5200.0, kind: "earning", confirmed_by_user: true },
            { concept_code: "011", description: "AYUDA RENTA", amount: 2600.0, kind: "earning", confirmed_by_user: true },
          ])
        }
        if (table === "payroll_contexts") {
          return makeQuery({
            user_id: "user-persisted-456",
            recurring_concepts: [],
            payroll_facts: [],
          })
        }
        if (table === "vacation_profile_data") {
          return makeQuery(null)
        }
        return makeQuery(null)
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient<import("@/lib/supabase/types").Database>

    const context = await getWorkerContext(mockUser, mockSupabase, "req-persistence-check")
    expect(context.meta?.activePayslipId).toBe("payslip-db-789")
    expect(context.meta?.activePayslipPeriod).toBe("2026-16")

    const inputs = selectSalaryEstimateInputs(context)
    expect(inputs.hasPayslip).toBe(true)
    expect(inputs.tabular).toBe(5200.0)
    expect(inputs.concept11).toBe(2600.0)
    expect(inputs.tabularPayslipId).toBe("payslip-db-789")
    expect(inputs.concept11PayslipId).toBe("payslip-db-789")
  })
})
