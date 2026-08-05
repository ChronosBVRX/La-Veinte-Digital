/**
 * Integración local del WorkerProfileService contra Supabase local.
 *
 * Requisito: Supabase local activo con la migración worker_profile_persistence
 * aplicada (supabase start). Se salta si la BD local no está disponible.
 *
 * Usa un cliente @supabase/supabase-js con la URL/anon-key locales y un JWT
 * sintético de un usuario creado vía SQL en auth.users (como en los tests SQL).
 * No usa datos reales.
 */
import { describe, it, expect, beforeAll } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { execSync } from "child_process"
import type { Database } from "@/lib/supabase/types"
import { WorkerProfileService } from "../service"

const LOCAL_URL = "http://127.0.0.1:54321"
const LOCAL_ANON_KEY = process.env.SUPABASE_LOCAL_ANON_KEY ?? ""
const DOCKER_DB = process.env.SUPABASE_LOCAL_DB_CONTAINER ?? "supabase_db_La_Veinte_Digital"

// Email sintético fijo para el test.
const TEST_EMAIL = "wp-integration@test.local"

let available = false
let client: SupabaseClient<Database> | null = null
let service: WorkerProfileService | null = null
let userId = ""

/** Ejecuta SQL en la BD local vía docker exec. */
function execDb(sql: string): void {
  execSync(`docker exec -i ${DOCKER_DB} psql -U postgres -d postgres`, {
    input: sql,
    stdio: ["pipe", "ignore", "pipe"],
  })
}

// Detección de disponibilidad a nivel de módulo (sincrónica), para que
// describe.skipIf la evalúe correctamente.
function detectAvailable(): boolean {
  if (!LOCAL_ANON_KEY) {
    // Solo una advertencia; no falla en CI (sin Docker local ni env vars).
    console.warn(
      "[worker-profile integration] Omitiendo tests de integración local: " +
        "falta SUPABASE_LOCAL_ANON_KEY. Define esta variable de entorno para " +
        "ejecutar contra un Supabase local. No usa datos reales.",
    )
    return false
  }
  try {
    execDb("select 1;")
    return true
  } catch {
    console.warn(
      "[worker-profile integration] Omitiendo tests de integración local: " +
        "no se pudo conectar al contenedor Docker '" + DOCKER_DB + "'.",
    )
    return false
  }
}

available = detectAvailable()

beforeAll(async () => {
  if (!available) return

  // Limpiar cualquier residuo de corridas previas (por id y por email).
  execDb(`
    delete from public.worker_preferences where user_id in (
      select id from auth.users where email = '${TEST_EMAIL}'
    );
    delete from public.payroll_contexts where user_id in (
      select id from auth.users where email = '${TEST_EMAIL}'
    );
    delete from public.worker_consents where user_id in (
      select id from auth.users where email = '${TEST_EMAIL}'
    );
    delete from public.worker_data_events where user_id in (
      select id from auth.users where email = '${TEST_EMAIL}'
    );
    delete from public.profiles where id in (
      select id from auth.users where email = '${TEST_EMAIL}'
    );
    delete from auth.users where email = '${TEST_EMAIL}';
  `)

  client = createClient<Database>(LOCAL_URL, LOCAL_ANON_KEY)
  const { data: signUpData, error: signUpError } = await client.auth.signUp({
    email: TEST_EMAIL,
    password: "password-123",
    options: { data: { full_name: "Integracion" } },
  })
  if (signUpError || !signUpData.user) {
    throw new Error(`signUp falló: ${signUpError?.message ?? "sin usuario"}`)
  }
  userId = signUpData.user.id

  // Garantizar la fila en profiles (como hace ensure_profile_exists en la app).
  execDb(`
    insert into public.profiles (id, full_name)
    values ('${userId}', 'Integracion')
    on conflict (id) do nothing;
  `)

  // Si el signUp no devolvió sesión (requiere confirmación de email), se
  // confirma el email por SQL y se inicia sesión manual.
  if (!signUpData.session) {
    execDb(`update auth.users set email_confirmed_at = now() where id = '${userId}';`)
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: "password-123",
    })
    if (signInError || !signInData.session) {
      throw new Error(`signIn falló: ${signInError?.message ?? "sin sesión"}`)
    }
  }

  service = new WorkerProfileService({ client })
})

