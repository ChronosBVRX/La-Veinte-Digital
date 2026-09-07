import { test, expect } from "./fixtures/test"
import { createClient } from "@supabase/supabase-js"

/**
 * E2E INTEGRATION TEST:
 * Inmunidad al Router Cache de Next.js y sincronización canónica del tarjetón activo
 * en navegación SPA (Perfil <-> Vacaciones) sin recargas de página.
 *
 * Flujo verificado:
 * 1. Tarjetón A (Q10, vencimiento 15/10/2026, continuidad 1, trabajador A).
 * 2. Tarjetón B (Q5, vencimiento 01/06/2026, continuidad 4, trabajador B).
 * 3. Ciclo A -> B -> A -> B -> A mediante clicks directos en el menú de navegación.
 * 4. Cero recargas de página (`page.reload()`).
 */

const PAYSLIP_A_ID = "a1a1a1a1-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
const PAYSLIP_B_ID = "b2b2b2b2-bbbb-4bbb-bbbb-bbbbbbbbbbbb"

test.describe("Vacaciones - Navegación SPA y Tarjetón Activo Canónico", () => {
  test.skip(({ isMobile }) => isMobile, "La navegación de barra lateral aplica a viewport de escritorio")

  test.beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const email = process.env.E2E_USER_EMAIL!
    const password = process.env.E2E_USER_PASSWORD!

    if (!supabaseUrl || !supabaseAnon || !email || !password) {
      throw new Error("Variables de entorno para E2E no configuradas")
    }

    const supabase = createClient(supabaseUrl, supabaseAnon)
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (authErr || !auth.user) {
      throw new Error(`Fallo autenticación E2E en Supabase: ${authErr?.message}`)
    }

    const userId = auth.user.id

    // Asegurar Tarjetón A en Supabase
    const rowA = {
      id: PAYSLIP_A_ID,
      user_id: userId,
      period_raw: "2A-MAY-2026",
      period_year: 2026,
      period_month: 5,
      period_half: 2,
      employee_number: "11111111",
      employee_data: {
        fullName: "TRABAJADOR A E2E",
        employeeNumber: "11111111",
        categoryName: "ENFERMERA GENERAL 80",
        seniority: { raw: "10 años 0 qnas 0 dias", years: 10, days: 0, fortnights: 0 },
      },
      vacations: {
        dueDate: "2026-10-15",
        porVencer: "2026-10-15",
        porVencerRaw: "15102026",
        continuityMark: 1,
        periodNumberToEnjoy: 20,
      },
      payroll_totals: { netPay: 15000, grossPay: 20000 },
      extraction_method: "native_text",
      global_confidence: 1,
      source_hash: "test-hash-worker-a-v1",
    }

    // Asegurar Tarjetón B en Supabase
    const rowB = {
      id: PAYSLIP_B_ID,
      user_id: userId,
      period_raw: "1A-MAR-2026",
      period_year: 2026,
      period_month: 3,
      period_half: 1,
      employee_number: "22222222",
      employee_data: {
        fullName: "TRABAJADOR B E2E",
        employeeNumber: "22222222",
        categoryName: "MEDICO GENERAL 80",
        seniority: { raw: "5 años 0 qnas 0 dias", years: 5, days: 0, fortnights: 0 },
      },
      vacations: {
        dueDate: "2026-06-01",
        porVencer: "2026-06-01",
        porVencerRaw: "01062026",
        continuityMark: 4,
        periodNumberToEnjoy: 10,
      },
      payroll_totals: { netPay: 25000, grossPay: 35000 },
      extraction_method: "native_text",
      global_confidence: 1,
      source_hash: "test-hash-worker-b-v1",
    }

    const { error: errA } = await supabase.from("imported_payslips").upsert(rowA)
    if (errA) throw new Error(`Error al upsert de Tarjetón A: ${errA.message}`)

    const { error: errB } = await supabase.from("imported_payslips").upsert(rowB)
    if (errB) throw new Error(`Error al upsert de Tarjetón B: ${errB.message}`)

    // Conceptos fijos (002 Sueldo Base) para cálculo de SMI y presentación de periodo
    const lineA = {
      payslip_id: PAYSLIP_A_ID,
      concept_code: "002",
      description: "SUELDO BASE",
      amount: 6000,
      kind: "earning",
      line_index: 0,
    }
    const lineB = {
      payslip_id: PAYSLIP_B_ID,
      concept_code: "002",
      description: "SUELDO BASE",
      amount: 12000,
      kind: "earning",
      line_index: 0,
    }
    await supabase.from("imported_payslip_lines").upsert(lineA)
    await supabase.from("imported_payslip_lines").upsert(lineB)

    // Asegurar payroll_contexts coherente con worker_preferences
    const payrollContext = {
      user_id: userId,
      matricula: "11111111",
      category_code: "20360180",
      category_name: "ENFERMERA GENERAL 80",
      workday_hours: 8,
      employment_type: "base",
      effective_seniority_date: "2016-05-15",
      adscripcion: "MORELIA",
      shift: "matutino",
      recurring_concepts: [],
      payroll_facts: [],
    }
    await supabase.from("payroll_contexts").upsert(payrollContext)
  })

  test("sincroniza activacion A -> B -> A -> B -> A en SPA sin reload ni datos residuales", async ({ page, errors }) => {
    // Permitir logs informativos de consola esperados en entorno de desarrollo/prueba
    errors.allowConsole(/useLiveWorkerContext/, /WorkerProfileCenter/, /worker-profile-page/, /router.refresh/, /eval\(\) is not supported/)

    // 1. Carga inicial en Perfil / Mi información laboral
    await page.goto("/profile/mi-informacion-laboral")
    await expect(page).toHaveURL("/profile/mi-informacion-laboral")
    await expect(page.getByRole("heading", { name: "Mis tarjetones importados" })).toBeVisible({ timeout: 15_000 })

    // Helper: Activar un tarjetón desde la UI del historial
    async function activatePayslip(payslipId: string, expectedPeriod: string) {
      const card = page.getByTestId(`tarjeton-card-${payslipId}`)
      await expect(card).toBeVisible({ timeout: 10_000 })
      await expect(card).toContainText(expectedPeriod)

      const activeBadge = card.getByText("ACTIVO", { exact: true })
      if (await activeBadge.isVisible()) {
        return // Ya está activo este tarjetón
      }

      const useBtn = card.getByRole("button", { name: "Usar este tarjetón" })
      await expect(useBtn).toBeVisible()

      const selectPromise = page.waitForResponse(
        (res) => res.url().includes("/api/tarjeton/select") && res.request().method() === "POST",
        { timeout: 15_000 }
      )

      await useBtn.click()

      // Confirmar en el modal de confirmación
      const confirmDialog = page.getByRole("dialog")
      await expect(confirmDialog).toBeVisible({ timeout: 5_000 })
      const confirmBtn = confirmDialog.getByRole("button", { name: "Usar este tarjetón" })
      await confirmBtn.click()

      const res = await selectPromise
      expect(res.status()).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)

      // Verificar que esta tarjeta específica ahora muestre ACTIVO
      await expect(card.getByText("ACTIVO", { exact: true })).toBeVisible({ timeout: 10_000 })
    }

    // Helper: Navegar a /vacaciones mediante click en el enlace SPA del menú
    async function navigateToVacacionesViaMenu() {
      const vacLink = page.locator('aside nav a[href="/vacaciones"], a[href="/vacaciones"]').first()
      await expect(vacLink).toBeVisible({ timeout: 5_000 })

      const contextPromise = page.waitForResponse(
        (res) => res.url().includes("/api/worker-context") && res.request().method() === "GET",
        { timeout: 15_000 }
      ).catch(() => null)

      await vacLink.click()
      await expect(page).toHaveURL("/vacaciones")
      await contextPromise

      // En Vacaciones, avanzar de la pantalla de bienvenida a "Lo que encontramos en tu tarjetón"
      const startBtn = page.getByRole("button", { name: /Comenzar simulación/i })
      if (await startBtn.isVisible()) {
        await startBtn.click()
      }
      await expect(page.getByText("Lo que encontramos en tu tarjetón")).toBeVisible({ timeout: 10_000 })
    }

    // Helper: Navegar a /profile/mi-informacion-laboral mediante clicks en el menú
    async function navigateToProfileViaMenu() {
      const profileLink = page.locator('aside nav a[href="/profile"], a[href="/profile"]').first()
      await expect(profileLink).toBeVisible({ timeout: 5_000 })
      await profileLink.click()
      await expect(page).toHaveURL("/profile")

      const laboralLink = page.locator('a[href="/profile/mi-informacion-laboral"]').first()
      await expect(laboralLink).toBeVisible({ timeout: 5_000 })
      await laboralLink.click()
      await expect(page).toHaveURL("/profile/mi-informacion-laboral")
      await expect(page.getByRole("heading", { name: "Mis tarjetones importados" })).toBeVisible({ timeout: 10_000 })
    }

    // Helper de aserción: Verificar datos de Tarjetón A en Vacaciones
    async function assertVacationsShowsWorkerA() {
      await expect(page.getByText("Marca 1")).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText("15/10/2026")).toBeVisible()
      await expect(page.getByText("2A-MAY-2026")).toBeVisible()
      await expect(page.getByText("10 años cumplidos")).toBeVisible()

      // Verificar que NO queden datos residuales de B
      await expect(page.getByText("Marca 4")).not.toBeVisible()
      await expect(page.getByText("01/06/2026")).not.toBeVisible()
      await expect(page.getByText("1A-MAR-2026")).not.toBeVisible()
      await expect(page.getByText("5 años cumplidos")).not.toBeVisible()
    }

    // Helper de aserción: Verificar datos de Tarjetón B en Vacaciones
    async function assertVacationsShowsWorkerB() {
      await expect(page.getByText("Marca 4")).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText("01/06/2026")).toBeVisible()
      await expect(page.getByText("1A-MAR-2026")).toBeVisible()
      await expect(page.getByText("5 años cumplidos")).toBeVisible()

      // Verificar que NO queden datos residuales de A
      await expect(page.getByText("Marca 1")).not.toBeVisible()
      await expect(page.getByText("15/10/2026")).not.toBeVisible()
      await expect(page.getByText("2A-MAY-2026")).not.toBeVisible()
      await expect(page.getByText("10 años cumplidos")).not.toBeVisible()
    }

    // ==========================================
    // CICLO 1: Activar A -> Verificar en Vacaciones
    // ==========================================
    await activatePayslip(PAYSLIP_A_ID, "2A-MAY-2026")
    await navigateToVacacionesViaMenu()
    await assertVacationsShowsWorkerA()

    // ==========================================
    // CICLO 2: Volver a Perfil -> Activar B -> Verificar en Vacaciones
    // ==========================================
    await navigateToProfileViaMenu()
    await activatePayslip(PAYSLIP_B_ID, "1A-MAR-2026")
    await navigateToVacacionesViaMenu()
    await assertVacationsShowsWorkerB()

    // ==========================================
    // CICLO 3: Volver a Perfil -> Activar A de nuevo -> Verificar en Vacaciones
    // ==========================================
    await navigateToProfileViaMenu()
    await activatePayslip(PAYSLIP_A_ID, "2A-MAY-2026")
    await navigateToVacacionesViaMenu()
    await assertVacationsShowsWorkerA()

    // ==========================================
    // CICLO 4: Volver a Perfil -> Activar B de nuevo -> Verificar en Vacaciones
    // ==========================================
    await navigateToProfileViaMenu()
    await activatePayslip(PAYSLIP_B_ID, "1A-MAR-2026")
    await navigateToVacacionesViaMenu()
    await assertVacationsShowsWorkerB()

    // ==========================================
    // CICLO 5: Volver a Perfil -> Activar A final -> Verificar en Vacaciones
    // ==========================================
    await navigateToProfileViaMenu()
    await activatePayslip(PAYSLIP_A_ID, "2A-MAY-2026")
    await navigateToVacacionesViaMenu()
    await assertVacationsShowsWorkerA()
  })
})
