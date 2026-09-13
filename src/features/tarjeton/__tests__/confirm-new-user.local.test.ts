/**
 * Integración local: usuario nuevo sin fila previa en public.profiles.
 *
 * Reproduce el P0 multiusuario:
 *   1. Crear usuario en Supabase LOCAL (sin insertar manualmente profiles).
 *   2. Autenticarlo como usuario ordinario.
 *   3. Ejecutar ensure_profile_exists (mismo paso que la página/API).
 *   4. Verificar que profiles.id = auth.uid() quedó creado.
 *   5. Verificar idempotencia (segunda ejecución no falla ni duplica).
 *
 * GUARDA: solo corre contra Supabase local (127.0.0.1/localhost). Nunca apunta
 * a producción. Se omite si falta SUPABASE_LOCAL_ANON_KEY o el contenedor.
 *
 * No usa datos reales.
 */
import { describe, it, expect, beforeAll } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { execSync } from "child_process"

const LOCAL_URL = process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321"
const LOCAL_ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? ""
const DOCKER_DB = process.env.SUPABASE_LOCAL_DB_CONTAINER ?? "supabase_db_La_Veinte_Digital"
const TEST_EMAIL = "tarjeton-new-user@test.local"

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
    console.warn(
      "[tarjeton new-user integration] Omitido: falta SUPABASE_LOCAL_ANON_KEY. " +
        "Define la variable y arranca Supabase local para ejecutarlo. No usa producción.",
    )
    return false
  }
  if (!isLocalUrl(LOCAL_URL)) {
    console.warn("[tarjeton new-user integration] Omitido: LOCAL_URL no es local (guarda anti-producción).")
    return false
  }
  try {
    execDb("select 1;")
    return true
  } catch {
    console.warn("[tarjeton new-user integration] Omitido: contenedor Docker local no disponible.")
    return false
  }
}

const available = detectAvailable()

