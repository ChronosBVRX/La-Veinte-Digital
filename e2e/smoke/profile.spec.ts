import { test, expect } from "../fixtures/test"

test.describe("Perfil - visualizacion", () => {
  test("pagina de perfil carga correctamente", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByText("Información personal")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByLabel("Nombre completo")).toBeVisible()
    await expect(page.getByLabel("Teléfono")).toBeVisible()
  })

  test("muestra email del usuario", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("domcontentloaded")
    const emailText = page.locator("body").filter({ hasText: /@/ })
    await expect(emailText).toBeVisible({ timeout: 10_000 })
  })

  test("tiene enlace a datos laborales", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("domcontentloaded")
    const laboralLink = page.getByRole("link", { name: /datos laborales|información laboral/i })
    await expect(laboralLink.first()).toBeVisible()
  })

  test("formulario de perfil laboral carga correctamente", async ({ page }) => {
    await page.goto("/profile/mi-informacion-laboral")
    await page.waitForLoadState("domcontentloaded")
    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    expect(bodyText).not.toContain("404")
  })
})

test.describe("Perfil - validacion cliente sin mutacion", () => {
  test("nombre completo es obligatorio (validacion nativa HTML5, sin envio a servidor)", async ({ page }) => {
    await page.goto("/profile")
    const nameInput = page.getByLabel("Nombre completo")
    await expect(nameInput).toBeVisible({ timeout: 15_000 })
    const original = await nameInput.inputValue()
    try {
      await nameInput.clear()
      await page.getByRole("button", { name: /guardar cambios/i }).click()
      // La validación nativa del navegador bloquea el submit antes de llegar al backend
      await expect(nameInput).toHaveJSProperty("validity.valueMissing", true)
    } finally {
      if (original) {
        await nameInput.fill(original)
      }
    }
  })

  test("telefono invalido muestra error (validacion regex en cliente, sin persistencia en backend)", async ({ page }) => {
    await page.goto("/profile")
    const phoneInput = page.getByLabel("Teléfono")
    await expect(phoneInput).toBeVisible({ timeout: 15_000 })
    const originalPhone = await phoneInput.inputValue()
    try {
      await phoneInput.fill("abc")
      await page.getByRole("button", { name: /guardar cambios/i }).click()
      // La validación de regex en ProfileForm retorna un error antes de invocar supabase.rpc o update
      await expect(page.getByText(/teléfono inválido/i)).toBeVisible({ timeout: 5000 })
    } finally {
      await phoneInput.clear()
      if (originalPhone) {
        await phoneInput.fill(originalPhone)
      }
    }
  })
})
