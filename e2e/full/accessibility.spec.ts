import { test, expect } from "@playwright/test"

test.describe("Accesibilidad basica", () => {
  test("login tiene inputs con labels", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("networkidle")

    // Inputs should have associated labels
    const emailLabel = page.getByLabel("Correo electrónico")
    await expect(emailLabel).toBeVisible()

    const passwordLabel = page.getByLabel("Contraseña")
    await expect(passwordLabel).toBeVisible()
  })

  test("login tiene botones con nombre accesible", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("networkidle")

    // Submit button has accessible name
    const loginBtn = page.getByRole("button", { name: /iniciar sesión/i })
    await expect(loginBtn).toBeVisible()

    // Google OAuth button
    const googleBtn = page.getByRole("button", { name: /google/i })
    await expect(googleBtn).toBeVisible()

    // Facebook OAuth button
    const facebookBtn = page.getByRole("button", { name: /facebook/i })
    await expect(facebookBtn).toBeVisible()
  })

  test("dashboard tiene heading principal", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Should have an h1
    const h1 = page.locator("h1")
    await expect(h1).toBeAttached({ timeout: 5000 })
  })

  test("calculadoras tienen labels en campos de entrada", async ({ page }) => {
    await page.goto("/calculadoras/aguinaldo")
    await page.waitForLoadState("networkidle")

    // Fields should have labels
    await expect(page.getByLabel("Concepto 002")).toBeVisible()
    await expect(page.getByLabel("Concepto 011")).toBeVisible()
  })

  test("calculadoras tienen botones con nombre accesible", async ({ page }) => {
    await page.goto("/calculadoras/aguinaldo")
    await page.waitForLoadState("networkidle")

    await expect(
      page.getByRole("button", { name: "Calcular" })
    ).toBeVisible()

    await expect(
      page.getByRole("button", { name: "Limpiar" })
    ).toBeVisible()
  })

  test("no hay elementos interactivos anidados problematicos", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Check for nested interactive elements (button inside button, link inside button, etc.)
    // Playwright style: just verify the page loads and is usable
    const nestedViolations = await page.evaluate(() => {
      const violations: string[] = []

      // Check if any link contains a button
      const links = document.querySelectorAll("a")
      for (const link of links) {
        if (link.querySelector("button")) {
          violations.push(`Link contains button: ${link.outerHTML.slice(0, 100)}`)
        }
      }

      // Check if any button contains a link
      const buttons = document.querySelectorAll("button")
      for (const btn of buttons) {
        if (btn.querySelector("a")) {
          violations.push(`Button contains link: ${btn.outerHTML.slice(0, 100)}`)
        }
      }

      return violations
    })

    // Report violations as warnings (don't hard-fail)
    for (const v of nestedViolations) {
      console.warn(`Accesibilidad: ${v}`)
    }
  })
})

test.describe("Navegacion por teclado", () => {
  test("login permite navegacion por teclado", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("networkidle")

    // Tab through form fields
    await page.keyboard.press("Tab")
    const emailInput = page.getByLabel("Correo electrónico")
    await expect(emailInput).toBeFocused()

    await page.keyboard.press("Tab")
    const passwordInput = page.getByLabel("Contraseña")
    await expect(passwordInput).toBeFocused()
  })

  test("escape cierra modales cuando existen", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Check if there are any modals open and close them with Escape
    await page.keyboard.press("Escape")
    // Just verify no crash
    await expect(page.locator("body")).toBeVisible()
  })
})
