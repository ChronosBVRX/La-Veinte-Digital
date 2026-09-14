import { test, expect } from "@playwright/test";
import path from "node:path";

const ADMIN_AUTH = path.join(__dirname, ".auth", "union-admin.json");
const REGULAR_AUTH = path.join(__dirname, ".auth", "regular-user.json");

const UNION_MODULES_LIST = [
  { label: "Resumen", href: "/representacion" },
  { label: "Trabajadores", href: "/representacion/trabajadores" },
  { label: "Maternidad", href: "/representacion/maternidad" },
  { label: "Lactancia", href: "/representacion/lactancia" },
  { label: "Lockers", href: "/representacion/lockers" },
  { label: "Pasajes", href: "/representacion/pasajes" },
  { label: "Licencias", href: "/representacion/licencias" },
  { label: "Expedientes", href: "/representacion/expedientes" },
  { label: "Administración", href: "/representacion/administracion" },
];

// ==============================================================================
// 1. USUARIO SIN SESIÓN (Público / Anónimo)
// ==============================================================================
test.describe("1. Usuario sin sesión (anónimo)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sin sesión -> redirige inmediatamente al login", async ({ page }) => {
    await page.goto("/representacion");
    await expect(page).toHaveURL(/\/login/);
  });

  test("API sindical sin sesión -> devuelve 401", async ({ request }) => {
    const res = await request.get("/api/union/dashboard");
    expect(res.status()).toBe(401);
  });
});

// ==============================================================================
// 2. USUARIO AUTENTICADO SIN MEMBRESÍA SINDICAL (Salida Segura / Sin Bucle)
// ==============================================================================
test.describe("2. Usuario con sesión y sin membresía (acceso denegado)", () => {
  test.use({ storageState: REGULAR_AUTH });

  test("escritorio: muestra pantalla discreta de sin autorización sin bucle de redirección", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/representacion");

    // No debe redirigir en bucle a /login
    await expect(page).not.toHaveURL(/\/login/);

    // Mensaje discreto obligatorio
    await expect(
      page.getByText("No tienes autorización para acceder a Representación Sindical.")
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText(/Este espacio está reservado para el cuerpo de representación/)
    ).toBeVisible();

    // Debe permitir cerrar sesión
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();

    // Aislamiento: Cero contenido sindical y cero herramientas de La Veinte Digital
    expect(await page.getByText("MÓDULOS SINDICALES").count()).toBe(0);
    expect(await page.getByText("BETA PRIVADA").count()).toBe(0);
    expect(await page.locator(".mobile-bottom-nav").count()).toBe(0);
    expect(await page.locator(".app-header").count()).toBe(0);
  });

  test("móvil: pantalla discreta en viewport móvil con botón de cerrar sesión", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/representacion");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByText("No tienes autorización para acceder a Representación Sindical.")
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    expect(await page.locator(".mobile-bottom-nav").count()).toBe(0);
  });

  test("ruta directa /representacion/sin-acceso muestra la misma pantalla de acceso denegado", async ({ page }) => {
    await page.goto("/representacion/sin-acceso");
    await expect(
      page.getByText("No tienes autorización para acceder a Representación Sindical.")
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  });
});

