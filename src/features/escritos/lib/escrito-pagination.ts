/**
 * Utilidades puras de paginación de escritos institucionales para vista previa Carta y PDF.
 * Divide el cuerpo en hojas respetando límites visuales, encabezados y firmas.
 * La Veinte Digital
 */

export interface PreviewSheetData {
  sheetNumber: number
  isFirst: boolean
  isLastText: boolean
  paragraphs: string[]
}

/**
 * Divide el texto del cuerpo en páginas estimadas según la capacidad de hoja Carta.
 * Hoja 1: ~1,500 caracteres (descuenta espacio de fecha, asunto y destinatario).
 * Hojas 2+: ~2,200 caracteres (con encabezado de continuidad).
 */
export function paginateEscritoForPreview(cuerpo: string): PreviewSheetData[] {
  const trimmed = cuerpo.trim()
  if (!trimmed) {
    return [
      {
        sheetNumber: 1,
        isFirst: true,
        isLastText: true,
        paragraphs: [""],
      },
    ]
  }

  const rawParagraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  // Desglosar párrafos gigantes si alguno excede 1800 caracteres por sí solo
  const paragraphs: string[] = []
  for (const para of rawParagraphs) {
    if (para.length <= 1800) {
      paragraphs.push(para)
    } else {
      // Dividir por oraciones respetando puntos
      const sentences = para.split(/(?<=[.!?])\s+/)
      let currentChunk = ""
      for (const sent of sentences) {
        if ((currentChunk + " " + sent).trim().length > 1400) {
          if (currentChunk.trim()) paragraphs.push(currentChunk.trim())
          currentChunk = sent
        } else {
          currentChunk = currentChunk ? `${currentChunk} ${sent}` : sent
        }
      }
      if (currentChunk.trim()) paragraphs.push(currentChunk.trim())
    }
  }

  // Si todo cabe holgadamente en la primera hoja (junto con el bloque de firmas ~1500 chars)
  const totalChars = paragraphs.reduce((acc, p) => acc + p.length, 0)
  if (totalChars <= 1500 && paragraphs.length <= 4) {
    return [
      {
        sheetNumber: 1,
        isFirst: true,
        isLastText: true,
        paragraphs,
      },
    ]
  }

  const sheets: PreviewSheetData[] = []
  let currentSheetParas: string[] = []
  let currentSheetLen = 0
  let isFirst = true

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    const limit = isFirst ? 1400 : 2100

    if (currentSheetLen + p.length > limit && currentSheetParas.length > 0) {
      sheets.push({
        sheetNumber: sheets.length + 1,
        isFirst,
        isLastText: false,
        paragraphs: currentSheetParas,
      })
      isFirst = false
      currentSheetParas = [p]
      currentSheetLen = p.length
    } else {
      currentSheetParas.push(p)
      currentSheetLen += p.length
    }
  }

  if (currentSheetParas.length > 0) {
    sheets.push({
      sheetNumber: sheets.length + 1,
      isFirst,
      isLastText: true,
      paragraphs: currentSheetParas,
    })
  }

  if (sheets.length > 0) {
    sheets[sheets.length - 1].isLastText = true
  }

  return sheets
}
