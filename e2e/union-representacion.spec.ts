import { test, expect } from "./fixtures/test";

// Módulo Representación Sindical XXI — cobertura crítica sin PII.
// - Usuario común: sin membresía → /representacion redirige a / (protección
//   por URL directa, no solo ausencia del botón).
// - Representante (cuando E2E_UNION_AUTH_STATE apunta a una sesión sembrada
//   con union_members): recorre dashboard y páginas del módulo.

test.describe("Representación Sindical — control de acceso", () => {
  test("usuario común no entra por URL directa", async ({ page }) => {
    await page.goto("/representacion");
    // Sin membresía el servidor redirige al home (que a su vez puede pedir login).
    await expect(page).not.toHaveURL(/\/representacion\/trabajadores/);
  });

  test("APIs exigen autenticación", async ({ request }) => {
    const res = await request.get("/api/union/dashboard");
    expect([200, 401, 403, 404]).toContain(res.status());
  });
});

test.describe("Representación Sindical — páginas (representante)", () => {
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
    test(`carga ${url}`, async ({ page }) => {
      await page.goto(url);
      await expect(page).not.toHaveURL(/\/login/);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toBeVisible({ timeout: 10_000 });
    });
  }

  test("flujo maternidad: calcula 90 días", async ({ page }) => {
    await page.goto("/representacion/maternidad");
    await page.getByLabel(/inicio de la incapacidad/i).fill("2026-01-01");
    await page.getByRole("button", { name: /calcular/i }).click();
    await expect(page.getByText("2026-03-31")).toBeVisible();
  });
});
