import { test, expect } from "@playwright/test"

test.describe("Perfil - visualizacion", () => {
  test("pagina de perfil carga correctamente", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    // Should show Informacion personal tab
    await expect(page.getByText("Información personal")).toBeVisible({ timeout: 10_000 })

    // Should show the profile form fields
    await expect(page.getByLabel("Nombre completo")).toBeVisible()
    await expect(page.getByLabel("Teléfono")).toBeVisible()
  })

  test("muestra email del usuario", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    // The email should be displayed somewhere on the page
    const emailText = page.locator("body").filter({ hasText: /@/ })
    await expect(emailText).toBeVisible({ timeout: 5000 })
  })

  test("tiene enlace a datos laborales", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    const laboralLink = page.getByRole("link", { name: /datos laborales|información laboral/i })
    await expect(laboralLink).toBeVisible()
  })

  test("formulario de perfil laboral carga correctamente", async ({ page }) => {
    await page.goto("/profile/mi-informacion-laboral")
    await page.waitForLoadState("networkidle")

    // Should have some form content
    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    expect(bodyText).not.toContain("404")
  })
})

test.describe("Perfil - edicion", () => {
  test("guarda nombre completo correctamente", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    const nameInput = page.getByLabel("Nombre completo")
    await nameInput.fill("Usuario de Prueba E2E")

    const saveBtn = page.getByRole("button", { name: /guardar cambios/i })
    await saveBtn.click()

    // Should show success message
    const successMsg = page.getByText("Perfil actualizado")
    await expect(successMsg).toBeVisible({ timeout: 10_000 })
  })

  test("nombre completo es obligatorio", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    const nameInput = page.getByLabel("Nombre completo")
    await nameInput.clear()

    const saveBtn = page.getByRole("button", { name: /guardar cambios/i })
    await saveBtn.click()

    // Should show error
    await expect(page.getByText(/nombre completo es obligatorio/i)).toBeVisible({ timeout: 5000 })
  })

  test("telefono invalido muestra error", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    const phoneInput = page.getByLabel("Teléfono")
    await phoneInput.fill("abc")

    const saveBtn = page.getByRole("button", { name: /guardar cambios/i })
    await saveBtn.click()

    await expect(page.getByText(/teléfono inválido/i)).toBeVisible({ timeout: 5000 })
  })

  test("persiste cambios tras recarga", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")

    const testName = "Test E2E Persist"

    const nameInput = page.getByLabel("Nombre completo")
    await nameInput.clear()
    await nameInput.fill(testName)

    const saveBtn = page.getByRole("button", { name: /guardar cambios/i })
    await saveBtn.click()
    await expect(page.getByText("Perfil actualizado")).toBeVisible({ timeout: 10_000 })

    // Reload and verify
    await page.reload()
    await page.waitForLoadState("networkidle")

    const persistedInput = page.getByLabel("Nombre completo")
    await expect(persistedInput).toHaveValue(testName)
  })
})
