import { test as base, expect, type Page as PWPage } from "@playwright/test"
import type { ConsoleError, NetworkError } from "../utils/error-capture"
import {
  registerConsoleWatcher,
  registerNetworkWatcher,
} from "../utils/error-capture"

export type Page = PWPage
export { expect }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type { ConsoleError, NetworkError }

export interface ErrorTracker {
  consoleErrors: ConsoleError[]
  networkErrors: NetworkError[]
  /** Declare an error text pattern that this test expects/accepts. */
  allowConsole: (...patterns: (string | RegExp)[]) => void
  allowNetwork: (...patterns: (string | RegExp)[]) => void
}

type MyFixtures = {
  errors: ErrorTracker
}

// ---------------------------------------------------------------------------
// Extended test with auto console/network monitoring
// ---------------------------------------------------------------------------
export const test = base.extend<MyFixtures>({
  errors: [
    async ({ page }, use) => {
      const consoleErrors: ConsoleError[] = []
      const networkErrors: NetworkError[] = []
      const allowedConsole: (string | RegExp)[] = []
      const allowedNetwork: (string | RegExp)[] = []

      registerConsoleWatcher(page, consoleErrors)
      registerNetworkWatcher(page, networkErrors)

      const tracker: ErrorTracker = {
        consoleErrors,
        networkErrors,
        allowConsole: (...patterns) => allowedConsole.push(...patterns),
        allowNetwork: (...patterns) => allowedNetwork.push(...patterns),
      }

      await use(tracker)

      // After test: assert no unexpected errors
      const unexpectedConsole = consoleErrors.filter(
        (e) => !allowedConsole.some((p) => e.text.match(p))
      )
      const unexpectedNetwork = networkErrors.filter(
        (e) => !allowedNetwork.some((p) => e.url.match(p))
      )

      if (unexpectedConsole.length > 0) {
        const lines = unexpectedConsole.map(
          (e) => `  [${e.type}] ${e.text}`
        )
        expect(
          unexpectedConsole,
          `Errores de consola no esperados:\n${lines.join("\n")}`
        ).toHaveLength(0)
      }

      if (unexpectedNetwork.length > 0) {
        const lines = unexpectedNetwork.map(
          (e) => `  [${e.status}] ${e.method} ${e.url}`
        )
        expect(
          unexpectedNetwork,
          `Errores de red no esperados:\n${lines.join("\n")}`
        ).toHaveLength(0)
      }
    },
    { auto: true, scope: "test" },
  ],
})

// ---------------------------------------------------------------------------
// Helper: assert a page loaded correctly (no 404, no blank)
// ---------------------------------------------------------------------------
export async function assertPageLoaded(page: PWPage) {
  const bodyText = await page.locator("body").innerText()

  // A 404 page typically contains "404" text
  if (bodyText.includes("404")) {
    throw new Error(
      `Pagina muestra 404: "${bodyText.slice(0, 200)}"`
    )
  }

  // Blank page
  if (bodyText.trim().length === 0) {
    throw new Error("Pagina en blanco detectada")
  }

  // Internal server error indicators
  if (
    bodyText.includes("500") &&
    bodyText.length < 300
  ) {
    throw new Error(
      `Posible error 500 en pagina: "${bodyText.slice(0, 200)}"`
    )
  }
}
