import type { Page } from "@playwright/test"
import type { ConsoleError, NetworkError } from "../utils/error-capture"
import { registerConsoleWatcher, registerNetworkWatcher, assertNoConsoleErrors, assertNoNetworkErrors, assertPageLoaded } from "../utils/error-capture"

// ---------------------------------------------------------------------------
// Re-export types for convenience
// ---------------------------------------------------------------------------
export type { ConsoleError, NetworkError }

// ---------------------------------------------------------------------------
// Test fixture that wraps a page with error monitoring
// ---------------------------------------------------------------------------
export interface MonitoredPage {
  page: Page
  consoleErrors: ConsoleError[]
  networkErrors: NetworkError[]
  testName: string
  validate(options?: {
    allowConsole?: (string | RegExp)[]
    allowNetwork?: (string | RegExp)[]
  }): Promise<void>
  assertPageLoaded(): Promise<void>
}

/**
 * Wrap a Playwright page with console + network error monitoring.
 * Call `validate()` at the end of the test to fail on errors.
 */
export function monitoredPage(page: Page, testName: string): MonitoredPage {
  const consoleErrors = registerConsoleWatcher(page)
  const networkErrors = registerNetworkWatcher(page, testName)

  return {
    page,
    consoleErrors,
    networkErrors,
    testName,

    async validate(options?: {
      allowConsole?: (string | RegExp)[]
      allowNetwork?: (string | RegExp)[]
    }) {
      assertNoConsoleErrors(consoleErrors, { allow: options?.allowConsole })
      assertNoNetworkErrors(networkErrors, { allow: options?.allowNetwork })
    },

    async assertPageLoaded() {
      await assertPageLoaded(page)
    },
  }
}

// ---------------------------------------------------------------------------
// Re-export helpers
// ---------------------------------------------------------------------------
export { assertNoConsoleErrors, assertNoNetworkErrors, assertPageLoaded }
