import { test, expect, type Page } from "../fixtures/test"

async function checkPageLoads(page: Page) {
  await page.waitForLoadState("networkidle")
  const bodyText = await page.locator("body").innerText()
  expect(bodyText.length).toBeGreaterThan(50)
}

test.describe("Calendario", () => {
  test("carga la pagina de calendario", async ({ page }) => {
    await page.goto("/calendario")
    await checkPageLoads(page)
  })
})

test.describe("Herramientas", () => {
  test("carga la pagina de herramientas", async ({ page }) => {
    await page.goto("/herramientas")
    await checkPageLoads(page)
  })
})

test.describe("Catalogo", () => {
  test("carga la pagina de catalogo", async ({ page }) => {
    await page.goto("/catalogo")
    await checkPageLoads(page)
  })
})

test.describe("Escritos", () => {
  test("carga la pagina de escritos", async ({ page }) => {
    await page.goto("/escritos")
    await checkPageLoads(page)
  })
})

test.describe("Bitacora", () => {
  test("carga la pagina de bitacora", async ({ page }) => {
    await page.goto("/bitacora")
    await checkPageLoads(page)
  })
})

test.describe("Vacaciones", () => {
  test("carga la pagina de vacaciones", async ({ page }) => {
    await page.goto("/vacaciones")
    await checkPageLoads(page)
  })
})

test.describe("Facebook", () => {
  test("carga la pagina de facebook", async ({ page }) => {
    await page.goto("/facebook")
    await checkPageLoads(page)
  })
})
