#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import { FACEBOOK_PAGES, type FacebookPageKey, type ScrapedFacebookPost } from "../src/features/facebook/types"
import { extractPostsFromHtmlAndGraphqlChunks } from "../src/features/facebook/lib/relay-post-extractor"
import {
  persistScrapedPostsToSupabase,
  syncLatestFacebookPostsViaHttp,
} from "../src/features/facebook/services/facebook-posts-service"

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const key = match[1]
    if (process.env[key]) continue
    let val = match[2].trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

function initEnv(): void {
  const root = process.cwd()
  loadEnvFile(path.join(root, ".env.local"))
  loadEnvFile(path.join(root, ".env.production.local"))
  loadEnvFile(path.join(root, ".env"))
}

async function scrapeWithPlaywright(
  pageKeys: FacebookPageKey[],
  scrollIterations = Number(process.env.SCROLL_ITERATIONS || 5),
): Promise<ScrapedFacebookPost[]> {
  const { chromium } = await import("@playwright/test")

  const storageStatePath = process.env.FB_STORAGE_STATE_PATH
  const hasStorageStateFile = Boolean(storageStatePath && fs.existsSync(storageStatePath))

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  })
  try {
    const contextOptions: Record<string, unknown> = {
      locale: "es-MX",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 1400 },
    }

    if (hasStorageStateFile && storageStatePath) {
      contextOptions.storageState = storageStatePath
    }

    const context = await browser.newContext(contextOptions)
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      })
    })

    // Inyectar cookies adicionales si vienen por variable de entorno (CI / GitHub Actions)
    const rawCookiesEnv = process.env.FB_COOKIES_JSON || process.env.FB_STORAGE_STATE_JSON
    if (rawCookiesEnv) {
      try {
        const parsed = JSON.parse(rawCookiesEnv)
        const cookies = Array.isArray(parsed) ? parsed : parsed.cookies
        if (Array.isArray(cookies) && cookies.length > 0) {
          await context.addCookies(cookies)
        }
      } catch (err) {
        console.warn("[facebook:sync] No se pudieron parsear cookies de entorno:", err)
      }
    }

    const page = await context.newPage()
    const allPosts: ScrapedFacebookPost[] = []

    for (const key of pageKeys) {
      const cfg = FACEBOOK_PAGES[key]
      console.log(`[facebook:sync] Extrayendo ${cfg.name} (${cfg.url})...`)

      const htmlChunks: string[] = []
      const graphqlBodies: string[] = []

      const onResponse = async (res: { url: () => string; text: () => Promise<string> }) => {
        const u = res.url()
        if (u === cfg.url || u.startsWith(`${cfg.url}?`) || u.startsWith(`${cfg.url}/`)) {
          try {
            const body = await res.text()
            if (body.includes("comet_sections")) {
              htmlChunks.push(body)
            }
          } catch {
            // Ignorar respuestas canceladas
          }
        } else if (u.includes("/api/graphql/")) {
          try {
            const body = await res.text()
            if (body.includes("comet_sections")) {
              graphqlBodies.push(body)
            }
          } catch {
            // Ignorar respuestas canceladas
          }
        }
      }

      page.on("response", onResponse)

      // Cargar la página con reintento si ocurre timeout
      let loaded = false
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await page.goto(cfg.url, { waitUntil: "domcontentloaded", timeout: 40000 })
          loaded = true
          break
        } catch (err) {
          console.warn(`[facebook:sync] Intento ${attempt} de carga falló para ${cfg.shortName}:`, err)
          if (attempt < 2) await page.waitForTimeout(3000)
        }
      }

      if (!loaded) {
        console.warn(`[facebook:sync] No se pudo cargar ${cfg.url}. Omitiendo...`)
        page.off("response", onResponse)
        continue
      }

      await page.waitForTimeout(3000)

      // Capturar también el HTML actual por si el documento inicial ya cargó
      try {
        const currentHtml = await page.content()
        if (currentHtml.includes("comet_sections")) {
          htmlChunks.push(currentHtml)
        }
      } catch {
        // Ignorar
      }

      // Función defensiva para cerrar modales de inicio de sesión o cookies
      const dismissPopups = async () => {
        try {
          await page.keyboard.press("Escape")
        } catch {
          // Ignorar
        }

        const dismissSelectors = [
          '[aria-label="Cerrar"]',
          '[aria-label="Close"]',
          'div[role="dialog"] [aria-label="Cerrar"]',
          'div[role="dialog"] button:has-text("Cerrar")',
          'div[role="dialog"] button:has-text("Close")',
          '[aria-label="Permitir todas las cookies"]',
          '[aria-label="Allow all cookies"]',
          '[aria-label="Declinable"]',
        ]

        for (const sel of dismissSelectors) {
          try {
            const btn = page.locator(sel).first()
            if (await btn.isVisible({ timeout: 1200 })) {
              await btn.click({ force: true })
              await page.waitForTimeout(600)
              break
            }
          } catch {
            // Continuar
          }
        }

        // Si Facebook bloquea el scroll con un modal de login que no se puede cerrar, desbloquear el DOM
        try {
          await page.evaluate(() => {
            const dialogs = document.querySelectorAll('div[role="dialog"]')
            dialogs.forEach((d) => {
              const text = d.textContent || ""
              if (
                text.includes("iniciar sesión") ||
                text.includes("Log in") ||
                text.includes("Inicia sesión") ||
                text.includes("Crea una cuenta")
              ) {
                ;(d as HTMLElement).style.display = "none"
              }
            })
            document.body.style.overflow = "auto"
            document.documentElement.style.overflow = "auto"
          })
        } catch {
          // Ignorar
        }
      }

      await dismissPopups()

      // Scroll con desplazamiento JS y rueda de ratón para sortear bloqueos de capa
      for (let i = 0; i < scrollIterations; i++) {
        try {
          await page.evaluate(() => window.scrollBy(0, 1600))
        } catch {
          // Ignorar
        }
        await page.mouse.wheel(0, 1600)
        await page.waitForTimeout(1900)
        if (i % 2 === 0) {
          await dismissPopups()
        }
      }

      page.off("response", onResponse)

      const extracted = extractPostsFromHtmlAndGraphqlChunks(key, htmlChunks, graphqlBodies)
      console.log(`[facebook:sync] -> ${extracted.length} publicaciones extraídas de ${cfg.shortName}`)
      allPosts.push(...extracted)
    }

    return allPosts
  } finally {
    await browser.close()
  }
}

