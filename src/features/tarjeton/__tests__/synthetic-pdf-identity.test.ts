/**
 * DiagnÃ³stico de identidad de tarjetÃ³n: PDF sintÃ©tico â†’ PDF.js REAL â†’
 * extractor de producciÃ³n (`extractNativePdfText`) â†’ parser REAL.
 *
 * No usa mocks ni inyecta la matrÃ­cula: ejercita el mismo camino que la app.
 * Reproduce la causa raÃ­z encontrada en el E2E: el parser exige la secciÃ³n
 * `RECEPTOR`; un PDF sin ella pierde la identidad.
 */
import { describe, it, expect } from "vitest"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { extractNativePdfText } from "@/features/tarjeton/lib/extract-native-pdf"
import { parseImssTarjeton } from "@/features/tarjeton/lib/imss-tarjeton-parser"
import { buildImssLayoutRegions } from "@/features/tarjeton/lib/imss-layout-regions"
import { buildSyntheticTarjetonPdf } from "../../../../e2e/fixtures/pdfs/build-tarjeton-pdf"

async function parseSynthetic(pdf: Buffer) {
  const task = getDocument({
    data: new Uint8Array(pdf),
    useWorkerFetch: false,
    disableFontFace: true,
  })
  const { items, pageCount } = await extractNativePdfText(
    task as unknown as Parameters<typeof extractNativePdfText>[0],
  )
  const outcome = await parseImssTarjeton({ items, pageCount, hashText: async (s) => `h:${s.length}` })
  const layout = buildImssLayoutRegions(items)
  return { items, outcome, layout }
}

describe("PDF sintÃ©tico â†’ PDF.js â†’ parser real", () => {
  it("detecta nombre, matrÃ­cula, categorÃ­a, periodo, conceptos y totales (identidad ALFA)", async () => {
    const pdf = buildSyntheticTarjetonPdf({
      fullName: "USUARIO PRUEBA ALFA",
      matricula: "900123",
      periodRaw: "1A-ENE-2026",
    })
    const { outcome, layout } = await parseSynthetic(pdf)

    expect(layout.receptorScoped).toBe(true)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    expect(outcome.parsed.employee.employeeNumber).toBe("900123")
    expect(outcome.parsed.employee.fullName).toBe("USUARIO PRUEBA ALFA")
    expect(outcome.parsed.employee.categoryCode).toBe("6112")
    expect(outcome.parsed.employee.categoryName).toBe("ENFERMERA GENERAL 80")
    expect(outcome.parsed.document.periodRaw).toBe("1A-ENE-2026")
    expect(outcome.parsed.document.year).toBe(2026)
    expect(outcome.parsed.document.month).toBe(1)
    expect(outcome.parsed.document.half).toBe(1)
    expect(outcome.parsed.payroll.totalEarnings).toBe(9100)
    expect(outcome.parsed.payroll.totalDeductions).toBe(1000)
    expect(outcome.parsed.payroll.netPay).toBe(8100)
    expect(outcome.parsed.payroll.earnings.map((l) => l.code)).toEqual(["002", "011"])
    expect(outcome.parsed.payroll.deductions.map((l) => l.code)).toEqual(["111"])
  })

  it("parametriza la identidad (BETA) con el mismo periodo", async () => {
    const pdf = buildSyntheticTarjetonPdf({
      fullName: "USUARIO PRUEBA BETA",
      matricula: "900456",
      periodRaw: "1A-ENE-2026",
    })
    const { outcome } = await parseSynthetic(pdf)

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.parsed.employee.fullName).toBe("USUARIO PRUEBA BETA")
    expect(outcome.parsed.employee.employeeNumber).toBe("900456")
    expect(outcome.parsed.document.periodRaw).toBe("1A-ENE-2026")
  })

  it("sin secciÃ³n RECEPTOR la identidad se pierde (documenta la causa raÃ­z)", async () => {
    // PDF sin RECEPTOR: el layout no puede aislar el bloque y el parser recibe [].
    const doc = buildSyntheticTarjetonPdf({
      fullName: "USUARIO PRUEBA ALFA",
      matricula: "900123",
      periodRaw: "1A-ENE-2026",
    })
    // Elimina la cadena RECEPTOR del contenido textual reconstruyendo el PDF es
    // equivalente a usar un generador sin ella; aquÃ­ comprobamos la guarda del
    // layout sobre los items reales quitando el ancla.
    const task = getDocument({ data: new Uint8Array(doc), useWorkerFetch: false, disableFontFace: true })
    const { items } = await extractNativePdfText(task as unknown as Parameters<typeof extractNativePdfText>[0])
    const withoutReceptor = items.filter((i) => !i.text.includes("RECEPTOR"))
    const layout = buildImssLayoutRegions(withoutReceptor)
    expect(layout.receptorScoped).toBe(false)

    const outcome = await parseImssTarjeton({ items: withoutReceptor, pageCount: 1, hashText: async (s) => `h:${s.length}` })
    if (outcome.ok) {
      expect(outcome.parsed.employee.employeeNumber).toBeUndefined()
      expect(outcome.parsed.employee.fullName).toBeUndefined()
    }
  })
})
