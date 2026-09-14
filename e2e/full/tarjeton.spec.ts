import { test, expect, type Page, assertPageLoaded } from "../fixtures/test"
import { jsPDF } from "jspdf"
import { assertSafeDatabase } from "../utils/assert-safe-database"
import { buildSyntheticTarjetonPdf } from "../fixtures/pdfs/build-tarjeton-pdf"

// ── Unique PDF generation per run (avoids hash collisions across CI runs) ──

const RUN_ID = Date.now().toString(36)

function makeValidPdf(workerName: string, period: string): Buffer {
  // Tarjetón sintético con la disposición real que exige el parser
  // (sección RECEPTOR + columnas). Ver e2e/fixtures/pdfs/build-tarjeton-pdf.ts.
  return buildSyntheticTarjetonPdf({ fullName: workerName, matricula: "900001", periodRaw: period })
}

function makeGenericPdf(): Buffer {
  const doc = new jsPDF()
  doc.setFont("helvetica")
  doc.setFontSize(12)
  doc.text("INFORME DE ACTIVIDADES", 14, 20)
  doc.text("Departamento de Recursos Humanos", 14, 28)
  doc.text("Se informa que durante el mes se realizaron", 14, 40)
  doc.text("actividades de capacitacion.", 14, 48)
  return Buffer.from(doc.output("arraybuffer"))
}

function makeIMSSNonTarjeton(): Buffer {
  const doc = new jsPDF()
  doc.setFont("helvetica")
  doc.setFontSize(10)
  doc.text("INSTITUTO MEXICANO DEL SEGURO SOCIAL", 14, 20)
  doc.text("CONSTANCIA DE VIGENCIA DE DERECHOS", 14, 28)
  doc.text("El IMSS hace constar que el trabajador", 14, 40)
  doc.text("tiene vigencia de derechos hasta: 31/12/2025", 14, 48)
  return Buffer.from(doc.output("arraybuffer"))
}

// Generate unique PDFs for this test run
const pdf1 = makeValidPdf(`A1 TEST ${RUN_ID}`, `1A-ENE-2026`)
const pdf2 = makeValidPdf(`B2 TEST ${RUN_ID}`, `2A-ENE-2026`)
const pdf3 = makeValidPdf(`C3 TEST ${RUN_ID}`, `1A-FEB-2026`)
const pdfGeneric = makeGenericPdf()
const pdfIMSS = makeIMSSNonTarjeton()

// ── Helpers ──

async function gotoAndAssert(page: Page) {
  await page.goto("/tarjeton")
  // `networkidle` no estabiliza: la app mantiene sondeos en segundo plano
  // (contexto de trabajador/agenda). Se espera el dropzone real.
  await page
    .locator('[aria-label="Seleccionar tarjetón PDF"]')
    .first()
    .waitFor({ state: "visible", timeout: 30_000 })
  await assertPageLoaded(page)
}

async function uploadPdf(page: Page, buffer: Buffer) {
  await page.setInputFiles('input[type="file"]', {
    name: "tarjeton.pdf",
    mimeType: "application/pdf",
    buffer,
  })
}

async function waitForReviewScreen(page: Page) {
  await expect(
    page.getByText("Revisa los datos detectados")
  ).toBeVisible({ timeout: 30_000 })
}

async function waitForDropzone(page: Page) {
  await expect(
    page.locator('[aria-label="Seleccionar tarjetón PDF"]').first()
  ).toBeVisible({ timeout: 30_000 })
}

async function confirmTarjeton(page: Page) {
  assertSafeDatabase()
  await page.getByRole("checkbox", { name: /Autorizo guardar los datos confirmados/i }).check()
  await page.getByRole("button", { name: "Confirmar tarjetón" }).click()
}

// ─────────────────────────────────────────────────────────────
// Valid import tests (each uses a unique PDF for isolation)
// ─────────────────────────────────────────────────────────────

test.describe("Tarjeton - Importacion valida", () => {
  test("carga la pagina de tarjeton", async ({ page }) => {
    await gotoAndAssert(page)
    await expect(
      page.getByText("Importar tarjetón IMSS")
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('[aria-label="Seleccionar tarjetón PDF"]').first()
    ).toBeVisible()
  })

  test("importa tarjeton valido, revisa datos y confirma", async ({ page }) => {
    await gotoAndAssert(page)
    await uploadPdf(page, pdf1)
    await waitForReviewScreen(page)

    // Verify review screen is showing parsed data
    await expect(page.getByText("Datos del trabajador").first()).toBeVisible({ timeout: 5000 })
    await confirmTarjeton(page)

    await expect(
      page.getByText("Tarjetón confirmado")
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText("Guardado")).toBeVisible()
  })

  test("importa segundo tarjeton distinto sin conflicto", async ({ page }) => {
    await gotoAndAssert(page)
    await uploadPdf(page, pdf2)
    await waitForReviewScreen(page)

    await expect(page.getByText("Datos del trabajador").first()).toBeVisible({ timeout: 5000 })
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
    await gotoAndAssert(page)
    await uploadPdf(page, pdfGeneric)

    // Wait for processing to finish and dropzone to reappear
    await waitForDropzone(page)

    // Review screen must NOT appear
    await expect(
      page.getByText("Revisa los datos detectados")
    ).not.toBeVisible()

    // Should show rejection error
    await expect(
      page.getByText("Este archivo no parece ser un tarjetón de pago del IMSS.")
    ).toBeVisible({ timeout: 5000 })
  })

  test("rechaza documento IMSS que no es tarjeton", async ({ page }) => {
    await gotoAndAssert(page)
    await uploadPdf(page, pdfIMSS)

    await waitForDropzone(page)

    await expect(
      page.getByText("Revisa los datos detectados")
    ).not.toBeVisible()

    await expect(
      page.getByText("Este archivo no parece ser un tarjetón de pago del IMSS.")
    ).toBeVisible({ timeout: 5000 })
  })

  test("no se puede confirmar sin consentimiento", async ({ page }) => {
    await gotoAndAssert(page)
    await uploadPdf(page, pdf3)
    await waitForReviewScreen(page)

    const confirmBtn = page.getByRole("button", { name: "Confirmar tarjetón" })
    await expect(confirmBtn).toBeDisabled()
  })
})

// ─────────────────────────────────────────────────────────────
// Deduplication test
// ─────────────────────────────────────────────────────────────

test.describe("Tarjeton - Deduplicacion", () => {
  test("detecta duplicado y muestra mensaje sin crear segundo registro", async ({ page }) => {
    await gotoAndAssert(page)

    // First import with pdf2 (unique per run)
    await uploadPdf(page, pdf2)
    await waitForReviewScreen(page)
    await confirmTarjeton(page)
    await expect(
      page.getByText("Tarjetón confirmado")
    ).toBeVisible({ timeout: 20_000 })

    // Start over and import the SAME buffer again
    await page.getByRole("button", { name: "Subir otro tarjetón" }).click()
    await expect(
      page.locator('[aria-label="Seleccionar tarjetón PDF"]').first()
    ).toBeVisible({ timeout: 10_000 })

    await uploadPdf(page, pdf2)
    await waitForReviewScreen(page)
    await confirmTarjeton(page)

    await expect(
      page.getByText("Tarjetón confirmado")
    ).toBeVisible({ timeout: 20_000 })

    // Verify duplicate indicators
    await expect(
      page.getByText("Ya habías subido este archivo")
    ).toBeVisible({ timeout: 5000 })

    await expect(
      page.getByText("No se guardó una copia duplicada")
    ).toBeVisible({ timeout: 5000 })
  })
})
