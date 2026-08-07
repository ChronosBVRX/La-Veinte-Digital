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

test.describe("Cierre de sesion", () => {
  test("boton de logout existe en perfil", async ({ page }) => {
    await page.goto("/profile")
    const logoutBtn = page.getByRole("button", { name: /cerrar sesión|salir|logout/i })
    await expect(logoutBtn).toBeAttached({ timeout: 10_000 })
  })

  test("ruta protegida pide autenticacion despues de visitar login", async ({ page }) => {
    await page.goto("/login")
    await expect(page).toHaveURL(/\/login/)
  })
})
