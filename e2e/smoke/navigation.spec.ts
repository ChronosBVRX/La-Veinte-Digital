import { test, expect, assertPageLoaded } from "../fixtures/test"
import { ALL_ROUTES, CALCULATOR_ROUTES, hasHorizontalScroll } from "../utils/helpers"

test.describe("Navegacion completa - Desktop", () => {
  for (const route of ALL_ROUTES) {
    test(`ruta ${route.href} carga contenido`, async ({ page, errors }) => {
      await page.goto(route.href)
      await page.waitForLoadState("networkidle")
      await assertPageLoaded(page)
    })
  }
})

test.describe("Calculadoras - sub rutas", () => {
  for (const route of CALCULATOR_ROUTES) {
    test(`calculadora ${route.href} carga contenido`, async ({ page, errors }) => {
      await page.goto(route.href)
      await page.waitForLoadState("networkidle")
      await assertPageLoaded(page)
    })
  }
})

test.describe("Navegacion movil", () => {
  test("no hay scroll horizontal inesperado en mobile", async ({ page, errors }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const hasScroll = await hasHorizontalScroll(page)
    expect(hasScroll, "La pagina no debe tener scroll horizontal en mobile").toBe(false)
  })

  test("menu movil inferior es visible", async ({ page, errors }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const navItems = page.getByText(/Inicio|Mi trabajo|Asistente|Herramientas|Más/i)
    await expect(navItems.first()).toBeAttached({ timeout: 5000 })
  })
})

test.describe("Sidebar desktop", () => {
  test("sidebar contiene enlaces de navegacion principales", async ({ page, errors }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    await expect(page.locator('a[href="/nomina"]').first()).toBeAttached()
    await expect(page.locator('a[href="/tarjeton"]').first()).toBeAttached()
    await expect(page.locator('a[href="/asistente"]').first()).toBeAttached()
  })
})
