import { test, expect } from "../fixtures/test"

test.describe("Perfil - visualizacion", () => {
  test("pagina de perfil carga correctamente", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Información personal")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel("Nombre completo")).toBeVisible()
    await expect(page.getByLabel("Teléfono")).toBeVisible()
  })

  test("muestra email del usuario", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    const emailText = page.locator("body").filter({ hasText: /@/ })
    await expect(emailText).toBeVisible({ timeout: 5000 })
  })

  test("tiene enlace a datos laborales", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    const laboralLink = page.getByRole("link", { name: /datos laborales|información laboral/i })
    await expect(laboralLink.first()).toBeVisible()
  })

  test("formulario de perfil laboral carga correctamente", async ({ page }) => {
    await page.goto("/profile/mi-informacion-laboral")
    await page.waitForLoadState("networkidle")
    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    expect(bodyText).not.toContain("404")
  })
})

test.describe("Perfil - edicion", () => {
  test("guarda nombre completo correctamente", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Nombre completo").fill("Usuario de Prueba E2E")
    await page.getByRole("button", { name: /guardar cambios/i }).click()
    await expect(page.getByText("Perfil actualizado")).toBeVisible({ timeout: 10_000 })
  })

  test("nombre completo es obligatorio", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Nombre completo").clear()
    await page.getByRole("button", { name: /guardar cambios/i }).click()
    // Browser native validation fires before server action; check validity
    await expect(page.getByLabel("Nombre completo")).toHaveJSProperty("validity.valueMissing", true)
  })

  test("telefono invalido muestra error", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Teléfono").fill("abc")
    await page.getByRole("button", { name: /guardar cambios/i }).click()
    await expect(page.getByText(/teléfono inválido/i)).toBeVisible({ timeout: 5000 })
  })

  test("persiste cambios tras recarga", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    const testName = "Test E2E Persist"
    await page.getByLabel("Nombre completo").clear()
    await page.getByLabel("Nombre completo").fill(testName)
    await page.getByRole("button", { name: /guardar cambios/i }).click()
    await expect(page.getByText("Perfil actualizado")).toBeVisible({ timeout: 10_000 })
    await page.reload()
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByLabel("Nombre completo")).toHaveValue(testName)
  })
})