describe.skipIf(!available)("Tarjetón — usuario nuevo sin profiles previo (Supabase local)", () => {
  let client: SupabaseClient
  let userId = ""

  beforeAll(async () => {
    execDb(`
      delete from public.imported_payslips where user_id in (select id from auth.users where email = '${TEST_EMAIL}');
      delete from public.worker_preferences where user_id in (select id from auth.users where email = '${TEST_EMAIL}');
      delete from public.payroll_contexts where user_id in (select id from auth.users where email = '${TEST_EMAIL}');
      delete from public.profiles where id in (select id from auth.users where email = '${TEST_EMAIL}');
      delete from auth.users where email = '${TEST_EMAIL}';
    `)

    client = createClient(LOCAL_URL, LOCAL_ANON_KEY)
    const { data, error } = await client.auth.signUp({
      email: TEST_EMAIL,
      password: "password-123",
      options: { data: { full_name: "Usuario Nuevo" } },
    })
    expect(error).toBeNull()
    userId = data.user!.id

    if (!data.session) {
      execDb(`update auth.users set email_confirmed_at = now() where id = '${userId}';`)
      const signIn = await client.auth.signInWithPassword({ email: TEST_EMAIL, password: "password-123" })
      expect(signIn.error).toBeNull()
    }
  })

  it("ensure_profile_exists crea la fila y es idempotente", async () => {
    // Sin perfil previo (el trigger de auth podría haberlo creado; se elimina).
    execDb(`delete from public.profiles where id = '${userId}';`)
    const before = execDb(`select count(*) from public.profiles where id = '${userId}';`).trim()
    expect(before).toBe("0")

    const first = await client.rpc("ensure_profile_exists")
    expect(first.error).toBeNull()

    const after = execDb(`select count(*) from public.profiles where id = '${userId}';`).trim()
    expect(after).toBe("1")

    const second = await client.rpc("ensure_profile_exists")
    expect(second.error).toBeNull()
    const stillOne = execDb(`select count(*) from public.profiles where id = '${userId}';`).trim()
    expect(stillOne).toBe("1")
  })

  it("un usuario ordinario (sin rol admin) puede ejecutar el bootstrap", async () => {
    const role = execDb(`select coalesce(role, 'none') from public.profiles where id = '${userId}';`).trim()
    expect(role).not.toBe("admin")
    const res = await client.rpc("ensure_profile_exists")
    expect(res.error).toBeNull()
  })

  it("P0: confirmar SIN perfil falla por FK; con ensure_profile_exists previo funciona, asocia al UUID y es idempotente", async () => {
    const sourceHash = `e2e-newuser-${Date.now()}`
    const parsed = buildSyntheticParsed("1A-ENE-2026", 2026, 1, 1, "900123")

    // 1. Estado inicial: sin fila en profiles (trigger eliminado a mano).
    execDb(`
      delete from public.imported_payslips where user_id = '${userId}';
      delete from public.worker_preferences where user_id = '${userId}';
      delete from public.payroll_contexts where user_id = '${userId}';
      delete from public.profiles where id = '${userId}';
    `)
    expect(execDb(`select count(*) from public.profiles where id = '${userId}';`).trim()).toBe("0")

    // 2. Confirmar SIN bootstrap reproduce el fallo original (violación de FK).
    const withoutBootstrap = await client.rpc("confirm_imported_payslip", {
      p_source_hash: sourceHash,
      p_parsed: parsed,
      p_profile_updates: { categoria: true, antiguedad: true },
      p_acknowledge_total_difference: true,
      p_authorize_server_storage: true,
    })
    expect(withoutBootstrap.error).not.toBeNull()

    // 3. Flujo canónico: ensure_profile_exists + confirm.
    const ensured = await client.rpc("ensure_profile_exists")
    expect(ensured.error).toBeNull()

    const first = await client.rpc("confirm_imported_payslip", {
      p_source_hash: sourceHash,
      p_parsed: parsed,
      p_profile_updates: { categoria: true, antiguedad: true },
      p_acknowledge_total_difference: true,
      p_authorize_server_storage: true,
    })
    expect(first.error).toBeNull()

    // 4. profiles.id = auth.uid()
    expect(execDb(`select count(*) from public.profiles where id = '${userId}';`).trim()).toBe("1")

    // 5. imported_payslips.user_id = mismo UUID
    expect(
      execDb(`select count(*) from public.imported_payslips where user_id = '${userId}';`).trim(),
    ).toBe("1")

    // 6. Preferencias y contexto laboral inicializados.
    expect(
      execDb(`select onboarding_state from public.worker_preferences where user_id = '${userId}';`).trim(),
    ).toBe("configured")
    expect(
      execDb(`select count(*) from public.payroll_contexts where user_id = '${userId}';`).trim(),
    ).toBe("1")

    // 7. Idempotencia: mismo source_hash no duplica.
    const second = await client.rpc("confirm_imported_payslip", {
      p_source_hash: sourceHash,
      p_parsed: parsed,
      p_profile_updates: { categoria: true, antiguedad: true },
      p_acknowledge_total_difference: true,
      p_authorize_server_storage: true,
    })
    expect(second.error).toBeNull()
    expect(
      execDb(`select count(*) from public.imported_payslips where user_id = '${userId}';`).trim(),
    ).toBe("1")
  })
})

/** Tarjetón sintético con balance contable exacto (sin datos personales reales). */
function buildSyntheticParsed(periodRaw: string, year: number, month: number, half: number, matricula: string) {
  const earnings = [
    { code: "002", description: "SUELDO BASE", amount: 3937.64, kind: "earning", confidence: 0.95, confirmedByUser: true },
    { code: "011", description: "PRESTACIONES EN DINERO", amount: 3234.77, kind: "earning", confidence: 0.95, confirmedByUser: true },
  ]
  const deductions = [
    { code: "212", description: "IMPUESTO SOBRE LA RENTA", amount: 1234.56, kind: "deduction", confidence: 0.95, confirmedByUser: true },
  ]
  const totalEarnings = 7172.41
  const totalDeductions = 1234.56
  const netPay = 5937.85

  return {
    document: { periodRaw, year, month, half, folio: "998877", certificationDate: "2026-01-31" },
    employee: {
      employeeNumber: matricula,
      fullName: "SINTETICO PRUEBA",
      categoryName: "ENFERMERA GENERAL",
      categoryCode: "6112",
      workdayHours: 8,
      entryDate: "2003-03-01",
      employmentType: "base",
      location: "HGZ DEMO",
      seniority: { years: 22, fortnights: 10, days: 2, reconstructedEffectiveDate: "2003-03-01", raw: "22 anos 10 qnas 2 dias" },
    },
    attendance: {},
    vacations: {},
    payroll: { earnings, deductions, totalEarnings, totalDeductions, netPay, observations: [] },
    extraction: { method: "native_text", globalConfidence: 0.33, validations: { templateDetected: true }, warnings: [] },
  }
}
