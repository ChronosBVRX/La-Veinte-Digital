import { describe, it, expect } from "vitest"
import { PDFDocument } from "pdf-lib"
import {
  buildInePdf,
  computeIneLayout,
  computeFitRectWithinPhysicalCard,
  INE_GAP_PT,
  INE_PHYSICAL_HEIGHT_MM,
  INE_PHYSICAL_HEIGHT_PT,
  INE_PHYSICAL_WIDTH_MM,
  INE_PHYSICAL_WIDTH_PT,
} from "../lib/ine-pdf-builder"
import { PAGE_SIZES, buildMultipagePdf } from "../lib/pdf-builder"
import { tinyJpegBlob } from "./helpers/jpeg"

describe("ine-pdf-builder: constantes de referencia física oficial", () => {
  it("las dimensiones físicas en milímetros coinciden con la norma ID-1 (85.60 × 53.98 mm)", () => {
    expect(INE_PHYSICAL_WIDTH_MM).toBe(85.60)
    expect(INE_PHYSICAL_HEIGHT_MM).toBe(53.98)
  })

  it("la conversión a puntos PDF (pt = mm / 25.4 * 72) es aproximadamente 242.65 pt × 153.01 pt", () => {
    expect(INE_PHYSICAL_WIDTH_PT).toBeCloseTo(242.65, 1)
    expect(INE_PHYSICAL_HEIGHT_PT).toBeCloseTo(153.01, 1)
    expect(Math.abs(INE_PHYSICAL_WIDTH_PT - 242.65)).toBeLessThan(0.01)
    expect(Math.abs(INE_PHYSICAL_HEIGHT_PT - 153.01)).toBeLessThan(0.01)
  })
})

describe("ine-pdf-builder: 10 verificaciones obligatorias de fotocopia de credencial", () => {
  // 1. Página exactamente Carta 612 × 792 pt
  it("1. la página resultante es exactamente tamaño Carta (612 × 792 pt)", async () => {
    const layout = computeIneLayout({
      front: { width: 1000, height: 630 },
      back: { width: 1000, height: 630 },
    })
    expect(layout.pageWidth).toBe(612)
    expect(layout.pageHeight).toBe(792)

    const bytes = await buildInePdf(
      { blob: tinyJpegBlob(), width: 1000, height: 630 },
      { blob: tinyJpegBlob(), width: 1000, height: 630 }
    )
    const document = await PDFDocument.load(bytes, { updateMetadata: false })
    const size = document.getPage(0).getSize()
    expect(size.width).toBe(612)
    expect(size.height).toBe(792)
  })

  // 2. Frente y reverso en la misma página
  it("2. frente y reverso están en la misma página", async () => {
    const bytes = await buildInePdf(
      { blob: tinyJpegBlob(), width: 1000, height: 630 },
      { blob: tinyJpegBlob(), width: 1000, height: 630 }
    )
    const document = await PDFDocument.load(bytes, { updateMetadata: false })
    expect(document.getPageCount()).toBe(1)
  })

  // 3. Ancho máximo de cada credencial ≈ 242.65 pt
  it("3. ancho máximo de cada credencial está acotado a la caja física de ≈ 242.65 pt", () => {
    const layout = computeIneLayout({
      front: { width: 8560, height: 5398 },
      back: { width: 8560, height: 5398 },
    })
    expect(layout.front.width).toBeLessThanOrEqual(INE_PHYSICAL_WIDTH_PT + 0.001)
    expect(layout.back.width).toBeLessThanOrEqual(INE_PHYSICAL_WIDTH_PT + 0.001)
    expect(layout.front.width).toBeCloseTo(242.65, 1)
    expect(layout.back.width).toBeCloseTo(242.65, 1)
  })

  // 4. Alto máximo ≈ 153.01 pt
  it("4. alto máximo de cada credencial está acotado a la caja física de ≈ 153.01 pt", () => {
    const layout = computeIneLayout({
      front: { width: 856, height: 540 },
      back: { width: 856, height: 540 },
    })
    expect(layout.front.height).toBeLessThanOrEqual(INE_PHYSICAL_HEIGHT_PT + 0.001)
    expect(layout.back.height).toBeLessThanOrEqual(INE_PHYSICAL_HEIGHT_PT + 0.001)
    expect(layout.front.height).toBeCloseTo(153.01, 1)
    expect(layout.back.height).toBeCloseTo(153.01, 1)
  })

  // 5. Frente y reverso con idéntica caja física
  it("5. frente y reverso tienen idéntica caja física (242.65 × 153.01 pt)", () => {
    const layout = computeIneLayout({
      front: { width: 1200, height: 800 },
      back: { width: 1500, height: 900 },
    })
    expect(layout.front.boxWidth).toBe(layout.back.boxWidth)
    expect(layout.front.boxHeight).toBe(layout.back.boxHeight)
    expect(layout.front.boxWidth).toBeCloseTo(242.65, 1)
    expect(layout.front.boxHeight).toBeCloseTo(153.01, 1)
    expect(layout.cardBoxWidth).toBeCloseTo(242.65, 1)
    expect(layout.cardBoxHeight).toBeCloseTo(153.01, 1)
  })

  // 6. Centrado horizontal correcto
  it("6. ambas caras y sus cajas están correctamente centradas horizontalmente en la página Carta", () => {
    const layout = computeIneLayout({
      front: { width: 856, height: 540 },
      back: { width: 856, height: 540 },
    })
    const expectedBoxX = (PAGE_SIZES.letter.width - INE_PHYSICAL_WIDTH_PT) / 2
    expect(layout.front.boxX).toBeCloseTo(expectedBoxX, 2)
    expect(layout.back.boxX).toBeCloseTo(expectedBoxX, 2)

    // El centro geométrico de cada imagen coincide con el centro de la página (306 pt)
    const pageCenterX = PAGE_SIZES.letter.width / 2
    expect(layout.front.x + layout.front.width / 2).toBeCloseTo(pageCenterX, 1)
    expect(layout.back.x + layout.back.width / 2).toBeCloseTo(pageCenterX, 1)
  })

  // 7. Separación sin solapamiento
  it("7. frente arriba y reverso abajo con separación visual clara sin solapamiento", () => {
    const layout = computeIneLayout({
      front: { width: 1000, height: 630 },
      back: { width: 1000, height: 630 },
    })
    // Frente estrictamente arriba de reverso en coordenadas PDF (mayor Y)
    expect(layout.front.y).toBeGreaterThan(layout.back.y + layout.back.height)
    // Separación entre cajas coincide con INE_GAP_PT (entre 18 y 30 pt)
    expect(INE_GAP_PT).toBeGreaterThanOrEqual(18)
    expect(INE_GAP_PT).toBeLessThanOrEqual(30)
    expect(layout.front.boxY - (layout.back.boxY + layout.back.boxHeight)).toBeCloseTo(INE_GAP_PT, 2)
    // No hay solapamiento entre las áreas dibujadas
    expect(layout.front.y - (layout.back.y + layout.back.height)).toBeGreaterThanOrEqual(INE_GAP_PT - 0.01)
  })

  // 8. Proporción interna preservada (nunca estira una captura deformada)
  it("8. nunca estira ni deforma: preserva exactamente la proporción de aspecto original", () => {
    const frontRatio = 1600 / 1000 // 1.6
    const backRatio = 1000 / 1600 // 0.625 (captura inusual/vertical)
    const layout = computeIneLayout({
      front: { width: 1600, height: 1000 },
      back: { width: 1000, height: 1600 },
    })
    expect(layout.front.width / layout.front.height).toBeCloseTo(frontRatio, 4)
    expect(layout.back.width / layout.back.height).toBeCloseTo(backRatio, 4)

    // Y ambas caben estrictamente dentro de la caja física sin excederla
    expect(layout.front.width).toBeLessThanOrEqual(INE_PHYSICAL_WIDTH_PT + 0.001)
    expect(layout.front.height).toBeLessThanOrEqual(INE_PHYSICAL_HEIGHT_PT + 0.001)
    expect(layout.back.width).toBeLessThanOrEqual(INE_PHYSICAL_WIDTH_PT + 0.001)
    expect(layout.back.height).toBeLessThanOrEqual(INE_PHYSICAL_HEIGHT_PT + 0.001)
  })

  // 9. PDF sigue siendo exactamente 1 página
  it("9. el PDF generado es siempre de exactamente 1 página sin desbordamiento", async () => {
    const bytes = await buildInePdf(
      { blob: tinyJpegBlob(), width: 2400, height: 1500 },
      { blob: tinyJpegBlob(), width: 2400, height: 1500 }
    )
    const document = await PDFDocument.load(bytes, { updateMetadata: false })
    expect(document.getPageCount()).toBe(1)
  })

  // 10. No se afecta Documento normal
  it("10. la generación de Documento normal (pdf-builder.ts) permanece intacta", async () => {
    const docBytes = await buildMultipagePdf(
      [
        { blob: tinyJpegBlob(), width: 800, height: 1100 },
        { blob: tinyJpegBlob(), width: 800, height: 1100 },
      ],
      { pageSize: "letter" }
    )
    const doc = await PDFDocument.load(docBytes, { updateMetadata: false })
    expect(doc.getPageCount()).toBe(2)
    const p1 = doc.getPage(0).getSize()
    expect(p1.width).toBe(612)
    expect(p1.height).toBe(792)
  })
})

