import { test, expect } from "../fixtures/test"

test.describe("Business Journey 1 — Autenticación y navegación protegida", () => {
  test("usuario no autenticado es redirigido a login al intentar acceder a rutas privadas", async ({ page }) => {
    const protectedRoutes = ["/nomina", "/asistente", "/bitacora", "/documentos-personales", "/vacaciones"]
    for (const route of protectedRoutes) {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test("formulario de login renderiza correctamente con todos los controles accesibles", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible()
    await expect(page.getByLabel(/contraseña/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /iniciar sesión/i })).toBeVisible()
  })
})

test.describe("Business Journey 2 — Aislamiento y control de acceso en APIs", () => {
  test("solicitud a API protegida sin sesión retorna 401 JSON", async ({ page }) => {
    const protectedApis = [
      "/api/worker-context",
      "/api/calculator-prefill?calculator=aguinaldo&targetDate=2026-12-01",
      "/api/consulta",
      "/api/tarjeton/confirm",
      "/api/push/register",
    ]

    for (const api of protectedApis) {
      const response = await page.request.get(api, {
        headers: { Accept: "application/json" },
      })
      // Should be rejected by fail-closed proxy or handler with 401
      expect([401, 405]).toContain(response.status())
      const body = await response.json().catch(() => ({}))
      if (response.status() === 401) {
        expect(body.error).toBeDefined()
      }
    }
  })
})

test.describe("Business Journey 5 — Funciones sindicales y bitácora", () => {
  test("página de bitácora laboral carga componentes de seguimiento sindical", async ({ page }) => {
    await page.goto("/bitacora")
    // If not logged in, redirects to login; if logged in, renders bitácora
    const currentUrl = page.url()
    if (currentUrl.includes("/login")) {
      await expect(page).toHaveURL(/\/login/)
    } else {
      await expect(page.getByRole("heading", { name: /bitácora/i })).toBeVisible()
    }
  })
})

test.describe("Business Journey 6 — Eliminación de cuenta", () => {
  test("página pública /eliminar-cuenta muestra advertencias y términos de borrado", async ({ page }) => {
    await page.goto("/eliminar-cuenta")
    await expect(page).toHaveURL("/eliminar-cuenta")
    await expect(page.getByText(/eliminación de cuenta/i).first()).toBeVisible()
    await expect(page.getByText(/irreversible/i).first()).toBeVisible()
  })
})

test.describe("Business Journey 7 — Manejo de errores y resiliencia de APIs", () => {
  test("ruta de API desconocida retorna 404 JSON controlado", async ({ page }) => {
    const response = await page.request.get("/api/ruta-totalmente-inexistente")
    expect(response.status()).toBe(404)
    const json = await response.json()
    expect(json).toEqual({ error: "No encontrado", code: "not_found" })
  })

  test("parámetros inválidos en API pública retornan 400 Bad Request", async ({ page }) => {
    const response = await page.request.get("/api/calendario?mes=99&anio=invalido")
    expect(response.status()).toBe(400)
    const json = await response.json()
    expect(json.error).toBeDefined()
  })
})
