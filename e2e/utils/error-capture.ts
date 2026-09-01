import type { Page, ConsoleMessage, Response as PWResponse } from "@playwright/test"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ConsoleError {
  text: string
  type: string
  location: string
  timestamp: string
}

export interface NetworkError {
  url: string
  method: string
  status: number
  resourceType: string
  timestamp: string
}

// ---------------------------------------------------------------------------
// Known, unavoidable warnings we explicitly allow globally
// ---------------------------------------------------------------------------
const ALLOWED_CONSOLE_PATTERNS: (string | RegExp)[] = [
  /Download the React DevTools/i,
  /tesseract/,
  /Warning: TT: undefined function/i,
  /The CMap/,
  /resource.*preload.*not used/i,
  // Facebook embedded iframe errors - external third party, not our code
  /ErrorUtils caught an error/i,
  /Could not find element/i,
  /DataStore\.get: namespace is required/i,
  /fbcdn\.net/,
  /Subsequent non-fatal errors won't be logged/i,
  // Facebook blocks iframe embedding in CI (X-Frame-Options: deny)
  /X-Frame-Options/i,
  /Refused to display.*facebook/i,
]

// ---------------------------------------------------------------------------
// Console watcher (push into provided array)
// ---------------------------------------------------------------------------
export function registerConsoleWatcher(
  page: Page,
  errors: ConsoleError[]
): void {
  page.on("console", (msg: ConsoleMessage) => {
    const isError = msg.type() === "error"
    const isSeriousWarning =
      msg.type() === "warning" &&
      /(Unhandled|Hydration failed|ChunkLoadError|WebSocket is closed)/i.test(
        msg.text()
      )

    if (!isError && !isSeriousWarning) return

    // Facebook iframe resources blocked in CI (location is chrome-error://)
    if (msg.location().url.includes("chrome-error://")) return

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
}

// ---------------------------------------------------------------------------
// Network watcher (push into provided array)
// ---------------------------------------------------------------------------
export function registerNetworkWatcher(
  page: Page,
  errors: NetworkError[]
): void {
  page.on("response", (response: PWResponse) => {
    const status = response.status()

    // Facebook iframe resources blocked in CI
    if (/facebook\.com/i.test(response.url())) return

    if (status >= 500 && status <= 599) {
      errors.push({
        url: response.url(),
        method: response.request().method(),
        status,
        resourceType: response.request().resourceType(),
        timestamp: new Date().toISOString(),
      })
      return
    }

    if (status === 400 || status === 401 || status === 403) {
      errors.push({
        url: response.url(),
        method: response.request().method(),
        status,
        resourceType: response.request().resourceType(),
        timestamp: new Date().toISOString(),
      })
      return
    }

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
        timestamp: new Date().toISOString(),
      })
    }
  })

  page.on("requestfailed", (request) => {
    const failure = request.failure()
    if (!failure) return
    const url = request.url()
    if (/favicon|analytics|gtag|pixel|fbcdn|facebook/i.test(url)) return
    // Next.js RSC requests legitimately aborted during navigation
    if (/_rsc=/.test(url)) return
    // Form POSTs that get aborted during fast navigation (CI)
    if (request.method() === "POST" && /\/login|\/register/.test(url)) return
    // Peticiones abortadas legítimamente durante navegación/prefetch
    if (failure.errorText?.includes("ERR_ABORTED")) return

    errors.push({
      url: request.url(),
      method: request.method(),
      status: 0,
      resourceType: request.resourceType(),
      timestamp: new Date().toISOString(),
    })
  })
}
