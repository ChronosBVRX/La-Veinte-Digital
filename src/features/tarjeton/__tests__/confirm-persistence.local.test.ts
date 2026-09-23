/**
 * Integración local: persistencia de tarjetón vía RPC contra Supabase local.
 *
 * Flujo:
 *   1. Ejecuta la RPC confirm_imported_payslip contra Supabase LOCAL.
 *   2. Comprueba la inserción del tarjetón en public.imported_payslips.
 *   3. Comprueba las líneas persistidas en public.imported_payslip_lines (002, 011).
 *   4. Consulta el contexto laboral actualizado vía getWorkerContext y valida
 *      que 002 y 011 tengan procedencia comprobada con payslipId igual al tarjetón activo.
 *
 * GUARDA: solo corre contra Supabase local (127.0.0.1/localhost). Nunca apunta
 * a producción. Se omite si falta SUPABASE_LOCAL_ANON_KEY o el contenedor Docker local.
 *
 * No usa datos reales.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { execSync } from "child_process"
import { getWorkerContext } from "@/shared/server/worker-context"
import { selectSalaryEstimateInputs } from "@/features/salary-estimate/services/salary-estimate-selector"
import type { Database } from "@/lib/supabase/types"

const LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321"
const LOCAL_ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? ""
const DOCKER_DB = process.env.SUPABASE_LOCAL_DB_CONTAINER ?? "supabase_db_La_Veinte_Digital"
const TEST_EMAIL = "tarjeton-persistence@test.local"

function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname === "127.0.0.1" || hostname === "localhost"
  } catch {
    return false
  }
}

function execDb(sql: string): string {
  return execSync(`docker exec -i ${DOCKER_DB} psql -U postgres -d postgres -tA`, {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  })
}

function detectAvailable(): boolean {
  if (!LOCAL_ANON_KEY) {
    return false
  }
  if (!isLocalUrl(LOCAL_URL)) {
    return false
  }
  try {
    execDb("select 1;")
    return true
  } catch {
    return false
  }
}

const available = detectAvailable()

describe.skipIf(!available)("Tarjetón — persistencia vía RPC, base de datos y contexto laboral (Supabase local)", () => {
  let client: SupabaseClient<Database>
  let userId = ""

  beforeAll(async () => {
    execDb(`
      delete from public.imported_payslip_lines where user_id in (select id from auth.users where email = '${TEST_EMAIL}');
      delete from public.imported_payslips where user_id in (select id from auth.users where email = '${TEST_EMAIL}');
      delete from public.worker_preferences where user_id in (select id from auth.users where email = '${TEST_EMAIL}');
      delete from public.payroll_contexts where user_id in (select id from auth.users where email = '${TEST_EMAIL}');
      delete from public.profiles where id in (select id from auth.users where email = '${TEST_EMAIL}');
      delete from auth.users where email = '${TEST_EMAIL}';
    `)

    client = createClient<Database>(LOCAL_URL, LOCAL_ANON_KEY)
    const { data, error } = await client.auth.signUp({
      email: TEST_EMAIL,
      password: "password-persistence-123",
      options: { data: { full_name: "Usuario Persistencia" } },
    })
    expect(error).toBeNull()
    userId = data.user!.id

    if (!data.session) {
      execDb(`update auth.users set email_confirmed_at = now() where id = '${userId}';`)
      const signIn = await client.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: "password-persistence-123",
      })
      expect(signIn.error).toBeNull()
    }

    const { error: profileErr } = await client.rpc("ensure_profile_exists")
    expect(profileErr).toBeNull()
  })

  afterAll(async () => {
    try {
      execDb(`
        delete from public.imported_payslip_lines where user_id in (select id from auth.users where email = '${TEST_EMAIL}');
        delete from public.imported_payslips where user_id in (select id from auth.users where email = '${TEST_EMAIL}');
        delete from public.worker_preferences where user_id in (select id from auth.users where email = '${TEST_EMAIL}');
        delete from public.payroll_contexts where user_id in (select id from auth.users where email = '${TEST_EMAIL}');
        delete from public.profiles where id in (select id from auth.users where email = '${TEST_EMAIL}');
        delete from auth.users where email = '${TEST_EMAIL}';
      `)
    } catch {
      // Ignorar limpieza si el contenedor ya no está disponible
    }
  })

  it("ejecuta confirm_imported_payslip, comprueba filas en base y consulta el contexto laboral actualizado", async () => {
    const sourceHash = `persist-${Date.now()}`
    const parsed = {
      document: {
        periodRaw: "2A-AGO-2026",
        year: 2026,
        month: 8,
        half: 2,
        folio: "776655",
        certificationDate: "2026-08-31",
      },
      employee: {
        employeeNumber: "900888",
        fullName: "TRABAJADOR PERSISTENCIA",
        categoryName: "MEDICO NO FAMILIAR",
        categoryCode: "5011",
        workdayHours: 8,
        entryDate: "2010-05-16",
        employmentType: "base",
        location: "HGZ 1",
        seniority: { years: 16, fortnights: 7, days: 0, reconstructedEffectiveDate: "2010-05-16", raw: "16 anos 7 qnas" },
      },
      attendance: {},
      vacations: {},
      payroll: {
        earnings: [
          { code: "002", description: "SUELDO BASE", amount: 5500.0, kind: "earning", confidence: 0.98, confirmedByUser: true },
          { code: "011", description: "AYUDA DE RENTA", amount: 2800.0, kind: "earning", confidence: 0.98, confirmedByUser: true },
        ],
        deductions: [
          { code: "212", description: "IMPUESTO SOBRE LA RENTA", amount: 1100.0, kind: "deduction", confidence: 0.98, confirmedByUser: true },
        ],
        totalEarnings: 8300.0,
        totalDeductions: 1100.0,
        netPay: 7200.0,
        observations: [],
      },
      extraction: { method: "native_text", globalConfidence: 0.98, validations: { templateDetected: true }, warnings: [] },
    }

    // 1. Ejecutar RPC confirm_imported_payslip
    const { error: rpcErr } = await client.rpc("confirm_imported_payslip", {
      p_source_hash: sourceHash,
      p_parsed: parsed,
      p_profile_updates: { categoria: true, antiguedad: true },
      p_acknowledge_total_difference: true,
      p_authorize_server_storage: true,
    })
    expect(rpcErr).toBeNull()

    // 2. Comprobar el tarjetón en public.imported_payslips
    const { data: payslipRows, error: payslipsErr } = await client
      .from("imported_payslips")
      .select("id, period_year, period_raw, user_id, source_hash")
      .eq("user_id", userId)
    expect(payslipsErr).toBeNull()
    expect(payslipRows).not.toBeNull()
    expect(payslipRows!.length).toBe(1)
    const payslipId = payslipRows![0].id
    expect(payslipRows![0].period_year).toBe(2026)
    expect(payslipRows![0].period_raw).toBe("2A-AGO-2026")

    // 3. Comprobar las líneas en public.imported_payslip_lines
    const { data: lineRows, error: linesErr } = await client
      .from("imported_payslip_lines")
      .select("id, payslip_id, concept_code, amount, confirmed_by_user")
      .eq("payslip_id", payslipId)
      .order("concept_code")
    expect(linesErr).toBeNull()
    expect(lineRows).not.toBeNull()
    expect(lineRows!.length).toBeGreaterThanOrEqual(2)

    const line002 = lineRows!.find((l) => l.concept_code === "002")
    const line011 = lineRows!.find((l) => l.concept_code === "011")
    expect(line002).toBeDefined()
    expect(line002!.amount).toBe(5500.0)
    expect(line002!.confirmed_by_user).toBe(true)
    expect(line011).toBeDefined()
    expect(line011!.amount).toBe(2800.0)
    expect(line011!.confirmed_by_user).toBe(true)

    // 4. Consultar el contexto laboral actualizado vía getWorkerContext
    const context = await getWorkerContext(
      { id: userId } as unknown as import("@supabase/supabase-js").User,
      client,
      "test-persistence",
    )
    expect(context.meta?.activePayslipId).toBe(payslipId)

    // Validar procedencia comprobada con el selector de aumento salarial
    const selection = selectSalaryEstimateInputs(context)
    expect(selection.hasPayslip).toBe(true)
    expect(selection.tabular).toBe(5500.0)
    expect(selection.concept11).toBe(2800.0)
    expect(selection.tabularPayslipId).toBe(payslipId)
    expect(selection.concept11PayslipId).toBe(payslipId)
    expect(selection.activePayslipId).toBe(payslipId)
  })
})