describe.skipIf(!available)("WorkerProfileService — integración local", () => {
  it("unconfigured → basic", async () => {
    if (!service) throw new Error("service no disponible")
    await service.chooseBasicMode()
    const prefs = await service.getWorkerPreferences()
    expect(prefs.onboardingState).toBe("basic")
    expect(prefs.preferredWorkerMode).toBeNull()
  })

  it("basic → manual con consentimiento y confirmación", async () => {
    if (!service) throw new Error("service no disponible")
    await service.grantConsent("use_worker_data", "1.0")
    await service.confirmManualProfile({
      mode: "manual",
      sourceOfRequest: "manual",
      identity: { matricula: "M9", adscripcion: "A9", categoria: "TECNICO" },
      situation: { workdayHours: 8, shift: "matutino", employmentType: "base" },
      sources: {
        matricula: "manual",
        adscripcion: "manual",
        categoria: "manual",
        workdayHours: "manual",
        shift: "manual",
        employmentType: "manual",
      },
      consentRef: { purpose: "use_worker_data", version: "1.0" },
    })
    const current = await service.getCurrentProfile()
    expect(current.state).toBe("configured")
    if (current.state === "configured") {
      expect(current.mode).toBe("manual")
      expect(current.profile.identity.categoria).toBe("TECNICO")
    }
  })

  it("manual → payslip vía changeWorkerProfileMode", async () => {
    if (!service) throw new Error("service no disponible")
    await service.changeWorkerProfileMode("payslip")
    const prefs = await service.getWorkerPreferences()
    expect(prefs.preferredWorkerMode).toBe("payslip")
  })

  it("consentimiento vigente", async () => {
    if (!service) throw new Error("service no disponible")
    const consent = await service.getEffectiveConsent("use_worker_data")
    expect(consent).not.toBeNull()
    expect(consent?.version).toBe("1.0")
  })

  it("eventos generados automáticamente", async () => {
    if (!service) throw new Error("service no disponible")
    const events = await service.listWorkerEvents(10)
    expect(events.length).toBeGreaterThan(0)
    const types = events.map((e) => e.eventType)
    expect(types).toContain("mode_changed")
    expect(types).toContain("consent_granted")
  })

  it("calidad del perfil", async () => {
    if (!service) throw new Error("service no disponible")
    const quality = await service.getProfileQuality()
    expect(quality.percent).toBeGreaterThan(0)
  })

  it("payload inválido rechazado", async () => {
    if (!service) throw new Error("service no disponible")
    await expect(
      service.confirmManualProfile({
        mode: "manual",
        sourceOfRequest: "manual",
        identity: { role: "admin" },
        situation: {},
        sources: { role: "manual" },
        consentRef: { purpose: "use_worker_data", version: "1.0" },
      } as never),
    ).rejects.toThrow(/no permitido/i)
  })

  it("revocación de consentimiento", async () => {
    if (!service) throw new Error("service no disponible")
    await service.revokeConsent("use_worker_data")
    const consent = await service.getEffectiveConsent("use_worker_data")
    expect(consent).toBeNull()
  })

  it("borrado laboral conserva cuenta y pasa a basic", async () => {
    if (!service) throw new Error("service no disponible")
    await service.deleteWorkerData()
    const prefs = await service.getWorkerPreferences()
    expect(prefs.onboardingState).toBe("basic")
    expect(prefs.preferredWorkerMode).toBeNull()
    const current = await service.getCurrentProfile()
    expect(current.state).toBe("basic")
  })

  it("transición inválida rechazada", async () => {
    if (!service) throw new Error("service no disponible")
    // En basic, cambiar modo sin perfil no configurado debe fallar.
    await expect(service.changeWorkerProfileMode("manual")).rejects.toThrow()
  })
})
