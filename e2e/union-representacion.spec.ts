import { test, expect } from "./fixtures/test";

// Módulo Representación Sindical XXI — cobertura crítica sin PII.
// - Usuario común: sin membresía → /representacion redirige a / o /login
//   (protección por URL directa en servidor, no solo ausencia del botón).
// - Aislamiento: no monta el shell general de La Veinte Digital ni navegación inferior.
// - Representante (cuando E2E_UNION_AUTH_STATE apunta a una sesión sembrada
//   con union_members): recorre dashboard y páginas del módulo en su propio shell.

test.describe("Representación Sindical — control de acceso y aislamiento", () => {
  test("usuario común o anónimo no entra por URL directa y es redirigido", async ({ page }) => {
    await page.goto("/representacion");
    // Sin sesión ni membresía, el servidor en (union)/layout.tsx redirige a /login o /
    await expect(page).toHaveURL(/\/(login)?$/);
    // Verificar ausencia de navegación inferior general
    expect(await page.locator(".mobile-bottom-nav").count()).toBe(0);
  });

  test("APIs sindicales exigen autenticación y devuelven 401 o 403", async ({ request }) => {
    const res = await request.get("/api/union/dashboard");
    expect([401, 403]).toContain(res.status());
  });
});

test.describe("Representación Sindical — páginas y shell aislado (representante)", () => {
  test.skip(!process.env.E2E_UNION_AUTH_STATE, "Requiere sesión de representante sembrada (E2E_UNION_AUTH_STATE)");

  const pages = [
    "/representacion",
    "/representacion/trabajadores",
    "/representacion/maternidad",
    "/representacion/lactancia",
    "/representacion/lockers",
    "/representacion/pasajes",
    "/representacion/licencias",
    "/representacion/expedientes",
    "/representacion/administracion",
    "/representacion/aviso-privacidad",
  ];

  for (const url of pages) {
    test(`carga ${url} en shell sindical aislado`, async ({ page }) => {
      await page.goto(url);
      await expect(page).not.toHaveURL(/\/login/);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toBeVisible({ timeout: 10_000 });

      // Verificaciones de aislamiento del shell sindical
      await expect(page.getByText("Representación Sindical")).toBeVisible();
      await expect(page.getByText("BETA PRIVADA")).toBeVisible();
      expect(await page.locator(".mobile-bottom-nav").count()).toBe(0);
      expect(await page.locator(".mobile-app-shell").count()).toBe(0);
    });
  }

  test("flujo maternidad: calcula 90 días", async ({ page }) => {
    await page.goto("/representacion/maternidad");
    await page.getByLabel(/inicio de la incapacidad/i).fill("2026-01-01");
    await page.getByRole("button", { name: /calcular/i }).click();
    await expect(page.getByText("2026-03-31")).toBeVisible();
  });
});
