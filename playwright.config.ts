import { defineConfig, devices } from "@playwright/test"
import path from "path"

const CI = !!process.env.CI

const AUTH_FILE = path.join(__dirname, "e2e", ".auth", "user.json")

export default defineConfig({
  testDir: "./e2e",

  forbidOnly: CI,
  retries: CI ? 2 : 1,
  workers: CI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
    ["list"],
  ],

  outputDir: "test-results",

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },

  projects: [
    // ── Setup: authenticate once and save storage state ──
    {
      name: "setup",
      testMatch: /global-setup\.ts/,
    },

    // ── Authenticated projects (use storage state from setup) ──
    {
      name: "chromium-desktop",
      testIgnore: /auth-public\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_FILE,
        viewport: { width: 1440, height: 900 },
      },
      dependencies: ["setup"],
    },
    {
      name: "chromium-mobile",
      testIgnore: /auth-public\.spec\.ts/,
      use: {
        ...devices["Pixel 8"],
        storageState: AUTH_FILE,
        isMobile: true,
        hasTouch: true,
      },
      dependencies: ["setup"],
    },
    {
      name: "firefox-desktop",
      testIgnore: /auth-public\.spec\.ts/,
      use: {
        ...devices["Desktop Firefox"],
        storageState: AUTH_FILE,
        viewport: { width: 1440, height: 900 },
      },
      dependencies: ["setup"],
    },

    // ── Unauthenticated project (public-only tests) ──
    {
      name: "chromium-public",
      testMatch: /auth-public\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  // ── Web server ──
  webServer: process.env.E2E_EXTERNAL === "1"
    ? undefined
    : CI
    ? {
        command: "npm run build && npm run start",
        url: process.env.E2E_BASE_URL || "http://localhost:3000",
        reuseExistingServer: !CI,
        timeout: 120_000,
      }
    : {
        command: "npm run dev",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: !CI,
        timeout: 60_000,
      },
})
