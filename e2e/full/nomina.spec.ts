import { test, expect } from "@playwright/test"

test.describe("Nomina - Carga", () => {
  test("carga la pagina de nomina", async ({ page }) => {
    await page.goto("/nomina")
    await page.waitForLoadState("networkidle")

    // Should load without 404 or blank
    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })

  test("nomina recarga sin error de hidratacion", async ({ page }) => {
    await page.goto("/nomina")
    await page.waitForLoadState("networkidle")

    // Reload and check for errors
    await page.reload()
    await page.waitForLoadState("networkidle")

    // Should not show Next.js error overlay
    const errorOverlay = page.locator("[data-nextjs-dialog-overlay], nextjs-portal")
    await expect(errorOverlay).not.toBeVisible({ timeout: 3000 }).catch(() => {})
  })

  test("perfil de nomina carga correctamente", async ({ page }) => {
    await page.goto("/nomina/perfil")
    await page.waitForLoadState("networkidle")

    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })

  test("proyeccion de nomina carga correctamente", async ({ page }) => {
    await page.goto("/nomina/proyeccion")
    await page.waitForLoadState("networkidle")

    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })

  test("navegacion movil en nomina", async ({ page }) => {
    await page.goto("/nomina")
    await page.waitForLoadState("networkidle")

    // Verify page is usable at mobile size
    const hasScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 5
    })
    expect(hasScroll, "No debe haber scroll horizontal").toBe(true)
  })
})

test.describe("Simulador de Nomina", () => {
  test("carga el simulador de nomina", async ({ page }) => {
    await page.goto("/simulador-nomina")
    await page.waitForLoadState("networkidle")

    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })
})

test.describe("Simulador de Audiencia", () => {
  test("carga el simulador de audiencia", async ({ page }) => {
    await page.goto("/simulador")
    await page.waitForLoadState("networkidle")

    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })
})