// ==============================================================================
// 3. UNION_ADMIN AUTENTICADO — ESCRITORIO
// ==============================================================================
test.describe("3. union_admin autenticado — escritorio", () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("abre /representacion y renderiza UnionApplicationShell con identidad institucional", async ({ page }) => {
    await page.goto("/representacion");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Representación Sindical").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("BETA PRIVADA")).toBeVisible();
    await expect(page.getByText("Delegación XXI", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/HGR No\. 1 Charo/)).toBeVisible();
  });

  test("aislamiento estricto: NO aparecen Navbar, BottomNav, GlobalAudioPlayer ni Copilot", async ({ page }) => {
    await page.goto("/representacion");
    await expect(page.getByText("Representación Sindical").first()).toBeVisible();

    // Verificación de elementos generales no presentes
    expect(await page.locator(".mobile-bottom-nav").count()).toBe(0);
    expect(await page.locator(".mobile-app-shell").count()).toBe(0);
    expect(await page.locator("#global-audio-player").count()).toBe(0);
    expect(await page.locator("[data-testid='copilot-trigger']").count()).toBe(0);

    // Cero enlaces a herramientas generales
    const forbiddenHrefs = ["/calculadoras", "/agenda", "/profile", "/asistente", "/escritos", "/radio"];
    for (const href of forbiddenHrefs) {
      expect(await page.locator(`a[href="${href}"]`).count()).toBe(0);
    }
  });

  test("minimización de PII: no muestra el correo del delegado en pantalla", async ({ page }) => {
    await page.goto("/representacion");
    await expect(page.getByText("Representación Sindical").first()).toBeVisible();

    // El correo nunca debe aparecer en el DOM
    const bodyContent = await page.content();
    expect(bodyContent).not.toContain("union.admin@test.local");

    // En su lugar, muestra el rol o nombre autorizado
    expect(await page.getByText(/Administrador Sindical/).count()).toBeGreaterThanOrEqual(1);
  });

  test("los nueve enlaces sindicales existen en la navegación y funcionan", async ({ page }) => {
    await page.goto("/representacion");
    await expect(page.getByText("Representación Sindical").first()).toBeVisible();

    const desktopNav = page.getByRole("navigation", { name: "Módulos sindicales" });
    await expect(desktopNav).toBeVisible();

    for (const mod of UNION_MODULES_LIST) {
      const link = desktopNav.getByRole("link", { name: new RegExp(mod.label, "i") });
      await expect(link).toBeVisible();
      expect(await link.getAttribute("href")).toBe(mod.href);
    }
  });

  test("navega exitosamente entre módulos sindicales", async ({ page }) => {
    // 1. Trabajadores
    await page.goto("/representacion/trabajadores");
    await expect(page).toHaveURL("/representacion/trabajadores");
    await expect(page.getByText("Padrón de Trabajadores").or(page.getByRole("heading", { name: /trabajadores/i }))).toBeVisible({ timeout: 10_000 });

    // 2. Maternidad
    await page.goto("/representacion/maternidad");
    await expect(page).toHaveURL("/representacion/maternidad");
    await expect(page.getByRole("heading", { name: /maternidad/i })).toBeVisible({ timeout: 10_000 });

    // 3. Licencias
    await page.goto("/representacion/licencias");
    await expect(page).toHaveURL("/representacion/licencias");
    await expect(page.getByRole("heading", { name: /licencias/i })).toBeVisible({ timeout: 10_000 });
  });

  test("botón de cerrar sesión está presente y visible", async ({ page }) => {
    await page.goto("/representacion");
    const signOutBtn = page.getByRole("button", { name: "Cerrar sesión" });
    await expect(signOutBtn).toBeVisible();
  });
});

// ==============================================================================
// 4. UNION_ADMIN AUTENTICADO — MÓVIL (Drawer táctil y responsive)
// ==============================================================================
test.describe("4. union_admin autenticado — móvil (viewport 390x844)", () => {
  test.use({ storageState: ADMIN_AUTH });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("drawer móvil abre, muestra los 9 módulos sindicales y se cierra con botón y Escape", async ({ page }) => {
    await page.goto("/representacion");
    await expect(page.getByText("Representación Sindical").first()).toBeVisible({ timeout: 10_000 });

    // Botón hamburguesa
    const hamburger = page.getByLabel("Abrir menú sindical").or(page.getByLabel("Alternar menú sindical"));
    await expect(hamburger).toBeVisible();
    await hamburger.click();

    // Diálogo del drawer visible
    const drawer = page.getByRole("dialog", { name: "Menú de navegación sindical" });
    await expect(drawer).toBeVisible();

    // Módulos visibles dentro del drawer
    for (const mod of UNION_MODULES_LIST) {
      await expect(drawer.getByRole("link", { name: new RegExp(mod.label, "i") })).toBeVisible();
    }

    // Cerrar con Escape
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();

    // Abrir de nuevo y cerrar con el botón X
    await hamburger.click();
    await expect(drawer).toBeVisible();
    const closeBtn = page.getByLabel("Cerrar menú sindical");
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();
  });

  test("drawer móvil contiene botón de cerrar sesión", async ({ page }) => {
    await page.goto("/representacion");
    const hamburger = page.getByLabel("Abrir menú sindical").or(page.getByLabel("Alternar menú sindical"));
    await hamburger.click();

    const drawer = page.getByRole("dialog", { name: "Menú de navegación sindical" });
    await expect(drawer.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  });
});
