import { test, expect, type Page, assertPageLoaded } from "../fixtures/test"
import path from "path"
import fs from "fs"
import { jsPDF } from "jspdf"

// ── Unique PDF generation per run (avoids hash collisions across CI runs) ──

const PDF_DIR = path.join(__dirname, "..", "fixtures", "pdfs")
const RUN_ID = Date.now().toString(36)

function makeValidPdf(workerName: string, period: string): Buffer {
  const doc = new jsPDF()
  doc.setFont("helvetica")
  doc.setFontSize(10)
  doc.text("INSTITUTO MEXICANO DEL SEGURO SOCIAL", 14, 20)
  doc.text("TARJETON DE PAGO", 14, 28)
  doc.text(`Nombre: ${workerName}`, 14, 40)
  doc.text("NSS: 10020030001", 14, 48)
  doc.text(`Periodo: ${period}`, 14, 56)
  doc.text("PERCEPCIONES", 14, 75)
  doc.text("Sueldo base", 14, 83)
  doc.text("$5,000.00", 150, 83)
  doc.text("Ayuda de despensa", 14, 91)
  doc.text("$1,200.00", 150, 91)
  doc.text("Total percepciones: $6,200.00", 14, 103)
  doc.text("DEDUCCIONES", 14, 119)
  doc.text("Cuota IMSS", 14, 127)
  doc.text("$300.00", 150, 127)
  doc.text("Total deducciones: $300.00", 14, 139)
  doc.text("LIQUIDO A RECIBIR: $5,900.00", 14, 155)
  return Buffer.from(doc.output("arraybuffer"))
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
const pdf1 = makeValidPdf(`A1 TEST ${RUN_ID}`, `01/01/2026-15/01/2026`)
const pdf2 = makeValidPdf(`B2 TEST ${RUN_ID}`, `16/01/2026-31/01/2026`)
const pdf3 = makeValidPdf(`C3 TEST ${RUN_ID}`, `01/02/2026-15/02/2026`)
const pdfGeneric = makeGenericPdf()
const pdfIMSS = makeIMSSNonTarjeton()

// ── Helpers ──

async function gotoAndAssert(page: Page) {
  await page.goto("/tarjeton")
  await page.waitForLoadState("networkidle")
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

    await expect(page.getByText(`A1 TEST ${RUN_ID}`)).toBeVisible({ timeout: 5000 })
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

    await expect(page.getByText(`B2 TEST ${RUN_ID}`)).toBeVisible({ timeout: 5000 })
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
