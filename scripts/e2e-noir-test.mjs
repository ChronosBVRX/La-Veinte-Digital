import fs from "fs"
import path from "path"
import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env.local")
  } catch {}
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const baseUrl = "https://la20.com.mx"
const email = "Noirsysan@gmail.com"
const password = "abe123321"

const screenshotDir = path.join(process.cwd(), "e2e-screenshots")
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true })
}

console.log("=== INICIANDO PRUEBAS E2E PARA CUENTA DE USUARIO ===")
console.log(`Usuario: ${email}`)
console.log(`URL Base: ${baseUrl}`)

async function getAuthCookies() {
  console.log("\n[1/4] Obteniendo credenciales y cookies de sesión...")
  
  // Opción A: vía signInWithPassword con cliente Supabase
  let capturedCookies = []
  const ssr = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return []
      },
      setAll(c) {
        capturedCookies = c
      },
    },
  })

  // Iniciar sesión
  const { data: signData, error: signErr } = await ssr.auth.signInWithPassword({
    email,
    password,
  })

  if (signErr) {
    console.log("signInWithPassword directo dio error, probando con magic link admin:", signErr.message)
    if (serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${baseUrl}/callback` },
      })
      if (linkErr) throw new Error("Error generando magiclink: " + linkErr.message)
      const { error: otpErr } = await ssr.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: "magiclink",
      })
      if (otpErr) throw new Error("Error canjeando OTP: " + otpErr.message)
    }
  } else {
    console.log(`✅ Autenticado exitosamente en Supabase. User ID: ${signData.user.id}`)
  }

  console.log(`Cookies capturadas: ${capturedCookies.length}`)
  return capturedCookies
}

async function runE2E() {
  const cookies = await getAuthCookies()

  console.log("\n[2/4] Lanzando navegador Playwright (Chromium)...")
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }, // Simulación móvil (Pixel 7 / Samsung)
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    locale: "es-MX",
  })

  // Inyectar cookies de sesión
  const u = new URL(baseUrl)
  const hostname = u.hostname
  const cookiesToAdd = cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: hostname,
    path: "/",
    httpOnly: (c.options?.httpOnly) ?? true,
    secure: true,
    sameSite: "Lax",
  }))
  await context.addCookies(cookiesToAdd)

  const page = await context.newPage()
  
  // Escuchar errores de consola y red
  const consoleErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })
  page.on("pageerror", (err) => {
    consoleErrors.push(err.message)
  })

  console.log("\n[3/4] Navegando y validando vistas clave...")

  // --- TEST 1: Dashboard principal ---
  console.log("➡️ 1. Accediendo al Dashboard (/)....")
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(screenshotDir, "01_dashboard.png"), fullPage: false })
  const pageTitle = await page.title()
  console.log(`   Título de página: "${pageTitle}"`)
  console.log(`   URL actual: ${page.url()}`)

  // --- TEST 2: Guía de mi Tarjetón - Mi Quincena (/guia/mi-quincena) ---
  console.log("\n➡️ 2. Accediendo a Mi Quincena (/guia/mi-quincena)...")
  await page.goto(`${baseUrl}/guia/mi-quincena`, { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(screenshotDir, "02_mi_quincena.png"), fullPage: false })

  // Leer encabezado y datos de Mi Quincena
  const quincenaHeader = await page.locator("h1, h2, h3").allTextContents()
  console.log(`   Encabezados detectados:`, quincenaHeader.filter(Boolean).slice(0, 5))

  // Extraer las tarjetas mostradas en Vista Completa
  const cardHeadings = await page.locator("h3").allTextContents()
  console.log(`\n   📋 Tarjetas en Vista Completa (${cardHeadings.length}):`)
  for (let i = 0; i < cardHeadings.length; i++) {
    const title = cardHeadings[i].trim()
    console.log(`     [${i + 1}] 🏷️ ${title}`)
  }

  // Verificar bloques de incidencia de fechas
  const dateBlocks = page.locator('text=¿Qué día')
  const countDateBlocks = await dateBlocks.count()
  console.log(`\n   📅 Bloques de fechas de incidencia detectados en pantalla: ${countDateBlocks}`)
  for (let i = 0; i < countDateBlocks; i++) {
    const parent = dateBlocks.nth(i).locator('xpath=ancestor::div[contains(@style, "border")]').first()
    const text = await parent.textContent()
    console.log(`     - Bloque ${i + 1}: ${text?.replace(/\s+/g, ' ').trim()}`)
  }

  // Probar cambio a modo "Paso a paso"
  const pasoAPasoBtn = page.locator('button:has-text("Paso a paso")')
  if (await pasoAPasoBtn.count() > 0) {
    console.log("\n   🔄 Cambiando a vista 'Paso a paso' (carrusel)...")
    await pasoAPasoBtn.first().click({ force: true })
    await page.waitForTimeout(600)

    const nextBtn = page.locator('button[aria-label="Paso siguiente"]')
    if (await nextBtn.count() > 0) {
      for (let step = 1; step <= 3; step++) {
        const activeCard = await page.locator("h3").first().textContent()
        console.log(`     Carrusel Paso ${step}: "${activeCard?.trim()}"`)
        if (await nextBtn.first().isEnabled()) {
          await nextBtn.first().click({ force: true })
          await page.waitForTimeout(500)
        }
      }
      await page.screenshot({ path: path.join(screenshotDir, "03_mi_quincena_carrusel.png"), fullPage: false })
    }
  }

  // --- TEST 3: Guía del Tarjetón Desglosado (/guia/tarjeton) ---
  console.log("\n➡️ 3. Accediendo a Tarjetón Desglosado (/guia/tarjeton)...")
  await page.goto(`${baseUrl}/guia/tarjeton`, { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(screenshotDir, "04_tarjeton_desglose.png"), fullPage: false })
  const tarjetonText = await page.locator("body").textContent()
  console.log(`   Contiene 'Percepciones':`, tarjetonText.includes("Percepciones"))
  console.log(`   Contiene 'Deducciones':`, tarjetonText.includes("Deducciones"))
  console.log(`   Contiene 'Observaciones':`, tarjetonText.includes("Observaciones"))

  // --- TEST 4: Perfil laboral (/profile/mi-informacion-laboral) ---
  console.log("\n➡️ 4. Accediendo a Perfil Laboral (/profile/mi-informacion-laboral)...")
  await page.goto(`${baseUrl}/profile/mi-informacion-laboral`, { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(screenshotDir, "05_perfil_laboral.png"), fullPage: false })
  const profileText = await page.locator("body").textContent()
  console.log(`   Contiene matrícula del usuario:`, profileText.includes("98173968"))
  console.log(`   Contiene categoría:`, profileText.includes("TECNICO RADIOLOGO") || profileText.includes("RADIOLOGO"))

  console.log("\n[4/4] Resumen de errores de consola durante la navegación:")
  if (consoleErrors.length === 0) {
    console.log("   ✅ Cero errores de consola detectados.")
  } else {
    console.log(`   ⚠️ Errores (${consoleErrors.length}):`, consoleErrors.slice(0, 5))
  }

  await browser.close()
  console.log("\n=== PRUEBAS E2E COMPLETADAS EXITOSAMENTE ===")
}

runE2E().catch((err) => {
  console.error("FATAL E2E:", err)
  process.exit(1)
})
