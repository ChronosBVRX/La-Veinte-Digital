/**
 * E2E multiusuario: aislamiento de tarjetones entre dos cuentas.
 *
 * Requisitos (SOLO entorno local, NUNCA producción):
 *   E2E_MULTIUSER_BASE_URL   → http://localhost:3000
 *   E2E_MULTIUSER_A_EMAIL / E2E_MULTIUSER_A_PASSWORD
 *   E2E_MULTIUSER_B_EMAIL / E2E_MULTIUSER_B_PASSWORD
 *
 * Se omite salvo que todas las variables existan. No usa cuentas reales.
 * Los PDFs son sintéticos (jsPDF) y únicos por corrida.
 *
 * Cubre:
 *   1. Aislamiento con DOS contextos separados.
 *   2. Cambio de cuenta A → B → A en UN MISMO contexto usando el login/logout
 *      real de la interfaz (no se manipula localStorage a mano).
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test"
import { assertSafeDatabase } from "../utils/assert-safe-database"
import { buildSyntheticTarjetonPdf } from "../fixtures/pdfs/build-tarjeton-pdf"

const BASE = process.env.E2E_MULTIUSER_BASE_URL
const A_EMAIL = process.env.E2E_MULTIUSER_A_EMAIL
const A_PASS = process.env.E2E_MULTIUSER_A_PASSWORD
const B_EMAIL = process.env.E2E_MULTIUSER_B_EMAIL
const B_PASS = process.env.E2E_MULTIUSER_B_PASSWORD

const configured = Boolean(BASE && A_EMAIL && A_PASS && B_EMAIL && B_PASS)

// Contexto limpio garantizado: sin storageState heredado del proyecto.
const EMPTY_STATE = { cookies: [], origins: [] }

test.skip(
  !configured,
  "Requiere E2E_MULTIUSER_BASE_URL/A_*/B_* contra Supabase local (nunca producción).",
)

const RUN_ID = Date.now().toString(36)

const A_NAME = `AISLADA A ${RUN_ID}`
const B_NAME = `AISLADA B ${RUN_ID}`
// Mismo periodo para ambos: deben quedar separados por usuario.
const SHARED_PERIOD = "1A-ENE-2026"
const pdfA = buildSyntheticTarjetonPdf({ fullName: A_NAME, matricula: "900001", periodRaw: SHARED_PERIOD })
const pdfB = buildSyntheticTarjetonPdf({ fullName: B_NAME, matricula: "900002", periodRaw: SHARED_PERIOD })

async function signIn(context: BrowserContext, email: string, password: string): Promise<Page> {
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  await page.getByLabel("Correo electrónico").fill(email)
  await page.getByLabel("Contraseña").fill(password)
  await page.getByRole("button", { name: "Iniciar sesión" }).click()
  await expect(page).toHaveURL(`${BASE}/`)
  return page
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Cerrar sesión" }).click()
  await expect(page).toHaveURL(/\/login/)
}

async function importAndConfirm(page: Page, buffer: Buffer) {
  assertSafeDatabase()
  await page.goto(`${BASE}/profile/mi-informacion-laboral`)
  await page.locator('input[type="file"]').setInputFiles({
    name: "tarjeton.pdf",
    mimeType: "application/pdf",
    buffer,
  })
  await expect(page.getByText("Revisa los datos detectados")).toBeVisible({ timeout: 30_000 })
  const consentCheckbox = page.getByRole("checkbox", { name: /Autorizo guardar los datos confirmados/i })
  await consentCheckbox.check()
  await page.getByRole("button", { name: "Confirmar tarjetón" }).click()
  await expect(page.getByText("Tarjetón confirmado")).toBeVisible({ timeout: 30_000 })
}

// ─────────────────────────────────────────────────────────────
// 1) Dos contextos separados (aislamiento normal)
// ─────────────────────────────────────────────────────────────

test.describe("Aislamiento con dos contextos separados", () => {
  test("B no ve datos de A en un contexto distinto", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "El cierre de sesión usa el sidebar de escritorio.")
    const contextA = await browser.newContext({ storageState: EMPTY_STATE })
    const pageA = await signIn(contextA, A_EMAIL!, A_PASS!)
    await importAndConfirm(pageA, pdfA)
    await contextA.close()

    const contextB = await browser.newContext({ storageState: EMPTY_STATE })
    const pageB = await signIn(contextB, B_EMAIL!, B_PASS!)
    await pageB.goto(`${BASE}/profile/mi-informacion-laboral`)
    // B no debe ver la matrícula de A (ni sus datos importados).
    await expect(pageB.getByText("900001")).toHaveCount(0)
    expect(await pageB.evaluate(() => Object.keys(localStorage))).not.toContain("nomina_profile")
    await contextB.close()
  })
})

// ─────────────────────────────────────────────────────────────
// 2) Un mismo contexto: A → B → A con login/logout real
// ─────────────────────────────────────────────────────────────

test.describe("Cambio de cuenta en un mismo contexto (A → B → A)", () => {
  test("A importa, B no ve A, B importa mismo periodo, A recupera solo lo suyo", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name.includes("mobile"), "El cierre de sesión usa el sidebar de escritorio.")
    const context = await browser.newContext({ storageState: EMPTY_STATE })

    // ── A: sesión + import ──
    const pageA = await signIn(context, A_EMAIL!, A_PASS!)
    await importAndConfirm(pageA, pdfA)
    await pageA.goto(`${BASE}/profile/mi-informacion-laboral`)
    // A ve su propia matrícula (marcador de propiedad) y no la de B.
    await expect(pageA.getByText("900001").first()).toBeVisible()
    await expect(pageA.getByText("900002")).toHaveCount(0)

    // ── Logout real de A (sin destruir el contexto) ──
    await signOut(pageA)

    // ── B: inicia sesión en el MISMO contexto ──
    const pageB = await signIn(context, B_EMAIL!, B_PASS!)
    await pageB.goto(`${BASE}/profile/mi-informacion-laboral`)
    // Sin datos de A tras el cambio de cuenta.
    await expect(pageB.getByText("900001")).toHaveCount(0)
    await expect(pageB.getByText("900002")).toHaveCount(0)

    // B importa un tarjetón del MISMO periodo.
    await importAndConfirm(pageB, pdfB)
    await pageB.goto(`${BASE}/profile/mi-informacion-laboral`)
    await expect(pageB.getByText("900002").first()).toBeVisible()
    await expect(pageB.getByText("900001")).toHaveCount(0)

    // ── Logout de B y regreso a A ──
    await signOut(pageB)
    const pageA2 = await signIn(context, A_EMAIL!, A_PASS!)
    await pageA2.goto(`${BASE}/profile/mi-informacion-laboral`)
    // A conserva SOLO lo suyo.
    await expect(pageA2.getByText("900001").first()).toBeVisible()
    await expect(pageA2.getByText("900002")).toHaveCount(0)

    // ── Regreso a B: conserva solo lo suyo ──
    await signOut(pageA2)
    const pageB2 = await signIn(context, B_EMAIL!, B_PASS!)
    await pageB2.goto(`${BASE}/profile/mi-informacion-laboral`)
    await expect(pageB2.getByText("900002").first()).toBeVisible()
    await expect(pageB2.getByText("900001")).toHaveCount(0)

    await context.close()
  })
})
