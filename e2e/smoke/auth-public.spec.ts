import { test, expect } from "@playwright/test"

test.describe("Acceso publico - sin sesion", () => {
  test("redirige a login cuando no hay sesion", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login/)
  })

  test("ruta protegida sin sesion redirige a login", async ({ page }) => {
    await page.goto("/nomina")
    await expect(page).toHaveURL(/\/login/)
  })

  test("login falla con credenciales incorrectas", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Correo electrónico").fill("noexiste@test.com")
    await page.getByLabel("Contraseña").fill("password-incorrecto")
    await page.getByRole("button", { name: /iniciar sesión/i }).click()

    const errorIndicator = page.locator('[style*="--error"], [style*="fef2f2"]')
    await expect(errorIndicator).toBeVisible({ timeout: 10_000 })
  })

  test("login muestra formulario con campos requeridos", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByLabel("Correo electrónico")).toBeVisible()
    await expect(page.getByLabel("Contraseña")).toBeVisible()
    await expect(page.getByRole("button", { name: /iniciar sesión/i })).toBeVisible()
    await expect(page.getByText("Regístrate")).toBeVisible()
  })

  test("login tiene botones OAuth", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /facebook/i })).toBeVisible()
  })

  test("pagina de registro carga correctamente", async ({ page }) => {
    await page.goto("/register")
    await expect(page.getByText(/crear cuenta/i)).toBeVisible()
    await expect(page.getByLabel(/nombre/i)).toBeVisible()
    await expect(page.getByLabel("Correo electrónico")).toBeVisible()
    await expect(page.getByLabel("Contraseña")).toBeVisible()
  })

  test("link de registro navega a /register", async ({ page }) => {
    await page.goto("/login")
    await page.getByText("Regístrate").click()
    await expect(page).toHaveURL(/\/register/)
  })

  test("API health responde sin autenticacion", async ({ page }) => {
    const response = await page.request.get("/api/health")
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty("status", "ok")
  })
})
