import { describe, it, expect } from "vitest"
import { PDFDocument } from "pdf-lib"
import { buildInePdf, computeIneLayout, INE_GAP_PT, INE_MARGIN_PT } from "../lib/ine-pdf-builder"
import { PAGE_SIZES } from "../lib/pdf-builder"
import { tinyJpegBlob } from "./helpers/jpeg"

describe("ine-pdf-builder: disposición", () => {
  it("frente arriba y reverso abajo con la misma anchura visual", () => {
    const layout = computeIneLayout({
      front: { width: 1000, height: 630 },
      back: { width: 1000, height: 630 },
    })
    expect(layout.front.width).toBe(layout.back.width)
    expect(layout.front.y).toBeGreaterThan(layout.back.y)
    expect(layout.front.height).toBeCloseTo(layout.back.height, 6)
  })

  it("respeta los márgenes de impresión", () => {
    const layout = computeIneLayout({
      front: { width: 1000, height: 630 },
      back: { width: 1000, height: 630 },
    })
    expect(layout.front.x).toBeGreaterThanOrEqual(INE_MARGIN_PT - 0.001)
    expect(layout.back.x).toBeGreaterThanOrEqual(INE_MARGIN_PT - 0.001)
    expect(layout.front.y + layout.front.height).toBeLessThanOrEqual(
      PAGE_SIZES.letter.height - INE_MARGIN_PT + 0.001
    )
    expect(layout.back.y).toBeGreaterThanOrEqual(INE_MARGIN_PT - 0.001)
  })

  it("respeta la separación entre caras", () => {
    const layout = computeIneLayout({
      front: { width: 1200, height: 800 },
      back: { width: 1200, height: 800 },
    })
    expect(layout.front.y - (layout.back.y + layout.back.height)).toBeCloseTo(INE_GAP_PT, 5)
  })

  it("nunca estira: conserva la proporción de cada cara", () => {
    const layout = computeIneLayout({
      front: { width: 1600, height: 1000 },
      back: { width: 1000, height: 1600 },
    })
    expect(layout.front.width / layout.front.height).toBeCloseTo(1.6, 5)
    expect(layout.back.width / layout.back.height).toBeCloseTo(0.625, 5)
  })

  it("con proporciones distintas mantiene el mismo ancho y ajusta la altura", () => {
    const layout = computeIneLayout({
      front: { width: 1000, height: 600 },
      back: { width: 1000, height: 700 },
    })
    expect(layout.front.width).toBeCloseTo(layout.back.width, 6)
    expect(layout.back.height).toBeGreaterThan(layout.front.height)
  })

  it("todo el contenido cabe en una sola hoja carta vertical", () => {
    const layout = computeIneLayout({
      front: { width: 4032, height: 3024 },
      back: { width: 4032, height: 3024 },
    })
    const contentWidth = PAGE_SIZES.letter.width - 2 * INE_MARGIN_PT
    const contentHeight = PAGE_SIZES.letter.height - 2 * INE_MARGIN_PT
    expect(layout.front.width).toBeLessThanOrEqual(contentWidth + 0.001)
    expect(layout.front.height + layout.back.height + INE_GAP_PT).toBeLessThanOrEqual(contentHeight + 0.001)
  })

  it("tolera dimensiones inválidas sin producir NaN", () => {
    const layout = computeIneLayout({
      front: { width: 0, height: 0 },
      back: { width: 0, height: 0 },
    })
    for (const entry of [layout.front, layout.back]) {
      expect(Number.isFinite(entry.x)).toBe(true)
      expect(Number.isFinite(entry.y)).toBe(true)
      expect(Number.isFinite(entry.width)).toBe(true)
      expect(Number.isFinite(entry.height)).toBe(true)
    }
  })
})

describe("ine-pdf-builder: PDF final", () => {
  it("genera exactamente una página tamaño carta vertical", async () => {
    const bytes = await buildInePdf(
      { blob: tinyJpegBlob(), width: 1000, height: 630 },
      { blob: tinyJpegBlob(), width: 1000, height: 630 }
    )
    const document = await PDFDocument.load(bytes, { updateMetadata: false })
    expect(document.getPageCount()).toBe(1)
    const size = document.getPage(0).getSize()
    expect(size.width).toBeCloseTo(PAGE_SIZES.letter.width, 1)
    expect(size.height).toBeCloseTo(PAGE_SIZES.letter.height, 1)
    expect(size.height).toBeGreaterThan(size.width)
  })

  it("no contiene texto (no hay OCR ni datos personales)", async () => {
    const bytes = await buildInePdf(
      { blob: tinyJpegBlob(), width: 1000, height: 630 },
      { blob: tinyJpegBlob(), width: 1000, height: 630 }
    )
    const asText = Buffer.from(bytes).toString("latin1")
    expect(asText).not.toContain("CURP")
    expect(asText).not.toContain("CLAVE DE ELECTOR")
  })
})
