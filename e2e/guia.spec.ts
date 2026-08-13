import { test, expect } from "@playwright/test"
import { login, logout, navigateTo } from "./utils/helpers"

const EMAIL = process.env.E2E_EMAIL ?? ""
const PASSWORD = process.env.E2E_PASSWORD ?? ""

test.describe("Guía de mi Tarjetón — flujos 1–7", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, "Definir E2E_EMAIL y E2E_PASSWORD para correr E2E")
    await login(page, EMAIL, PASSWORD)
  })

  test.afterEach(async ({ page }) => {
    await logout(page).catch(() => {})
  })

  test("1 · Home de la guía carga y muestra el acceso a la quincena", async ({ page }) => {
    await page.goto("/guia")
    await expect(page.getByRole("heading", { name: /Guía de mi Tarjetón/ })).toBeVisible()
    await expect(page.getByText("Obtener mi tarjetón").first().or(page.getByText("Explícame mi pago").first())).toBeVisible()
  })

  test("2 · Buscador y catálogo de conceptos", async ({ page }) => {
    await page.goto("/guia/conceptos")
    const search = page.getByRole("textbox").first()
    await expect(search).toBeVisible()
    await search.fill("033")
    await expect(page.getByRole("link", { name: /estímulo por puntualidad|ESTÍMULO POR PUNTUALIDAD/i }).first()).toBeVisible()
  })

  test("3 · Ficha de concepto con 3 niveles", async ({ page }) => {
    await page.goto("/guia/conceptos/033")
    await expect(page.getByRole("heading", { name: /ESTÍMULO POR PUNTUALIDAD|Estímulo por puntualidad/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: /Fácil/ })).toBeVisible()
    await expect(page.getByRole("tab", { name: /Detallado/ })).toBeVisible()
    await expect(page.getByRole("tab", { name: /Fundamento/ })).toBeVisible()
  })

  test("4 · Explorador Conoce tu tarjetón y ficha de campo", async ({ page }) => {
    await page.goto("/guia/tarjeton")
    await expect(page.getByRole("heading", { name: /Conoce tu tarjetón/ })).toBeVisible()
    await page.getByRole("button", { name: /Receptor/i }).first().click()
    await expect(page.getByRole("link", { name: /Matrícula/i }).first()).toBeVisible()
    await page.goto("/guia/campos/13")
    await expect(page.getByRole("heading", { name: /Antigüedad/i })).toBeVisible()
  })

  test("5 · Aprende desde cero + avance de Primeros pasos", async ({ page }) => {
    await page.goto("/guia/aprender")
    await expect(page.getByRole("heading", { name: /Aprende desde cero/ })).toBeVisible()
    await page.goto("/guia/aprender/primeros-pasos?leccion=que-es-tarjeton")
    await expect(page.getByRole("button", { name: /Marcar como completada/ }).first()).toBeVisible()
    await page.getByRole("button", { name: "Marcar como completada" }).first().click()
    await expect(page.getByRole("button", { name: /Completada/ }).first()).toBeVisible()
  })

  test("6 · Mi quincena explicada (carrusel o estado vacío)", async ({ page }) => {
    await page.goto("/guia/mi-quincena")
    await expect(page.getByRole("heading", { name: /Mi quincena explicada/ })).toBeVisible()
    // Con o sin tarjetón debe existir la pestaña de revisión y el paso inicial.
    await expect(page.getByRole("tab", { name: /Revisa tu quincena/ })).toBeVisible()
  })

  test("7 · Navegación lateral apunta a la guía", async ({ page }) => {
    await page.goto("/")
    const link = page.getByRole("link", { name: /Guía de mi Tarjetón/ }).first()
    await expect(link).toBeVisible()
    await navigateTo(page, "/guia")
    await expect(page.getByRole("heading", { name: /Guía de mi Tarjetón/ })).toBeVisible()
    await expect(page).not.toHaveURL(/catalogo/)
  })
})
