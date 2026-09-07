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
  let initialName: string = ""
  let initialPhone: string = ""

  test.beforeEach(async ({ page }) => {
    if (!initialName) {
      await page.goto("/profile")
      await page.waitForLoadState("networkidle")
      initialName = (await page.getByLabel("Nombre completo").inputValue()).trim()
      initialPhone = (await page.getByLabel("Teléfono").inputValue()).trim()
    }
  })

  test.afterAll(async ({ browser }) => {
    if (!initialName) return
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await page.goto("/profile")
      await page.waitForLoadState("networkidle")
      const currentName = (await page.getByLabel("Nombre completo").inputValue()).trim()
      if (currentName !== initialName) {
        await page.getByLabel("Nombre completo").clear()
        await page.getByLabel("Nombre completo").fill(initialName)
        if (initialPhone) {
          await page.getByLabel("Teléfono").clear()
          await page.getByLabel("Teléfono").fill(initialPhone)
        }
        await page.getByRole("button", { name: /guardar cambios/i }).click()
        await expect(page.getByText("Perfil actualizado")).toBeVisible({ timeout: 10_000 })
      }
    } catch (e) {
      console.warn("[e2e/smoke/profile] No fue posible restaurar nombre original en afterAll:", e)
    } finally {
      await context.close()
    }
  })

  test("guarda nombre completo correctamente", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    const original = await page.getByLabel("Nombre completo").inputValue()
    try {
      await page.getByLabel("Nombre completo").fill("Usuario de Prueba E2E")
      await page.getByRole("button", { name: /guardar cambios/i }).click()
      await expect(page.getByText("Perfil actualizado")).toBeVisible({ timeout: 10_000 })
    } finally {
      if (original && original !== "Usuario de Prueba E2E") {
        await page.getByLabel("Nombre completo").clear()
        await page.getByLabel("Nombre completo").fill(original)
        await page.getByRole("button", { name: /guardar cambios/i }).click()
        await expect(page.getByText("Perfil actualizado")).toBeVisible({ timeout: 10_000 }).catch(() => {})
      }
    }
  })

  test("nombre completo es obligatorio", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Nombre completo").clear()
    await page.getByRole("button", { name: /guardar cambios/i }).click()
    // Browser native validation fires before server action; check validity
    await expect(page.getByLabel("Nombre completo")).toHaveJSProperty("validity.valueMissing", true)
    // Restaurar valor para no dejar el campo vacío
    if (initialName) {
      await page.getByLabel("Nombre completo").fill(initialName)
    }
  })

  test("telefono invalido muestra error", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    const originalPhone = await page.getByLabel("Teléfono").inputValue()
    try {
      await page.getByLabel("Teléfono").fill("abc")
      await page.getByRole("button", { name: /guardar cambios/i }).click()
      await expect(page.getByText(/teléfono inválido/i)).toBeVisible({ timeout: 5000 })
    } finally {
      await page.getByLabel("Teléfono").clear()
      if (originalPhone) {
        await page.getByLabel("Teléfono").fill(originalPhone)
      }
    }
  })

  test("persiste cambios tras recarga", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("networkidle")
    const original = await page.getByLabel("Nombre completo").inputValue()
    try {
      const testName = "Test E2E Persist"
      await page.getByLabel("Nombre completo").clear()
      await page.getByLabel("Nombre completo").fill(testName)
      await page.getByRole("button", { name: /guardar cambios/i }).click()
      await expect(page.getByText("Perfil actualizado")).toBeVisible({ timeout: 10_000 })
      await page.reload()
      await page.waitForLoadState("domcontentloaded")
      await expect(page.getByLabel("Nombre completo")).toHaveValue(testName)
    } finally {
      if (original && original !== "Test E2E Persist") {
        await page.getByLabel("Nombre completo").clear()
        await page.getByLabel("Nombre completo").fill(original)
        await page.getByRole("button", { name: /guardar cambios/i }).click()
        await expect(page.getByText("Perfil actualizado")).toBeVisible({ timeout: 10_000 }).catch(() => {})
      }
    }
  })
})
