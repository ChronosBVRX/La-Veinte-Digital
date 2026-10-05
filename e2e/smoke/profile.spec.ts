import { test, expect } from "../fixtures/test"

test.describe("Perfil unificado - visualizacion", () => {
  test("pagina de perfil carga correctamente con ficha del trabajador", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByText("Ficha del Trabajador")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("Matrícula IMSS")).toBeVisible()
    await expect(page.getByText("Categoría sindical")).toBeVisible()
  })

  test("muestra email del usuario", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("domcontentloaded")
    const emailText = page.locator("body").filter({ hasText: /@/ })
    await expect(emailText).toBeVisible({ timeout: 10_000 })
  })

  test("tiene seccion para importar tarjeton y enlace a documentos personales", async ({ page }) => {
    await page.goto("/profile")
    await page.waitForLoadState("domcontentloaded")
    await expect(
      page.getByRole("heading", { name: /Importar mi tarjetón IMSS|Actualizar con nuevo tarjetón IMSS/i }),
    ).toBeVisible({ timeout: 15_000 })
    const docsLink = page.getByRole("link", { name: /Ver mis documentos personales/i })
    await expect(docsLink).toBeVisible()
  })

  test("ruta /profile/mi-informacion-laboral carga correctamente", async ({ page }) => {
    await page.goto("/profile/mi-informacion-laboral")
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByText("Ficha del Trabajador")).toBeVisible({ timeout: 15_000 })
    const bodyText = await page.locator("body").innerText()
    expect(bodyText.length).toBeGreaterThan(50)
    expect(bodyText).not.toContain("404")
  })

  test("pagina de configuracion (/profile/configuracion) carga correctamente", async ({ page }) => {
    await page.goto("/profile/configuracion")
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByRole("heading", { name: /Configuración/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("Cuenta y Sesión")).toBeVisible()
  })
})
