// Generates DEMO assets (fictional, for App Review / QA) under public/demo/.
// - demo-tarjeton-imss.pdf : a fictional "recibo/tarjetón" PDF with a clear DEMO watermark.
// - demo-qr-transfer.png   : a functional QR code pointing at the transfer landing.
// These are NOT real documents and contain no personal data. Run: node scripts/generate-demo-assets.mjs
import { jsPDF } from "jspdf"
import { writeFileSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import path from "node:path"

const outDir = path.resolve(process.cwd(), "public", "demo")
mkdirSync(outDir, { recursive: true })

// --- Demo PDF ---
const doc = new jsPDF({ unit: "pt", format: "letter" })
const W = doc.internal.pageSize.getWidth()
const M = 48
doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(15, 23, 42)
doc.text("DOCUMENTO DE DEMOSTRACIÓN — DATOS FICTICIOS", M, 70)
doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100, 116, 139)
doc.text("Documento generado para pruebas de revisión. No corresponde a ninguna persona real.", M, 88)
doc.setFontSize(60); doc.setTextColor(220, 220, 220); doc.text("DEMO", W - 150, 120, { angle: -30 })
doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(37, 99, 235)
doc.text("Recibo / Tarjetón (simulado)", M, 140)
doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30, 41, 59)
const lines = [
  "Nombre: [FICTICIO — no es una persona real]",
  "Matrícula: 00000000",
  "Periodo: 2026-06",
  "Días cotizados: 15",
  "Salario diario integrado: $0.00 (ficticio)",
  "Categoría: DEMO",
]
let y = 165
for (const l of lines) { doc.text(l, M, y); y += 20 }
doc.setDrawColor(203, 213, 225); doc.line(M, y, W - M, y)
doc.setFontSize(9); doc.setTextColor(100, 116, 139)
doc.text("Herramientas normativas / simuladores: resultados meramente informativos.", M, y + 18)
doc.text("Privacidad: https://la-veinte-digital.vercel.app/privacidad", M, y + 30)
const pdfBuf = Buffer.from(doc.output("arraybuffer"))
writeFileSync(path.join(outDir, "demo-tarjeton-imss.pdf"), pdfBuf)
console.log("PDF", pdfBuf.length, "bytes")

// --- Demo QR ---
try {
  execFileSync("python3", [
    "-c",
    "import qrcode; q=qrcode.QRCode(version=5,box_size=10,border=4); q.add_data('https://la-veinte-digital.vercel.app/transfer?demo=1'); q.make(fit=True); q.make_image(fill_color='#0f172a', back_color='white').save('public/demo/demo-qr-transfer.png')",
  ])
  console.log("QR written")
} catch (e) {
  console.warn("QR skipped (python qrcode not available):", e.message)
}
