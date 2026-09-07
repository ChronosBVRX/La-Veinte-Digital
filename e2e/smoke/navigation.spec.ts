import { test, expect, assertPageLoaded } from "../fixtures/test"
import { ALL_ROUTES, CALCULATOR_ROUTES, hasHorizontalScroll } from "../utils/helpers"

test.describe("Navegacion completa - Desktop", () => {
  for (const route of ALL_ROUTES) {
    test(`ruta ${route.href} carga contenido`, async ({ page }) => {
      await page.goto(route.href)
      await page.waitForLoadState("networkidle")
      await assertPageLoaded(page)
    })
  }
})

test.describe("Calculadoras - sub rutas", () => {
  for (const route of CALCULATOR_ROUTES) {
    test(`calculadora ${route.href} carga contenido`, async ({ page }) => {
      await page.goto(route.href)
      await page.waitForLoadState("networkidle")
      await assertPageLoaded(page)
    })
  }
})

test.describe("Navegacion movil", () => {
  test("no hay scroll horizontal inesperado", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    const hasScroll = await hasHorizontalScroll(page)
    expect(hasScroll, "La pagina no debe tener scroll horizontal").toBe(false)
  })

  test("barra informativa inferior es visible en viewport estrecho", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    const vw = page.viewportSize()
    if (vw && vw.width >= 768) {
      test.skip(true, "Barra informativa solo visible en viewports < 768px")
    }
    // La navegación inferior redundante se sustituyó por MobileValueBar:
    // un consejo con CTA real y sin menú inferior antiguo.
    const bar = page.getByLabel("Consejo de La Veinte Digital")
    await expect(bar).toBeAttached({ timeout: 5000 })
    await expect(bar.locator("a[href]")).toHaveCount(1)
    await expect(page.locator(".mobile-bottom-nav")).toHaveCount(0)
  })
})

test.describe("Sidebar desktop", () => {
  test("sidebar contiene enlaces de navegacion principales", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    const vw = page.viewportSize()
    if (vw && vw.width < 768) {
      test.skip(true, "Sidebar desktop solo visible en viewports >= 768px")
    }
    await expect(page.locator('a[href="/calculadoras"]').first()).toBeAttached()
    await expect(page.locator('a[href="/escritos"]').first()).toBeAttached()
    await expect(page.locator('a[href="/asistente"]').first()).toBeAttached()
  })
})
