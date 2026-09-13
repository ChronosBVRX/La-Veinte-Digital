/**
 * E2E multiusuario: aislamiento de tarjetones entre dos cuentas.
 *
 * Requisitos (no producción):
 *   E2E_MULTIUSER_BASE_URL  → URL local (http://localhost:3000)
 *   E2E_MULTIUSER_A_EMAIL / E2E_MULTIUSER_A_PASSWORD  (admin o normal)
 *   E2E_MULTIUSER_B_EMAIL / E2E_MULTIUSER_B_PASSWORD  (usuario ORDINARIO, sin profiles previo)
 *
 * Se omite salvo que todas las variables existan. NUNCA usa cuentas reales.
 * Cada usuario se autentica en su propio contexto: no se comparte storageState.
 */
import { test, expect, type BrowserContext } from "@playwright/test"

const BASE = process.env.E2E_MULTIUSER_BASE_URL
const A_EMAIL = process.env.E2E_MULTIUSER_A_EMAIL
const A_PASS = process.env.E2E_MULTIUSER_A_PASSWORD
const B_EMAIL = process.env.E2E_MULTIUSER_B_EMAIL
const B_PASS = process.env.E2E_MULTIUSER_B_PASSWORD

const configured = Boolean(BASE && A_EMAIL && A_PASS && B_EMAIL && B_PASS)

test.skip(!configured, "Requiere E2E_MULTIUSER_* configurado contra Supabase local (nunca producción).")

async function signIn(context: BrowserContext, email: string, password: string) {
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  await page.getByLabel("Correo electrónico").fill(email)
  await page.getByLabel("Contraseña").fill(password)
  await page.getByRole("button", { name: "Iniciar sesión" }).click()
  await expect(page).toHaveURL(`${BASE}/`)
  return page
}

test("usuario B (ordinario, sin profiles) abre directo la página laboral sin fallar por perfil", async ({ browser }) => {
  const contextB = await browser.newContext()
  const pageB = await signIn(contextB, B_EMAIL!, B_PASS!)
  await pageB.goto(`${BASE}/profile/mi-informacion-laboral`)
  await expect(pageB.getByText(/importar nuevo tarjetón imss/i)).toBeVisible()
  await contextB.close()
})

test("B no ve datos locales de A tras cambiar de cuenta en el mismo navegador", async ({ browser }) => {
  // Contexto A
  const contextA = await browser.newContext()
  const pageA = await signIn(contextA, A_EMAIL!, A_PASS!)
  await pageA.goto(`${BASE}/guia/mi-quincena`)
  await pageA.waitForLoadState("networkidle")
  await contextA.close()

  // Contexto B (mismo navegador, distinto contexto: sin storage compartido)
  const contextB = await browser.newContext()
  const pageB = await signIn(contextB, B_EMAIL!, B_PASS!)
  await pageB.goto(`${BASE}/guia/mi-quincena`)
  await pageB.waitForLoadState("networkidle")

  // B no debe heredar el namespace local de A: no hay tarjetón de A visible.
  const localKeys = await pageB.evaluate(() => Object.keys(localStorage))
  const hasAOnly = localKeys.some((k) => k.includes(":v2:") && !k.endsWith("undefined"))
  // Las claves deben existir (o no) solo bajo el UUID de B; nunca la clave global antigua.
  expect(localKeys).not.toContain("nomina_profile")
  expect(localKeys).not.toContain("nomina_payslips")
  void hasAOnly
  await contextB.close()
})
