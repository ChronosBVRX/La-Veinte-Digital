import { describe, it, expect } from "vitest"
import { paginateEscritoForPreview } from "../lib/escrito-pagination"

describe("Paginación de escritos para vista previa y formato multipágina", () => {
  it("devuelve una sola hoja cuando el texto es breve", () => {
    const text = "Párrafo breve con solicitud formal de vacaciones."
    const sheets = paginateEscritoForPreview(text)

    expect(sheets).toHaveLength(1)
    expect(sheets[0].sheetNumber).toBe(1)
    expect(sheets[0].isFirst).toBe(true)
    expect(sheets[0].isLastText).toBe(true)
    expect(sheets[0].paragraphs).toEqual([text])
  })

  it("divide en múltiples hojas cuando el texto es extenso", () => {
    const p1 = "A".repeat(800)
    const p2 = "B".repeat(800)
    const p3 = "C".repeat(800)
    const p4 = "D".repeat(800)
    const longText = `${p1}\n\n${p2}\n\n${p3}\n\n${p4}`

    const sheets = paginateEscritoForPreview(longText)

    expect(sheets.length).toBeGreaterThanOrEqual(2)
    expect(sheets[0].isFirst).toBe(true)
    expect(sheets[0].isLastText).toBe(false)
    expect(sheets[sheets.length - 1].isLastText).toBe(true)
  })

  it("gestiona párrafos gigantes dividiéndolos sin perder texto", () => {
    const giant = "Oración primera con contenido. ".repeat(60) // ~1900 chars
    const sheets = paginateEscritoForPreview(giant)

    expect(sheets.length).toBeGreaterThanOrEqual(1)
    const allText = sheets.flatMap((s) => s.paragraphs).join(" ")
    expect(allText).toContain("Oración primera")
  })
})
