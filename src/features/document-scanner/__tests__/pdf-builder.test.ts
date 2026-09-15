import { describe, it, expect } from "vitest"
import { PDFDocument } from "pdf-lib"
import {
  buildMultipagePdf,
  computeFitRect,
  countPdfPages,
  PAGE_SIZES,
  pdfBytesToFile,
} from "../lib/pdf-builder"
import { tinyJpegBytes, tinyJpegBlob } from "./helpers/jpeg"

describe("pdf-builder: computeFitRect", () => {
  it("centra y conserva la proporción horizontal", () => {
    const rect = computeFitRect(400, 400, 800, 400)
    expect(rect.width).toBe(400)
    expect(rect.height).toBe(200)
    expect(rect.x).toBe(0)
    expect(rect.y).toBe(100)
  })

  it("centra y conserva la proporción vertical", () => {
    const rect = computeFitRect(400, 400, 200, 800)
    expect(rect.width).toBe(100)
    expect(rect.height).toBe(400)
    expect(rect.x).toBe(150)
    expect(rect.y).toBe(0)
  })

  it("nunca estira: la escala es uniforme", () => {
    const rect = computeFitRect(300, 500, 1000, 250)
    const originalAspect = 1000 / 250
    expect(rect.width / rect.height).toBeCloseTo(originalAspect, 6)
  })

  it("tolera dimensiones inválidas", () => {
    const rect = computeFitRect(100, 200, 0, 0)
    expect(rect.width).toBe(100)
    expect(rect.height).toBe(200)
  })
})

describe("pdf-builder: PDF multipágina", () => {
  it("genera un PDF de una página", async () => {
    const bytes = await buildMultipagePdf([{ blob: tinyJpegBlob(), width: 800, height: 1000 }])
    expect(await countPdfPages(bytes)).toBe(1)
  })

  it("genera un PDF de dos páginas", async () => {
    const bytes = await buildMultipagePdf([
      { blob: tinyJpegBlob(), width: 800, height: 1000 },
      { blob: tinyJpegBlob(), width: 800, height: 1000 },
    ])
    expect(await countPdfPages(bytes)).toBe(2)
  })

  it("usa tamaño A4 por defecto y respeta Letter", async () => {
    const a4 = await buildMultipagePdf([{ blob: tinyJpegBlob(), width: 800, height: 1000 }])
    const a4Doc = await PDFDocument.load(a4, { updateMetadata: false })
    const a4Size = a4Doc.getPage(0).getSize()
    expect(a4Size.width).toBeCloseTo(PAGE_SIZES.a4.width, 1)
    expect(a4Size.height).toBeCloseTo(PAGE_SIZES.a4.height, 1)

    const letter = await buildMultipagePdf([{ blob: tinyJpegBlob(), width: 800, height: 1000 }], {
      pageSize: "letter",
    })
    const letterDoc = await PDFDocument.load(letter, { updateMetadata: false })
    const letterSize = letterDoc.getPage(0).getSize()
    expect(letterSize.width).toBeCloseTo(PAGE_SIZES.letter.width, 1)
    expect(letterSize.height).toBeCloseTo(PAGE_SIZES.letter.height, 1)
  })

  it("rechaza listas vacías", async () => {
    await expect(buildMultipagePdf([])).rejects.toThrow()
  })

  it("pdfBytesToFile agrega la extensión y el mime correctos", () => {
    const bytes = tinyJpegBytes()
    const file = pdfBytesToFile(bytes, "Documento escaneado")
    expect(file.name).toBe("Documento escaneado.pdf")
    expect(file.type).toBe("application/pdf")
    expect(file.size).toBe(bytes.byteLength)

    const alreadyPdf = pdfBytesToFile(bytes, "ine.pdf")
    expect(alreadyPdf.name).toBe("ine.pdf")
  })
})
