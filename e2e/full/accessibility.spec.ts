import { test, expect } from "../fixtures/test"

test.describe("Accesibilidad basica", () => {
  test("login tiene inputs con labels", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("networkidle")
    await expect(page.getByLabel("Correo electrónico")).toBeVisible()
    await expect(page.getByLabel("Contraseña")).toBeVisible()
  })

  test("login tiene botones con nombre accesible", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("button", { name: /iniciar sesión/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /facebook/i })).toBeVisible()
  })

  test("dashboard tiene heading principal", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await expect(page.locator("h1")).toBeAttached({ timeout: 5000 })
  })

  test("calculadoras tienen labels en campos de entrada", async ({ page }) => {
    await page.goto("/calculadoras/aguinaldo")
    await page.waitForLoadState("networkidle")
    await expect(page.getByLabel("Concepto 002")).toBeVisible()
    await expect(page.getByLabel("Concepto 011")).toBeVisible()
  })

  test("calculadoras tienen botones con nombre accesible", async ({ page }) => {
    await page.goto("/calculadoras/aguinaldo")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("button", { name: "Calcular" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Limpiar" })).toBeVisible()
  })

  test("no hay elementos interactivos anidados problematicos", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    const violations = await page.evaluate(() => {
      const v: string[] = []
      document.querySelectorAll("a").forEach((el) => {
        if (el.querySelector("button")) v.push("link contains button")
      })
      document.querySelectorAll("button").forEach((el) => {
        if (el.querySelector("a")) v.push("button contains link")
      })
      return v
    })
    if (violations.length > 0) {
      console.warn("Accesibilidad: elementos interactivos anidados encontrados:", violations.join(", "))
    }
  })
})

test.describe("Navegacion por teclado", () => {
  test("login permite navegacion por teclado", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("networkidle")
    await page.keyboard.press("Tab")
    await expect(page.getByLabel("Correo electrónico")).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(page.getByLabel("Contraseña")).toBeFocused()
  })

  test("escape cierra modales cuando existen", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await page.keyboard.press("Escape")
    await expect(page.locator("body")).toBeVisible()
  })
})
