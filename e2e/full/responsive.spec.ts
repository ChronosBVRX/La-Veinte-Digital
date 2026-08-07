import { test, expect } from "../fixtures/test"

test.describe("Responsive - Dashboard", () => {
  test("dashboard no tiene scroll horizontal en mobile", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    const hasScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 5
    })
    expect(hasScroll, "No debe haber scroll horizontal en mobile").toBe(true)
  })

  test("botones principales son utilizables en mobile", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    const tarjetonLink = page.getByRole("link", { name: /mi tarjetón|tarjetón/i })
    await expect(tarjetonLink.first()).toBeAttached({ timeout: 5000 })
  })
})

test.describe("Responsive - Navegacion", () => {
  test("menu movil inferior existe en mobile", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    const bottomNav = page.getByText(/Inicio|Mi trabajo|Asistente|Herramientas|Más/i)
    await expect(bottomNav.first()).toBeAttached({ timeout: 5000 })
  })

  test("tablas son navegables", async ({ page }) => {
    await page.goto("/nomina")
    await page.waitForLoadState("networkidle")
    const hasScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 5
    })
    expect(hasScroll).toBe(true)
  })
})