async function main() {
  initEnv()
  const args = process.argv.slice(2)
  const httpOnly = args.includes("--http-only")
  const pageKeys: FacebookPageKey[] = ["seccionxx"]

  console.log("=== SINCRONIZACIÓN DE NOTICIAS FACEBOOK SNTSS -> SUPABASE ===")

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "[facebook:sync] ERROR: Faltan variables obligatorias de Supabase (NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY). Verifica los secretos de GitHub Actions o tu archivo .env local.",
    )
    process.exit(1)
  }

  if (httpOnly) {
    console.log("[facebook:sync] Modo HTTP SSR seleccionado (--http-only)...")
    const res = await syncLatestFacebookPostsViaHttp(pageKeys)
    console.log(JSON.stringify(res, null, 2))
    return
  }

  try {
    const posts = await scrapeWithPlaywright(pageKeys)
    if (posts.length === 0) {
      console.warn("[facebook:sync] Playwright obtuvo 0 publicaciones, activando respaldo HTTP SSR...")
      const res = await syncLatestFacebookPostsViaHttp(pageKeys)
      console.log(JSON.stringify(res, null, 2))
      return
    }

    console.log(`[facebook:sync] Persistiendo ${posts.length} publicaciones e imágenes en Supabase...`)
    const res = await persistScrapedPostsToSupabase(posts)
    console.log(JSON.stringify(res, null, 2))
  } catch (err) {
    console.warn(
      "[facebook:sync] Playwright no disponible o falló, usando modo HTTP SSR de respaldo...",
      err instanceof Error ? err.message : err,
    )
    const res = await syncLatestFacebookPostsViaHttp(pageKeys)
    console.log(JSON.stringify(res, null, 2))
  }
}

main().catch((err) => {
  console.error("[facebook:sync] Error fatal:", err)
  process.exit(1)
})
