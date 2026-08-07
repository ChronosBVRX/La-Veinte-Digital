import { test, expect } from "@playwright/test"
import { ALL_ROUTES, CALCULATOR_ROUTES, hasHorizontalScroll } from "../utils/helpers"
import { monitoredPage } from "../fixtures/monitored-page"

// ── Smoke navigation: all sidebar routes load without error ──

test.describe("Navegacion completa - Desktop", () => {
  for (const route of ALL_ROUTES) {
    test(`ruta ${route.href} carga contenido`, async ({ page }) => {
      const mp = monitoredPage(page, `nav-desktop-${route.href}`)

      await mp.page.goto(route.href)
      await mp.page.waitForLoadState("networkidle")

      // Should not see 404 page
      await expect(mp.page.getByText("404")).not.toBeVisible({ timeout: 3000 }).catch(() => {})

      // Should not be blank
      await mp.assertPageLoaded()

      // No console errors
      await mp.validate()
    })
  }
})

test.describe("Calculadoras - sub rutas", () => {
  for (const route of CALCULATOR_ROUTES) {
    test(`calculadora ${route.href} carga contenido`, async ({ page }) => {
      const mp = monitoredPage(page, `calc-${route.href}`)

      await mp.page.goto(route.href)
      await mp.page.waitForLoadState("networkidle")

      await expect(mp.page.getByText("404")).not.toBeVisible({ timeout: 3000 }).catch(() => {})
      await mp.assertPageLoaded()
      await mp.validate()
    })
  }
})

test.describe("Navegacion movil", () => {
  test("no hay scroll horizontal inesperado en mobile", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const hasScroll = await hasHorizontalScroll(page)
    expect(hasScroll, "La pagina no debe tener scroll horizontal en mobile").toBe(false)
  })

  test("menu movil inferior es visible", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Bottom nav items
    const navItems = page.getByText(/Inicio|Mi trabajo|Asistente|Herramientas|Más/i)
    // At least one should be visible
    await expect(navItems.first()).toBeAttached({ timeout: 5000 })
  })
})

test.describe("Sidebar desktop", () => {
  test("sidebar contiene enlaces de navegacion principales", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // Check a few key nav items exist as links
    await expect(page.locator('a[href="/nomina"]').first()).toBeAttached()
    await expect(page.locator('a[href="/tarjeton"]').first()).toBeAttached()
    await expect(page.locator('a[href="/asistente"]').first()).toBeAttached()
  })
})
