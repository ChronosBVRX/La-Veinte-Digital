import type { Page } from "@playwright/test"

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

/**
 * All known navigation routes in the app (from sidebar + extras).
 */
export const ALL_ROUTES = [
  { href: "/", label: "Inicio" },
  { href: "/tarjeton", label: "Mi Tarjeton" },
  { href: "/calendario", label: "Calendario" },
  { href: "/vacaciones", label: "Vacaciones" },
  { href: "/bitacora", label: "Mis incidencias" },
  { href: "/calculadoras", label: "Calculadoras" },
  { href: "/simulador-nomina", label: "Simulador de nomina" },
  { href: "/escritos", label: "Crear un escrito" },
  { href: "/guia", label: "Guía de mi Tarjetón" },
  { href: "/guia/conceptos", label: "Guía Conceptos" },
  { href: "/guia/tarjeton", label: "Guía Tarjetón" },
  { href: "/guia/aprender", label: "Guía Aprender" },
  { href: "/guia/mi-quincena", label: "Guía Mi Quincena" },
  { href: "/asistente", label: "Asistente IA" },
  { href: "/simulador", label: "Practicar una audiencia" },
  { href: "/facebook", label: "Noticias SNTSS" },
  { href: "/profile", label: "Mi Perfil" },
  { href: "/herramientas", label: "Herramientas" },
]

/**
 * Sub-routes for calculators
 */
export const CALCULATOR_ROUTES = [
  { href: "/calculadoras/tiempo-extra", label: "Tiempo Extra" },
  { href: "/calculadoras/clausula-97", label: "Clausula 97" },
  { href: "/calculadoras/segunda-julio", label: "Segunda de Julio" },
  { href: "/calculadoras/segunda-julio-proporcional", label: "Segunda de Julio Proporcional" },
  { href: "/calculadoras/aguinaldo", label: "Aguinaldo" },
  { href: "/calculadoras/prestamos", label: "Prestamos por Categoria" },
]

/**
 * Navigate to a route by clicking the sidebar link (desktop) or
 * navigating directly.
 */
export async function navigateTo(page: Page, href: string) {
  // Try sidebar navigation first
  const sidebarLink = page.locator(`a[href="${href}"]`).first()
  if (await sidebarLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sidebarLink.click()
  } else {
    await page.goto(href)
  }
  await page.waitForLoadState("networkidle")
}

/**
 * Login helper for unauthenticated tests.
 */
export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login")
  await page.getByLabel("Correo electrónico").fill(email)
  await page.getByLabel("Contraseña").fill(password)
  await page.getByRole("button", { name: /iniciar sesión/i }).click()
  await page.waitForURL("/", { timeout: 15_000 })
}

/**
 * Logout helper.
 */
export async function logout(page: Page): Promise<void> {
  await page.goto("/profile")
  // Look for cerrar sesion button
  const logoutBtn = page.getByRole("button", { name: /cerrar sesión|salir/i })
  if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await logoutBtn.click()
  }
}

/**
 * Check if the app has horizontal scroll on mobile.
 */
export async function hasHorizontalScroll(page: Page): Promise<boolean> {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  const viewportWidth = await page.evaluate(() => window.innerWidth)
  return scrollWidth > viewportWidth + 5
}
