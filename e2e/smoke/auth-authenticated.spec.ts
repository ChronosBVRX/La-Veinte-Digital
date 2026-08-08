import { test, expect } from "../fixtures/test"

test.describe("Sesion autenticada", () => {
  test("dashboard carga correctamente con sesion persistente", async ({ page }) => {
    await page.goto("/")
    await expect(page).not.toHaveURL(/\/login/)
    const heading = page.getByRole("heading", { level: 1 })
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test("recarga mantiene sesion", async ({ page }) => {
    await page.goto("/")
    await page.reload()
    await expect(page).not.toHaveURL(/\/login/)
    const heading = page.getByRole("heading", { level: 1 })
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })
})

test.describe("Comportamiento de sesion", () => {
  test("visitar login estando autenticado redirige a dashboard", async ({ page }) => {
    await page.goto("/login")
    // Already authenticated, should redirect to dashboard
    await expect(page).toHaveURL("/")
  })

  test("ruta protegida es accesible con sesion activa", async ({ page }) => {
    await page.goto("/profile")
    await expect(page).not.toHaveURL(/\/login/)
  })
})
