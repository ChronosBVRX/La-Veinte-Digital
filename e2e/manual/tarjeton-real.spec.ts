/**
 * MANUAL E2E test for a real IMSS tarjeton PDF.
 * Runs ONLY locally with E2E_REAL_TARJETON_PATH set.
 * NOT for CI - contains no fixture data, only uses local file.
 *
 * Usage (PowerShell):
 *   $env:E2E_REAL_TARJETON_PATH='C:\...\tarjeton.pdf'
 *   $env:E2E_BASE_URL='https://la-veinte-digital.vercel.app'
 *   $env:E2E_EXTERNAL='1'
 *   npx playwright test e2e/manual/tarjeton-real.spec.ts --project=chromium-desktop --headed
 */
import { test, expect, type Page } from "@playwright/test"

const PDF_PATH = process.env.E2E_REAL_TARJETON_PATH

test.describe("Tarjeton real - diagnostico manual", () => {
  test("flujo completo con PDF real", async ({ page }) => {
    if (!PDF_PATH) {
      test.skip(true, "E2E_REAL_TARJETON_PATH no definida")
      return
    }

    // 1. Navigate to tarjeton page
    await page.goto("/tarjeton")
    await page.waitForLoadState("networkidle")
    await expect(
      page.locator('[aria-label="Seleccionar tarjetón PDF"]').first()
    ).toBeVisible({ timeout: 10_000 })

    // 2. Upload the real PDF
    await page.locator('input[type="file"]').setInputFiles(PDF_PATH)

    // 3. Wait for extraction to complete (30s max)
    await expect(
      page.getByText("Revisa los datos detectados")
    ).toBeVisible({ timeout: 30_000 })

    // 4. Verify sections exist
    await expect(page.getByText("Percepciones")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Deducciones")).toBeVisible({ timeout: 5000 })

    // 5. Accept consent
    const consentCheckbox = page.locator('input[type="checkbox"]').first()
    if (await consentCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await consentCheckbox.check()
    }

    // 6. Set up response capture BEFORE clicking confirm
    const responsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/tarjeton/confirm") &&
        r.request().method() === "POST",
      { timeout: 30_000 }
    )

    // 7. Click confirm
    await page.getByRole("button", { name: "Confirmar tarjetón" }).click()

    // 8. Wait for the response
    const response = await responsePromise
    const status = response.status()
    let body: unknown = {}
    try { body = await response.json() } catch { /* not JSON */ }

    // 9. Log only safe metadata
    console.log("\n=== TARJETON REAL RESULT ===")
    console.log("HTTP status:", status)
    console.log("Response:", JSON.stringify(body, null, 2))
    console.log("===========================\n")

    // 10. Report outcome
    if (status >= 200 && status < 300) {
      console.log("SUCCESS: Tarjeton confirmado correctamente")
    } else {
      console.log("FAILURE: Revisa los logs de Vercel para el error detallado")
    }
  })
})