describe("ine-pdf-builder: función auxiliar computeFitRectWithinPhysicalCard", () => {
  it("contiene exactamente imágenes con proporción estándar dentro de la caja física", () => {
    const fit = computeFitRectWithinPhysicalCard(
      { width: 8560, height: 5398 },
      { width: INE_PHYSICAL_WIDTH_PT, height: INE_PHYSICAL_HEIGHT_PT }
    )
    expect(fit.width).toBeCloseTo(INE_PHYSICAL_WIDTH_PT, 2)
    expect(fit.height).toBeCloseTo(INE_PHYSICAL_HEIGHT_PT, 2)
    expect(fit.offsetX).toBeCloseTo(0, 2)
    expect(fit.offsetY).toBeCloseTo(0, 2)
  })

  it("si la imagen es más alta, acota la altura a 153.01 pt y centra horizontalmente", () => {
    const fit = computeFitRectWithinPhysicalCard(
      { width: 1000, height: 1000 },
      { width: 242.65, height: 153.01 }
    )
    expect(fit.height).toBeCloseTo(153.01, 2)
    expect(fit.width).toBeCloseTo(153.01, 2)
    expect(fit.offsetY).toBe(0)
    expect(fit.offsetX).toBeCloseTo((242.65 - 153.01) / 2, 2)
  })

  it("tolera dimensiones inválidas o nulas sin NaN ni caídas", () => {
    const fit = computeFitRectWithinPhysicalCard({ width: 0, height: 0 })
    expect(Number.isFinite(fit.width)).toBe(true)
    expect(Number.isFinite(fit.height)).toBe(true)
    expect(Number.isFinite(fit.offsetX)).toBe(true)
    expect(Number.isFinite(fit.offsetY)).toBe(true)
  })
})

describe("ine-pdf-builder: privacidad", () => {
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
