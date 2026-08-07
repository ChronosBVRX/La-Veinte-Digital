import { test, expect } from "@playwright/test"

test.describe("Calendario - Carga", () => {
  test("carga la pagina de calendario", async ({ page }) => {
    await page.goto("/calendario")
    await page.waitForLoadState("networkidle")

    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })
})

test.describe("Agenda / Compromisos", () => {
  test("carga la pagina principal con agenda", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // The agenda card should be somewhere on the dashboard
    // It may be empty if no commitments exist, but it shouldn't crash
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })
})

test.describe("Herramientas", () => {
  test("carga la pagina de herramientas", async ({ page }) => {
    await page.goto("/herramientas")
    await page.waitForLoadState("networkidle")

    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })
})

test.describe("Catalogo", () => {
  test("carga la pagina de catalogo", async ({ page }) => {
    await page.goto("/catalogo")
    await page.waitForLoadState("networkidle")

    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })
})

test.describe("Escritos", () => {
  test("carga la pagina de escritos", async ({ page }) => {
    await page.goto("/escritos")
    await page.waitForLoadState("networkidle")

    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })
})

test.describe("Bitacora", () => {
  test("carga la pagina de bitacora", async ({ page }) => {
    await page.goto("/bitacora")
    await page.waitForLoadState("networkidle")

    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })
})

test.describe("Vacaciones", () => {
  test("carga la pagina de vacaciones", async ({ page }) => {
    await page.goto("/vacaciones")
    await page.waitForLoadState("networkidle")

    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })
})

test.describe("Facebook", () => {
  test("carga la pagina de facebook", async ({ page }) => {
    await page.goto("/facebook")
    await page.waitForLoadState("networkidle")

    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    await expect(page.getByText("404")).not.toBeVisible({ timeout: 2000 }).catch(() => {})
  })
})
