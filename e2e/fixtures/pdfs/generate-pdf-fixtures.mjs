/**
 * Script to generate synthetic PDF fixtures for E2E tarjeton tests.
 * Uses jsPDF (already in dependencies) to create PDFs with selectable text.
 *
 * Run: node e2e/fixtures/pdfs/generate-pdf-fixtures.mjs
 */
import { jsPDF } from "jspdf"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Helpers ──
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function save(doc, filename) {
  const filepath = path.join(__dirname, filename)
  fs.writeFileSync(filepath, Buffer.from(doc.output("arraybuffer")))
  console.log(`  ✓ ${filename}`)
}

// ── Fixture 1: Tarjeton valido (texto seleccionable) ──
function createValidPayslip() {
  const doc = new jsPDF()
  doc.setFont("helvetica")
  doc.setFontSize(10)

  doc.text("INSTITUTO MEXICANO DEL SEGURO SOCIAL", 14, 20)
  doc.text("TARJETON DE PAGO", 14, 28)
  doc.text("Nombre: JUAN PEREZ LOPEZ", 14, 40)
  doc.text("NSS: 12345678901", 14, 48)
  doc.text("Periodo: 01/01/2025 - 15/01/2025", 14, 56)
  doc.text("No. de afiliacion: 00123456789", 14, 64)

  doc.text("PERCEPCIONES", 14, 80)
  doc.text("Sueldo base", 14, 88)
  doc.text("$5,000.00", 150, 88)
  doc.text("Ayuda de despensa", 14, 96)
  doc.text("$1,200.00", 150, 96)
  doc.text("Compensacion", 14, 104)
  doc.text("$800.00", 150, 104)
  doc.text("Total percepciones: $7,000.00", 14, 116)

  doc.text("DEDUCCIONES", 14, 132)
  doc.text("Cuota IMSS", 14, 140)
  doc.text("$350.00", 150, 140)
  doc.text("ISR", 14, 148)
  doc.text("$200.00", 150, 148)
  doc.text("Prestamo FONACOT", 14, 156)
  doc.text("$150.00", 150, 156)
  doc.text("Total deducciones: $700.00", 14, 168)

  doc.text("LIQUIDO A RECIBIR: $6,300.00", 14, 185)

  return doc
}

// ── Fixture 2: Tarjeton sin percepciones ──
function createPayslipNoPercepciones() {
  const doc = new jsPDF()
  doc.setFont("helvetica")
  doc.setFontSize(10)

  doc.text("INSTITUTO MEXICANO DEL SEGURO SOCIAL", 14, 20)
  doc.text("TARJETON DE PAGO", 14, 28)
  doc.text("Nombre: MARIA GONZALEZ", 14, 40)
  doc.text("NSS: 98765432109", 14, 48)
  doc.text("Periodo: 16/01/2025 - 31/01/2025", 14, 56)

  doc.text("DEDUCCIONES", 14, 80)
  doc.text("Cuota IMSS", 14, 88)
  doc.text("$200.00", 150, 88)

  return doc
}

// ── Fixture 3: Tarjeton sin deducciones ──
function createPayslipNoDeducciones() {
  const doc = new jsPDF()
  doc.setFont("helvetica")
  doc.setFontSize(10)

  doc.text("INSTITUTO MEXICANO DEL SEGURO SOCIAL", 14, 20)
  doc.text("TARJETON DE PAGO", 14, 28)
  doc.text("Nombre: CARLOS RUIZ", 14, 40)
  doc.text("NSS: 56789012345", 14, 48)
  doc.text("Periodo: 01/02/2025 - 15/02/2025", 14, 56)

  doc.text("PERCEPCIONES", 14, 80)
  doc.text("Sueldo base", 14, 88)
  doc.text("$8,000.00", 150, 88)
  doc.text("Total percepciones: $8,000.00", 14, 100)

  return doc
}

// ── Fixture 4: PDF IMSS que no es tarjeton (ej: constancia) ──
function createIMSSNonPayslip() {
  const doc = new jsPDF()
  doc.setFont("helvetica")
  doc.setFontSize(10)

  doc.text("INSTITUTO MEXICANO DEL SEGURO SOCIAL", 14, 20)
  doc.text("CONSTANCIA DE VIGENCIA DE DERECHOS", 14, 28)
  doc.text("El IMSS hace constar que:", 14, 40)
  doc.text("JUAN PEREZ LOPEZ", 14, 48)
  doc.text("Con NSS: 12345678901", 14, 56)
  doc.text("Tiene vigencia de derechos hasta: 31/12/2025", 14, 64)
  doc.text("Tipo de asegurado: Permanente", 14, 72)

  return doc
}

// ── Fixture 5: PDF generico (no IMSS) ──
function createGenericPDF() {
  const doc = new jsPDF()
  doc.setFont("helvetica")
  doc.setFontSize(12)

  doc.text("INFORME DE ACTIVIDADES", 14, 20)
  doc.text("Departamento de Recursos Humanos", 14, 28)
  doc.text("Se informa que durante el mes de enero se realizaron", 14, 40)
  doc.text("las siguientes actividades de capacitacion...", 14, 48)
  doc.text("Total de participantes: 45", 14, 60)

  return doc
}

// ── Fixture 6: Tarjeton con campos ambiguos (confianza baja) ──
function createAmbiguousPayslip() {
  const doc = new jsPDF()
  doc.setFont("helvetica")
  doc.setFontSize(10)

  doc.text("INSTITUTO MEXICANO DEL SEGURO SOCIAL", 14, 20)
  doc.text("TARJETON DE PAGO", 14, 28)
  doc.text("Nombre: ANA GARCIA", 14, 40)
  // Missing NSS
  doc.text("Periodo: 01/03/2025 - 15/03/2025", 14, 56)

  doc.text("PERCEPCIONES", 14, 75)
  doc.text("Concepto 001", 14, 83)
  doc.text("$3,000.00", 150, 83)
  doc.text("Concepto 002", 14, 91)
  doc.text("$500.00", 150, 91)

  return doc
}

// ── Main ──
function main() {
  console.log("Generando PDF fixtures para E2E...")
  ensureDir(__dirname)

  save(createValidPayslip(), "tarjeton-valido.pdf")
  save(createPayslipNoPercepciones(), "tarjeton-sin-percepciones.pdf")
  save(createPayslipNoDeducciones(), "tarjeton-sin-deducciones.pdf")
  save(createIMSSNonPayslip(), "imss-no-tarjeton.pdf")
  save(createGenericPDF(), "documento-generico.pdf")
  save(createAmbiguousPayslip(), "tarjeton-ambiguo.pdf")

  console.log("Fixtures generados exitosamente.")
}

main()
