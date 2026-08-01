/**
 * Copia los archivos de runtime de pdfjs-dist y tesseract.js a public/vendor/
 * para que el navegador los sirva localmente (sin CDN) durante la extracción
 * de tarjetones. Es reproducible: se ejecuta en `predev` y `prebuild`.
 *
 * No copia el PDF del usuario ni datos personales: solo archivos estáticos
 * del motor de lectura/OCR.
 */
import { mkdirSync, copyFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

const PDFJS_BUILD = join(root, "node_modules", "pdfjs-dist", "build")
const PDFJS_DEST = join(root, "public", "vendor", "pdfjs")

const TESS_DEST = join(root, "public", "vendor", "tesseract")
const TESS_CORE = join(root, "node_modules", "tesseract.js-core")
const TESS_WORKER = join(root, "node_modules", "tesseract.js", "dist", "worker.min.js")

const LANG_URL =
  "https://cdn.jsdelivr.net/npm/@tesseract.js-data/spa@1.0.0/4.0.0_best_int/spa.traineddata.gz"

function copy(src, dest) {
  if (!existsSync(src)) {
    console.warn(`[copy-vendor] falta el origen, se omite: ${src}`)
    return false
  }
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  return true
}

async function main() {
  const okPdfWorker = copy(
    join(PDFJS_BUILD, "pdf.worker.min.mjs"),
    join(PDFJS_DEST, "pdf.worker.min.mjs"),
  )
  if (!okPdfWorker) {
    console.warn("[copy-vendor] no se encontró pdf.worker.min.mjs")
  }

  copy(TESS_WORKER, join(TESS_DEST, "worker.min.js"))
  copy(
    join(TESS_CORE, "tesseract-core-simd.wasm.js"),
    join(TESS_DEST, "tesseract-core-simd.wasm.js"),
  )
  copy(
    join(TESS_CORE, "tesseract-core-simd.wasm"),
    join(TESS_DEST, "tesseract-core-simd.wasm"),
  )

  // Modelo de idioma español. La descarga es opcional: si falla (sin red),
  // el OCR usará el CDN por defecto en tiempo de ejecución.
  const langDest = join(TESS_DEST, "lang", "spa.traineddata.gz")
  if (!existsSync(langDest)) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30_000)
      const res = await fetch(LANG_URL, {
        signal: controller.signal,
        redirect: "follow",
      })
      clearTimeout(timer)
      if (res.ok) {
        mkdirSync(dirname(langDest), { recursive: true })
        const bytes = Buffer.from(await res.arrayBuffer())
        writeFileSync(langDest, bytes)
        console.log(`[copy-vendor] spa.traineddata.gz (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`)
      } else {
        console.warn(`[copy-vendor] descarga de spa.traineddata.gz falló (HTTP ${res.status}); el OCR usará CDN`)
      }
    } catch {
      console.warn("[copy-vendor] descarga de spa.traineddata.gz falló; el OCR usará CDN")
    }
  } else {
    console.log("[copy-vendor] spa.traineddata.gz ya existe, se omite la descarga")
  }

  console.log("[copy-vendor] archivos de vendor listos en public/vendor/")
}

main().catch((err) => {
  console.error("[copy-vendor] error:", err instanceof Error ? err.message : err)
  process.exit(1)
})
