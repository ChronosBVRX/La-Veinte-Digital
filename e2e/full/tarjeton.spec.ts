import { test, expect, type Page } from "@playwright/test"
import path from "path"

const FIXTURES = path.join(__dirname, "..", "fixtures", "pdfs")

const pdfPath = (name: string) => path.join(FIXTURES, name)

// ── Helpers ──

async function uploadPdf(page: Page, filePath: string) {
  await page.setInputFiles('input[type="file"]', filePath)
}

async function waitForReviewScreen(page: Page) {
  await expect(
    page.getByText("Revisa los datos detectados")
  ).toBeVisible({ timeout: 30_000 })
}

async function waitForDropzoneWithError(page: Page) {
  await expect(
    page.locator('[aria-label="Seleccionar tarjetón PDF"]')
  ).toBeVisible({ timeout: 30_000 })
}

async function confirmTarjeton(page: Page) {
  const consentCheckbox = page.locator('input[type="checkbox"]').first()
  if (await consentCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await consentCheckbox.check()
  }
  await page.getByRole("button", { name: "Confirmar tarjetón" }).click()
}

// ─────────────────────────────────────────────────────────────
// Valid import tests (each uses a unique PDF for isolation)
// ─────────────────────────────────────────────────────────────

test.describe("Tarjeton - Importacion valida", () => {
  test("carga la pagina de tarjeton", async ({ page }) => {
    await page.goto("/tarjeton")
    await page.waitForLoadState("networkidle")

    await expect(
      page.getByText("Importar tarjetón IMSS")
    ).toBeVisible({ timeout: 10_000 })

    await expect(
      page.locator('[aria-label="Seleccionar tarjetón PDF"]')
    ).toBeVisible()
  })

  test("importa tarjeton valido, revisa datos y confirma", async ({ page }) => {
    await page.goto("/tarjeton")
    await page.waitForLoadState("networkidle")

    await uploadPdf(page, pdfPath("tarjeton-valido.pdf"))
    await waitForReviewScreen(page)

    // Verify worker data was extracted
    await expect(page.getByText("JUAN PEREZ LOPEZ")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Percepciones")).toBeVisible()
    await expect(page.getByText("Deducciones")).toBeVisible()

    // Confirm the import
    await confirmTarjeton(page)

    // Verify success screen with specific assertions
    await expect(
      page.getByText("Tarjetón confirmado")
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText("Guardado")).toBeVisible()
  })

  test("importa segundo tarjeton distinto sin conflicto", async ({ page }) => {
    await page.goto("/tarjeton")
    await page.waitForLoadState("networkidle")

    // Use tarjeton-valido-2.pdf (different worker/period than valido.pdf)
    await uploadPdf(page, pdfPath("tarjeton-valido-2.pdf"))
    await waitForReviewScreen(page)

    await expect(page.getByText("ROBERTO DIAZ SOTO")).toBeVisible({ timeout: 5000 })
    await confirmTarjeton(page)

    await expect(
      page.getByText("Tarjetón confirmado")
    ).toBeVisible({ timeout: 20_000 })
  })
})

// ─────────────────────────────────────────────────────────────
// Negative tests: invalid PDFs MUST be rejected
// ─────────────────────────────────────────────────────────────

test.describe("Tarjeton - Casos invalidos (deben fallar)", () => {
  test("rechaza PDF generico - no permite revision ni confirmacion", async ({ page }) => {
    await page.goto("/tarjeton")
    await page.waitForLoadState("networkidle")

    await uploadPdf(page, pdfPath("documento-generico.pdf"))

    // Wait for processing to finish: either error appears or dropzone reappears
    await waitForDropzoneWithError(page)

    // CRITICAL: the review screen must NOT appear
    await expect(
      page.getByText("Revisa los datos detectados")
    ).not.toBeVisible()

    // Should show an error indicating the file was rejected
    const errorMsg = page.getByText("Este archivo no parece ser un tarjetón de pago del IMSS.")
    await expect(errorMsg).toBeVisible({ timeout: 5000 })
  })

  test("rechaza documento IMSS que no es tarjeton", async ({ page }) => {
    await page.goto("/tarjeton")
    await page.waitForLoadState("networkidle")

    await uploadPdf(page, pdfPath("imss-no-tarjeton.pdf"))
    await waitForDropzoneWithError(page)

    // Review screen must NOT appear
    await expect(
      page.getByText("Revisa los datos detectados")
    ).not.toBeVisible()

    // Should show rejection error
    const errorMsg = page.getByText(
      "Este archivo no parece ser un tarjetón de pago del IMSS."
    )
    await expect(errorMsg).toBeVisible({ timeout: 5000 })
  })

  test("no se puede confirmar sin consentimiento", async ({ page }) => {
    await page.goto("/tarjeton")
    await page.waitForLoadState("networkidle")

    await uploadPdf(page, pdfPath("tarjeton-valido-3.pdf"))
    await waitForReviewScreen(page)

    // Do NOT check the consent checkbox
    // The confirm button should be disabled
    const confirmBtn = page.getByRole("button", { name: "Confirmar tarjetón" })
    await expect(confirmBtn).toBeDisabled()
  })
})

// ─────────────────────────────────────────────────────────────
// Duplicate deduplication test
// ─────────────────────────────────────────────────────────────

test.describe("Tarjeton - Deduplicacion", () => {
  test("detecta duplicado y muestra mensaje sin crear segundo registro", async ({ page }) => {
    await page.goto("/tarjeton")
    await page.waitForLoadState("networkidle")

    // First import
    await uploadPdf(page, pdfPath("tarjeton-valido-2.pdf"))
    await waitForReviewScreen(page)

    await expect(page.getByText("ROBERTO DIAZ SOTO")).toBeVisible({ timeout: 5000 })
    await confirmTarjeton(page)
    await expect(
      page.getByText("Tarjetón confirmado")
    ).toBeVisible({ timeout: 20_000 })

    // Start over for the second attempt
    await page.getByRole("button", { name: "Subir otro tarjetón" }).click()
    await expect(
      page.locator('[aria-label="Seleccionar tarjetón PDF"]')
    ).toBeVisible({ timeout: 10_000 })

    // Import the SAME file again
    await uploadPdf(page, pdfPath("tarjeton-valido-2.pdf"))
    await waitForReviewScreen(page)
    await confirmTarjeton(page)

    // Should reach the success screen but with duplicate badge
    await expect(
      page.getByText("Tarjetón confirmado")
    ).toBeVisible({ timeout: 20_000 })

    // Check for duplicate-specific indicators
    const duplicateBadge = page.getByText("Ya habías subido este archivo")
    await expect(duplicateBadge).toBeVisible({ timeout: 5000 })

    const duplicateNote = page.getByText("No se guardó una copia duplicada")
    await expect(duplicateNote).toBeVisible({ timeout: 5000 })
  })
})
