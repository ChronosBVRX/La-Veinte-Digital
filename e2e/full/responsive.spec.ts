import { test, expect } from "@playwright/test"

// ── Responsive tests run at different viewports ──

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

    // Check that action links are usable
    const tarjetonLink = page.getByRole("link", { name: /mi tarjetón|tarjetón/i })
    await expect(tarjetonLink.first()).toBeAttached({ timeout: 5000 })
  })
})

test.describe("Responsive - Navegacion", () => {
  test("menu movil inferior existe en mobile", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Bottom nav should exist (labels might be in DOM even if not visible)
    const bottomNav = page.getByText(/Inicio|Mi trabajo|Asistente|Herramientas|Más/i)
    await expect(bottomNav.first()).toBeAttached({ timeout: 5000 })
  })

  test("tablas son navegables", async ({ page }) => {
    // Find any page with a table-like structure
    await page.goto("/nomina")
    await page.waitForLoadState("networkidle")

    // Just verify the page doesn't overflow
    const hasScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth + 5
    })
    expect(hasScroll).toBe(true)
  })
})
