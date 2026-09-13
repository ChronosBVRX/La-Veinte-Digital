import { test, expect } from "../fixtures/test"

test.describe("Nomina - Carga", () => {
  test("carga la pagina de nomina", async ({ page }) => {
    await page.goto("/nomina")
    await page.waitForLoadState("networkidle")
    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
  })

  test("nomina recarga sin error de hidratacion", async ({ page }) => {
    await page.goto("/nomina")
    await page.waitForLoadState("networkidle")
    await page.reload()
    await page.waitForLoadState("networkidle")
    const errorOverlay = page.locator("[data-nextjs-dialog-overlay], nextjs-portal")
    await expect(errorOverlay).not.toBeVisible({ timeout: 5000 })
  })

  test("perfil de nomina carga correctamente", async ({ page }) => {
    await page.goto("/nomina/perfil")
    await page.waitForLoadState("networkidle")
    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
  })

  test("proyeccion de nomina carga correctamente", async ({ page }) => {
    await page.goto("/nomina/proyeccion")
    await page.waitForLoadState("networkidle")
    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
  })

  test("navegacion movil en nomina", async ({ page }) => {
    await page.goto("/nomina")
    await page.waitForLoadState("networkidle")
    const hasScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 5
    })
    expect(hasScroll, "No debe haber scroll horizontal").toBe(true)
  })
})

test.describe("Simulador de Audiencia", () => {
  test("carga el simulador de audiencia", async ({ page }) => {
    await page.goto("/simulador")
    await page.waitForLoadState("networkidle")
    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
  })
})
