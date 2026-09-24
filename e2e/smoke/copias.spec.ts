import { test, expect, assertPageLoaded } from "../fixtures/test"

test.describe("Servicio Sacar copias (/copias)", () => {
  test("carga la página de copias correctamente", async ({ page }) => {
    await page.goto("/copias")
    await page.waitForLoadState("domcontentloaded")
    await assertPageLoaded(page)

    // Heading principal
    await expect(page.getByRole("heading", { name: "Sacar copias" })).toBeVisible({ timeout: 15_000 })

    // Mensaje de privacidad
    await expect(page.getByText(/No se guardará automáticamente en tus documentos/i)).toBeVisible()

    // Opciones principales
    await expect(page.getByTestId("copy-option-document")).toBeVisible()
    await expect(page.getByTestId("copy-option-ine")).toBeVisible()
  })

  test("tarjeta de acceso en inicio enlaza a /copias", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("domcontentloaded")
    await assertPageLoaded(page)

    // Si el acceso a copias está en el carrusel de destacados, cambiamos al slide correspondiente
    const copiasTab = page.getByRole("tab", { name: /Sacar copias/i })
    await copiasTab.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {})
    if (await copiasTab.isVisible()) {
      await copiasTab.click()
    }

    const copiasLink = page.getByRole("link", { name: /Sacar una copia/i })
    await expect(copiasLink).toBeVisible({ timeout: 10_000 })
    expect(await copiasLink.getAttribute("href")).toBe("/copias")
  })
})
