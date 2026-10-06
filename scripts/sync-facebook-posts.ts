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
  scrollIterations = 4,
): Promise<ScrapedFacebookPost[]> {
  const { chromium } = await import("@playwright/test")

  const storageStatePath = process.env.FB_STORAGE_STATE_PATH
  const hasStorageState = Boolean(storageStatePath && fs.existsSync(storageStatePath))

  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({
      locale: "es-MX",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 1400 },
      ...(hasStorageState ? { storageState: storageStatePath } : {}),
    })

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

      await page.goto(cfg.url, { waitUntil: "domcontentloaded", timeout: 35000 })
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

      // Cerrar modal de inicio de sesión si aparece en páginas públicas
      try {
        const closeBtn = page.locator('[aria-label="Cerrar"], [aria-label="Close"]').first()
        if (await closeBtn.isVisible({ timeout: 2500 })) {
          await closeBtn.click()
          await page.waitForTimeout(1200)
        }
      } catch {
        // Sin modal
      }

      for (let i = 0; i < scrollIterations; i++) {
        await page.mouse.wheel(0, 1500)
        await page.waitForTimeout(1800)
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

  if (httpOnly) {
    console.log("[facebook:sync] Modo HTTP SSR seleccionado (--http-only)...")
    const res = await syncLatestFacebookPostsViaHttp(pageKeys)
    console.log(JSON.stringify(res, null, 2))
    return
  }

  try {
    const posts = await scrapeWithPlaywright(pageKeys, 4)
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
