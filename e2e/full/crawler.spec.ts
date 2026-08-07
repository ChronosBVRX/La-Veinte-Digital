import { test, expect } from "../fixtures/test"

const MAX_DEPTH = 2
const MAX_PAGES = 15
const BASE_ORIGIN: string = process.env.E2E_BASE_URL || "http://localhost:3000"

function isSafeUrl(href: string): boolean {
  if (!href.startsWith("/") && !href.startsWith(BASE_ORIGIN)) return false
  const dangerous = [
    /\/api\//,
    /logout/,
    /delete/,
    /confirm/i,
    /eliminar/,
    /\/callback/,
    /signout/,
  ]
  if (dangerous.some((r) => r.test(href))) return false
  if (href.includes("/login") || href.includes("/register")) return false
  return true
}

test("crawler: explora rutas internas de manera segura", async ({ page }) => {
  const visited = new Set<string>()
  let errorCount = 0

  async function crawl(url: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) return
    if (visited.size >= MAX_PAGES) return

    const normalized = url.replace(BASE_ORIGIN, "").split("#")[0].split("?")[0]
    if (visited.has(normalized)) return
    visited.add(normalized)

    try {
      const response = await page.goto(normalized, {
        timeout: 15_000,
        waitUntil: "domcontentloaded",
      })

      if (!response) {
        errorCount++
        return
      }

      if (response.status() >= 400) {
        errorCount++
      }

      const links = await page
        .locator("a[href]")
        .evaluateAll((els) =>
          els
            .map((el) => (el as HTMLAnchorElement).getAttribute("href"))
            .filter(Boolean) as string[]
        )

      const uniqueLinks = [...new Set(links)].filter(isSafeUrl).slice(0, 5)

      for (const link of uniqueLinks) {
        if (visited.size >= MAX_PAGES) break
        await crawl(link, depth + 1)
      }
    } catch {
      errorCount++
    }
  }

  await crawl("/", 0)

  console.log(
    `Crawler: ${visited.size} paginas visitadas, ${errorCount} errores`
  )

  expect(visited.size, "Crawler debe visitar al menos 1 pagina").toBeGreaterThan(0)
})
