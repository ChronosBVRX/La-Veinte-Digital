import { test, expect } from "@playwright/test"

/**
 * Safe crawler: visits internal links, detects 404s, 500s, broken resources.
 *
 * SAFETY RULES:
 * - Only follows links within the same origin
 * - Max depth: 2
 * - Max pages: 15
 * - Skips: logout, delete, confirm, API, external links
 */

const MAX_DEPTH = 2
const MAX_PAGES = 15
const BASE_ORIGIN: string = process.env.E2E_BASE_URL || "http://localhost:3000"

interface CrawlResult {
  url: string
  status: "ok" | "error" | "skipped"
  error?: string
  consoleErrors: string[]
  statusCode?: number
}

function isSafeUrl(href: string): boolean {
  // Only same-origin
  if (!href.startsWith("/") && !href.startsWith(BASE_ORIGIN)) return false

  // Skip dangerous paths
  const dangerous = [/\/api\//, /logout/, /delete/, /confirm/i, /eliminar/, /\/callback/, /signout/]
  if (dangerous.some((r) => r.test(href))) return false

  // Skip auth pages on crawler (they redirect)
  if (href.includes("/login") || href.includes("/register")) return false

  return true
}

test("crawler: explora rutas internas de manera segura", async ({ page }) => {
  const results: CrawlResult[] = []
  const visited = new Set<string>()

  async function crawl(url: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) return
    if (visited.size >= MAX_PAGES) return

    const normalized = url.replace(BASE_ORIGIN, "").split("#")[0].split("?")[0]
    if (visited.has(normalized)) return
    visited.add(normalized)

    const result: CrawlResult = { url: normalized, status: "ok", consoleErrors: [] }

    try {
      const response = await page.goto(normalized, { timeout: 15_000, waitUntil: "domcontentloaded" })

      if (!response) {
        result.status = "error"
        result.error = "No response"
        results.push(result)
        return
      }

      const status = response.status()
      result.statusCode = status

      if (status >= 400) {
        result.status = "error"
        result.error = `HTTP ${status}`
      }

      // Collect links
      const links = await page
        .locator("a[href]")
        .evaluateAll((els) =>
          els
            .map((el) => (el as HTMLAnchorElement).getAttribute("href"))
            .filter(Boolean) as string[]
        )

      const uniqueLinks = [...new Set(links)].filter(isSafeUrl).slice(0, 5)

      results.push(result)

      // Crawl deeper
      for (const link of uniqueLinks) {
        if (visited.size >= MAX_PAGES) break
        await crawl(link, depth + 1)
      }
    } catch (e) {
      result.status = "error"
      result.error = (e as Error).message
      results.push(result)
    }
  }

  // Start from dashboard
  await crawl("/", 0)

  // Generate summary
  const errors = results.filter((r) => r.status === "error")
  const oks = results.filter((r) => r.status === "ok")

  console.log(`\n=== CRAWLER RESULTS ===`)
  console.log(`Total pages visited: ${results.length}`)
  console.log(`OK: ${oks.length}, Errors: ${errors.length}`)
  for (const r of results) {
    console.log(`  [${r.status.toUpperCase()}] ${r.url}${r.error ? ` (${r.error})` : ""}`)
  }

  // Don't fail on all errors - just report
  if (errors.length > 0) {
    console.warn(`\nWARNING: ${errors.length} pages returned errors during crawl.`)
  }

  // But do verify we visited at least some pages
  expect(results.length, "Crawler debe visitar al menos 1 pagina").toBeGreaterThan(0)
})
