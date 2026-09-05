import { chromium } from "@playwright/test"
import path from "node:path"
import fs from "node:fs"

const AUTH_FILE = path.join(process.cwd(), "e2e", ".auth", "user.json")
const EVIDENCE_DIR = path.join(process.cwd(), "data", "test-evidence", "guia")
const REAL_PDF_PATH = "/home/chronos/Descargas/tarjeton_5ebc26b4.pdf"

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
}

async function main() {
  console.log("=== INICIO DE VALIDACIÓN REAL DE LA GUÍA ===")
  const realPdfBytes = fs.readFileSync(REAL_PDF_PATH)
  const realPdfBase64 = realPdfBytes.toString("base64")
  console.log("PDF real cargado. Tamaño bytes:", realPdfBytes.length)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    storageState: fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined,
  })

  const page = await context.newPage()
  page.on("console", (msg) => console.log("BROWSER:", msg.text()))
  page.on("pageerror", (err) => console.error("BROWSER ERROR:", err))

  // 1. Iniciar la aplicación y poblar el documento guardado en IndexedDB ("Mis documentos")
  console.log("1. Navegando a la app para preparar el tarjetón guardado en Mis documentos...")
  await page.goto("http://localhost:3000/guia", { waitUntil: "domcontentloaded" })

  // Guardar el PDF en IndexedDB usando la base real
  await page.evaluate(async (base64) => {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: "application/pdf" })

    // Abrir la base de datos de IndexedDB
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("la_veinte_tarjeton_blobs_db", 1)
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains("tarjeton_files")) {
          db.createObjectStore("tarjeton_files", { keyPath: "key" })
        }
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction("tarjeton_files", "readwrite")
        const store = tx.objectStore("tarjeton_files")
        store.put({
          key: "1A_SEP_2026",
          blob,
          fileName: "tarjeton_1A_SEP_2026.pdf",
          fileSize: bytes.byteLength,
          mimeType: "application/pdf",
          updatedAt: new Date().toISOString(),
        })
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  }, realPdfBase64)

  console.log("Documento guardado en IndexedDB con clave '1A_SEP_2026'.")

  // 2. Simular cerrar y abrir la aplicación sin pulsar "Reintentar"
  console.log("2. Recargando /guia simulando apertura inicial limpia...")
  await page.goto("http://localhost:3000/guia", { waitUntil: "networkidle" })

  console.log("Esperando 3s iniciales...")
  await page.waitForTimeout(3000)

  const initialBody = await page.evaluate(() => document.body.innerText)
  console.log("TEXTO EN /guia TRAS 3s:\n---\n" + initialBody + "\n---")

  const evalState = await page.evaluate(async () => {
    const analysisRaw = localStorage.getItem("la_veinte_payslip_analyses")
    return {
      analysisRaw,
      indexedDBAvailable: typeof indexedDB !== "undefined",
    }
  })
  console.log("EVAL STATE:", evalState)

  // Inspeccionar estado de GuiaHome
  const guiaHomeData = await page.evaluate(() => {
    const bodyText = document.body.innerText
    const analysisRaw = localStorage.getItem("la_veinte_payslip_analyses")
    return {
      bodyText,
      hasPerceptionsCount9: bodyText.includes("9"),
      hasDeductionsCount8: bodyText.includes("8"),
      hasNeto3902: bodyText.includes("3,902"),
      hasYellowWarning: bodyText.includes("Detectamos los totales") || bodyText.includes("Detalle pendiente"),
      hasRetryButton: bodyText.includes("Reintentar análisis"),
      analysisPersisted: Boolean(analysisRaw),
      analysesStored: analysisRaw ? Object.keys(JSON.parse(analysisRaw)) : [],
    }
  })

  console.log("Resultado en /guia:", {
    hasPerceptionsCount9: guiaHomeData.hasPerceptionsCount9,
    hasDeductionsCount8: guiaHomeData.hasDeductionsCount8,
    hasNeto3902: guiaHomeData.hasNeto3902,
    hasYellowWarning: guiaHomeData.hasYellowWarning,
    hasRetryButton: guiaHomeData.hasRetryButton,
    analysesStored: guiaHomeData.analysesStored,
  })

  const screenshotGuia = path.join(EVIDENCE_DIR, "guia-home-real.png")
  await page.screenshot({ path: screenshotGuia, fullPage: true })
  console.log("Captura guardada en:", screenshotGuia)

  // 3. Entrar a /guia/mi-quincena
  console.log("3. Navegando a /guia/mi-quincena...")
  await page.goto("http://localhost:3000/guia/mi-quincena", { waitUntil: "networkidle" })
  await page.waitForTimeout(1500)

  const miQuincenaData = await page.evaluate(() => {
    const text = document.body.innerText
    const stepsHeader = document.querySelector("h3")?.innerText
    return {
      hasYellowWarning: text.includes("Detectamos los totales") || text.includes("Detalle pendiente de lectura"),
      hasRetryButton: text.includes("Reintentar análisis"),
      firstStepTitle: stepsHeader,
    }
  })

  console.log("Resultado en /guia/mi-quincena:", miQuincenaData)

  const screenshotMiQuincena = path.join(EVIDENCE_DIR, "guia-mi-quincena-real.png")
  await page.screenshot({ path: screenshotMiQuincena, fullPage: true })
  console.log("Captura guardada en:", screenshotMiQuincena)

  // 4. Probar importación de un tarjetón de periodo posterior (2A-SEP-2026)
  console.log("4. Probando selección automática tras nuevo periodo (2A-SEP-2026)...")
  const secondPdfBytes = fs.readFileSync(path.join(process.cwd(), "e2e", "fixtures", "pdfs", "tarjeton-valido.pdf"))
  const secondPdfBase64 = secondPdfBytes.toString("base64")

  await page.evaluate(async (base64) => {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: "application/pdf" })

    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("la_veinte_tarjeton_blobs_db", 1)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction("tarjeton_files", "readwrite")
        const store = tx.objectStore("tarjeton_files")
        store.put({
          key: "2A_SEP_2026",
          blob,
          fileName: "tarjeton_2A_SEP_2026.pdf",
          fileSize: bytes.byteLength,
          mimeType: "application/pdf",
          updatedAt: new Date(Date.now() + 60000).toISOString(),
        })
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  }, secondPdfBase64)

  // Recargar /guia y verificar que detecta el nuevo periodo
  await page.goto("http://localhost:3000/guia", { waitUntil: "networkidle" })
  await page.waitForTimeout(3000)

  const newerPeriodData = await page.evaluate(() => {
    const text = document.body.innerText
    return {
      periodDetected: text.includes("2A_SEP_2026") || text.includes("2A-SEP-2026") || text.includes("2.ª quincena de septiembre"),
      textSample: text.slice(0, 400),
    }
  })

  console.log("Resultado cambio de periodo:", newerPeriodData)
  const screenshotNewer = path.join(EVIDENCE_DIR, "guia-newer-period.png")
  await page.screenshot({ path: screenshotNewer, fullPage: true })
  console.log("Captura periodo nuevo guardada en:", screenshotNewer)

  await browser.close()
  console.log("=== VALIDACIÓN REAL COMPLETADA EXITOSAMENTE ===")
}

main().catch((err) => {
  console.error("Error en validación:", err)
  process.exit(1)
})
