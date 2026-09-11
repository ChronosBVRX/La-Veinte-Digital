import { test, expect } from "../fixtures/test"
import { assertSafeDatabase } from "../utils/assert-safe-database"

/**
 * MUTATING E2E TESTS — PERFIL
 *
 * Estas pruebas realizan mutaciones reales en la base de datos (UPDATE sobre tabla 'profiles').
 * Están estrictamente prohibidas contra entornos de producción (ragktminwduiggvaoeix / la20.com.mx / laveinte.com).
 * Requieren Supabase local (127.0.0.1:54321) o entorno de staging aislado.
 */
test.describe("Perfil - edicion (mutante, protegido contra produccion)", () => {
  test.beforeEach(() => {
    // Falla cerrado inmediatamente si el entorno objetivo es producción
    assertSafeDatabase()
  })

  test("guarda nombre completo correctamente", async ({ page }) => {
    assertSafeDatabase()
    await page.goto("/profile")
    const nameInput = page.getByLabel("Nombre completo")
    await expect(nameInput).toBeVisible({ timeout: 15_000 })
    const original = await nameInput.inputValue()
    try {
      await nameInput.fill("Usuario de Prueba E2E")
      await page.getByRole("button", { name: /guardar cambios/i }).click()
      await expect(page.getByText("Perfil actualizado")).toBeVisible({ timeout: 10_000 })
    } finally {
      if (original && original !== "Usuario de Prueba E2E") {
        await nameInput.clear()
        await nameInput.fill(original)
        await page.getByRole("button", { name: /guardar cambios/i }).click()
        await expect(page.getByText("Perfil actualizado")).toBeVisible({ timeout: 10_000 }).catch(() => {})
      }
    }
  })

  test("persiste cambios tras recarga", async ({ page }) => {
    assertSafeDatabase()
    await page.goto("/profile")
    const nameInput = page.getByLabel("Nombre completo")
    await expect(nameInput).toBeVisible({ timeout: 15_000 })
    const original = await nameInput.inputValue()
    try {
      const testName = "Test E2E Persist"
      await nameInput.clear()
      await nameInput.fill(testName)
      await page.getByRole("button", { name: /guardar cambios/i }).click()
      await expect(page.getByText("Perfil actualizado")).toBeVisible({ timeout: 10_000 })
      await page.reload()
      await expect(nameInput).toBeVisible({ timeout: 15_000 })
      await expect(nameInput).toHaveValue(testName)
    } finally {
      if (original && original !== "Test E2E Persist") {
        await nameInput.clear()
        await nameInput.fill(original)
        await page.getByRole("button", { name: /guardar cambios/i }).click()
        await expect(page.getByText("Perfil actualizado")).toBeVisible({ timeout: 10_000 }).catch(() => {})
      }
    }
  })
})
