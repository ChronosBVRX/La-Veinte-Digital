import { test as setup, expect } from "@playwright/test"
import path from "path"
import fs from "fs"

const AUTH_FILE = path.join(__dirname, ".auth", "user.json")

setup("autenticar usuario E2E", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  if (!email || !password) {
    test.skip(
      "E2E_USER_EMAIL o E2E_USER_PASSWORD no definidas. " +
        "Configuralas en .env.local para ejecutar pruebas autenticadas."
    )
    return
  }

  // Ensure .auth directory exists
  const authDir = path.dirname(AUTH_FILE)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  await page.goto("/login")

  // Fill login form using accessible selectors
  await page.getByLabel("Correo electrónico").fill(email)
  await page.getByLabel("Contraseña").fill(password)

  // Click submit
  await page.getByRole("button", { name: /iniciar sesión/i }).click()

  // Wait for redirect to dashboard
  await expect(
    page,
    "Debe redirigir al dashboard tras login exitoso"
  ).toHaveURL("/", { timeout: 15_000 })

  // Confirm we see dashboard content
  await expect(
    page.getByRole("heading", { level: 1 }),
    "Debe mostrar el heading principal del dashboard"
  ).toBeVisible({ timeout: 10_000 })

  // Save storage state (cookies, localStorage)
  await page.context().storageState({ path: AUTH_FILE })

  // Sanitize: don't log sensitive data
  console.log("Auth setup completado para:", email.replace(/[^@]/g, "*"))
})
