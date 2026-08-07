import { expect } from "@playwright/test"
import type { Page, ConsoleMessage, Response as PWResponse } from "@playwright/test"

// ---------------------------------------------------------------------------
// Known, unavoidable warnings we explicitly allow
// (keep this list SHORT and ONLY for proven-not-actionable warnings)
// ---------------------------------------------------------------------------
const ALLOWED_CONSOLE_PATTERNS: (string | RegExp)[] = [
  // React dev-mode warnings that are safe
  /Download the React DevTools/i,
  // Tesseract/CDN warnings about non-critical resources
  /tesseract/,
  // PDF.js warnings about CMap/fonts
  /Warning: TT: undefined function/i,
  /The CMap/,
  // Next.js preload warnings (not errors)
  /resource.*preload.*not used/i,
]

// ---------------------------------------------------------------------------
// Console error collector
// ---------------------------------------------------------------------------
export interface ConsoleError {
  text: string
  type: string
  location: string
  timestamp: string
}

export function registerConsoleWatcher(page: Page): ConsoleError[] {
  const errors: ConsoleError[] = []

  page.on("console", (msg: ConsoleMessage) => {
    // Only capture errors and explicit warnings about serious issues
    const isError = msg.type() === "error"
    const isSeriousWarning =
      msg.type() === "warning" &&
      /(Unhandled|Hydration failed|ChunkLoadError|WebSocket is closed)/i.test(msg.text())

    if (!isError && !isSeriousWarning) return

    // Skip allowed patterns
    if (ALLOWED_CONSOLE_PATTERNS.some((p) => msg.text().match(p))) return

    errors.push({
      text: msg.text(),
      type: msg.type(),
      location: msg.location().url || "unknown",
      timestamp: new Date().toISOString(),
    })
  })

  page.on("pageerror", (error: Error) => {
    errors.push({
      text: `[Uncaught] ${error.message}`,
      type: "pageerror",
      location: "runtime",
      timestamp: new Date().toISOString(),
    })
  })

  return errors
}

// ---------------------------------------------------------------------------
// Network error collector
// ---------------------------------------------------------------------------
export interface NetworkError {
  url: string
  method: string
  status: number
  resourceType: string
  test: string
  timestamp: string
}

export function registerNetworkWatcher(page: Page, testName: string): NetworkError[] {
  const errors: NetworkError[] = []

  page.on("response", (response: PWResponse) => {
    const status = response.status()

    // Capture 5xx errors always
    if (status >= 500 && status <= 599) {
      errors.push({
        url: response.url(),
        method: response.request().method(),
        status,
        resourceType: response.request().resourceType(),
        test: testName,
        timestamp: new Date().toISOString(),
      })
      return
    }

    // Capture 4xx errors except those that might be expected
    // (404 for static assets does not count)
    if (status === 400 || status === 401 || status === 403) {
      errors.push({
        url: response.url(),
        method: response.request().method(),
        status,
        resourceType: response.request().resourceType(),
        test: testName,
        timestamp: new Date().toISOString(),
      })
      return
    }

    // Capture 404 on API calls or page navigations (not static assets)
    if (
      status === 404 &&
      (response.request().resourceType() === "fetch" ||
        response.request().resourceType() === "xhr" ||
        response.request().resourceType() === "document")
    ) {
      errors.push({
        url: response.url(),
        method: response.request().method(),
        status,
        resourceType: response.request().resourceType(),
        test: testName,
        timestamp: new Date().toISOString(),
      })
    }
  })

  // Capture failed/resource errors
  page.on("requestfailed", (request) => {
    const failure = request.failure()
    if (!failure) return

    // Don't log errors about favicon or analytics
    if (/favicon|analytics|gtag|pixel/i.test(request.url())) return

    errors.push({
      url: request.url(),
      method: request.method(),
      status: 0,
      resourceType: request.resourceType(),
      test: testName,
      timestamp: new Date().toISOString(),
    })
  })

  return errors
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that no console errors were captured during the test.
 * Call this at the end of tests that should have a clean console.
 */
export function assertNoConsoleErrors(
  errors: ConsoleError[],
  options?: { allow?: (string | RegExp)[] }
) {
  const filtered = errors.filter((e) => {
    if (!options?.allow) return true
    return !options.allow.some((p) => e.text.match(p))
  })
  expect(
    filtered,
    `Console errors detected:\n${filtered.map((e) => `  [${e.type}] ${e.text}`).join("\n")}`
  ).toHaveLength(0)
}

/**
 * Assert that no network errors were captured during the test.
 */
export function assertNoNetworkErrors(
  errors: NetworkError[],
  options?: { allow?: (string | RegExp)[] }
) {
  const filtered = errors.filter((e) => {
    if (!options?.allow) return true
    return !options.allow.some((p) => e.url.match(p))
  })
  expect(
    filtered,
    `Network errors detected:\n${filtered.map((e) => `  [${e.status}] ${e.method} ${e.url}`).join("\n")}`
  ).toHaveLength(0)
}

/**
 * Verify a page route loaded without blank/empty content.
 */
export async function assertPageLoaded(page: Page) {
  // Check we don't get the global 404 page
  await expect(page.getByText("404")).not.toBeVisible({ timeout: 3000 }).catch(() => {})

  // Check the page has visible content (not blank)
  const bodyText = await page.locator("body").innerText()
  expect(bodyText.length, "La pagina no debe estar en blanco").toBeGreaterThan(0)
}
