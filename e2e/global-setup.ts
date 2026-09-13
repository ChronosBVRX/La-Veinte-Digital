import { test as setup, expect } from "@playwright/test"
import path from "path"
import fs from "fs"
import { createClient } from "@supabase/supabase-js"

const AUTH_FILE = path.join(__dirname, ".auth", "user.json")

setup("autenticar usuario E2E", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL o E2E_USER_PASSWORD no definidas. " +
        "Configuralas en .env.local para ejecutar pruebas autenticadas.\n" +
        "Ejemplo:\n" +
        '  E2E_USER_EMAIL="test@example.com"\n' +
        '  E2E_USER_PASSWORD="your-password"'
    )
  }

  // Ensure .auth directory exists
  const authDir = path.dirname(AUTH_FILE)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  // Con CAPTCHA obligatorio en Supabase, el login por formulario no puede
  // resolverse headless. Si hay service_role, se emite un magic link de admin
  // (exento de CAPTCHA) y se visita: la sesión queda en las cookies.
  if (supabaseUrl && serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const baseUrl = process.env.E2E_BASE_URL || "http://localhost:3000"
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${baseUrl}/callback` },
    })
    if (error || !data.properties.action_link) {
      throw new Error(`No se pudo generar el magic link E2E: ${error?.message ?? "sin action_link"}`)
    }
    await page.goto(data.properties.action_link)
    await expect(
      page,
      "Debe redirigir al dashboard tras login E2E con magic link"
    ).toHaveURL("/", { timeout: 15_000 })
    await expect(
      page.getByRole("heading", { level: 1 }),
      "Debe mostrar el heading principal del dashboard"
    ).toBeVisible({ timeout: 10_000 })
    await page.context().storageState({ path: AUTH_FILE })
    console.log("Auth setup completado para:", email.replace(/[^@]/g, "*"))
    return
  }

  await page.goto("/login")

  const loginForm = page.locator("form")
  await loginForm.getByLabel("Correo electrónico").fill(email)
  await loginForm.getByLabel("Contraseña").fill(password)
  await loginForm.getByRole("button", { name: "Iniciar sesión" }).click()

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
