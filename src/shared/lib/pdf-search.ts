/**
 * Utilidades de búsqueda y normalización de texto para el visor de PDFs y documentos normativos.
 * Diseñado para contratos colectivos, leyes y reglamentos en español.
 */
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"

export interface SearchMatchRect {
  /** Porcentaje X (0-100) respecto al ancho de la página/canvas */
  xPercent: number
  /** Porcentaje Y (0-100) respecto al alto de la página/canvas */
  yPercent: number
  /** Porcentaje de ancho (0-100) */
  widthPercent: number
  /** Porcentaje de alto (0-100) */
  heightPercent: number
}

export interface SearchMatch {
  /** Índice global de la coincidencia (0-indexed) */
  matchIndex: number
  /** Número de página (1-indexed) */
  pageNumber: number
  /** Extracto con contexto para previsualización */
  snippet: string
  /** Rectángulos de resaltado en la página */
  rects: SearchMatchRect[]
}

export interface PageTextItem {
  str: string
  normalizedStr: string
  transform: number[]
  width: number
  height: number
}

export interface PageSearchData {
  pageNumber: number
  items: PageTextItem[]
  fullText: string
  normalizedText: string
  pageWidth: number
  pageHeight: number
}

/**
 * Normaliza una cadena para búsqueda insensible a acentos, mayúsculas y espacios múltiples.
 * Ej: "Cláusula 89" -> "clausula 89"
 */
export function normalizeForSearch(str: string): string {
  if (!str) return ""
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve tildes y diacríticos (á->a, é->e, etc.)
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Extrae texto y coordenadas espaciales de una página PDF dada.
 */
export async function extractPageSearchData(page: PDFPageProxy): Promise<PageSearchData> {
  const viewport = page.getViewport({ scale: 1.0 })
  const textContent = await page.getTextContent()

  const items: PageTextItem[] = []
  for (const rawItem of textContent.items) {
    if (!("str" in rawItem)) continue
    const str = rawItem.str
    if (!str || !str.trim()) continue

    items.push({
      str,
      normalizedStr: normalizeForSearch(str),
      transform: rawItem.transform as number[],
      width: rawItem.width,
      height: rawItem.height,
    })
  }

  const fullText = items.map((it) => it.str).join(" ")
  const normalizedText = normalizeForSearch(fullText)

  return {
    pageNumber: page.pageNumber,
    items,
    fullText,
    normalizedText,
    pageWidth: viewport.width,
    pageHeight: viewport.height,
  }
}

/**
 * Genera un snippet contextual alrededor de la coincidencia encontrada.
 */
export function createSearchSnippet(fullText: string, charIndex: number, matchLength: number, contextLen = 45): string {
  if (!fullText) return ""
  const start = Math.max(0, charIndex - contextLen)
  const end = Math.min(fullText.length, charIndex + matchLength + contextLen)
  
  let snippet = fullText.slice(start, end).replace(/\s+/g, " ").trim()
  if (start > 0) snippet = "..." + snippet
  if (end < fullText.length) snippet = snippet + "..."
  return snippet
}

/**
 * Convierte las coordenadas del PDF de un ítem de texto a porcentajes de viewport (0-100%).
 * En PDF el origen (0,0) está abajo-izquierda; en canvas está arriba-izquierda.
 */
export function itemToMatchRect(item: PageTextItem, pageWidth: number, pageHeight: number): SearchMatchRect {
  const [, , , , tx, ty] = item.transform
  const height = item.height > 0 ? item.height : 12
  const width = item.width > 0 ? item.width : 20

  // Coordenadas superiores en viewport
  const vx = tx
  const vy = pageHeight - (ty + height)

  return {
    xPercent: Math.max(0, Math.min(100, (vx / pageWidth) * 100)),
    yPercent: Math.max(0, Math.min(100, (vy / pageHeight) * 100)),
    widthPercent: Math.max(0.5, Math.min(100, (width / pageWidth) * 100)),
    heightPercent: Math.max(0.5, Math.min(100, (height / pageHeight) * 100)),
  }
}

/**
 * Busca ocurrencias en una página individual a partir de sus datos indexados.
 */
export function searchInPageData(
  pageData: PageSearchData,
  query: string,
  startMatchIndex: number
): SearchMatch[] {
  const normQuery = normalizeForSearch(query)
  if (!normQuery || normQuery.length < 2) return []

  const matches: SearchMatch[] = []
  let currentMatchIdx = startMatchIndex

  // Búsqueda a nivel de ítems individuales
  for (const item of pageData.items) {
    if (item.normalizedStr.includes(normQuery)) {
      const rect = itemToMatchRect(item, pageData.pageWidth, pageData.pageHeight)
      const snippet = createSearchSnippet(item.str, 0, item.str.length, 30)

      matches.push({
        matchIndex: currentMatchIdx++,
        pageNumber: pageData.pageNumber,
        snippet: snippet || item.str,
        rects: [rect],
      })
    }
  }

  // Si la búsqueda tiene varias palabras y cruza límites de ítems contiguos,
  // buscar en el texto completo consolidado de la página si no se halló en ítems sueltos
  if (matches.length === 0 && pageData.normalizedText.includes(normQuery)) {
    let searchStart = 0
    let matchPos = pageData.normalizedText.indexOf(normQuery, searchStart)

    while (matchPos !== -1) {
      const snippet = createSearchSnippet(pageData.fullText, matchPos, normQuery.length, 45)

      // Identificar ítems que se solapan con la posición del texto
      let runningLen = 0
      const matchedRects: SearchMatchRect[] = []

      for (const item of pageData.items) {
        const itemLen = item.str.length + 1 // +1 por el espacio
        const itemEnd = runningLen + itemLen
        if (itemEnd > matchPos && runningLen < matchPos + normQuery.length) {
          matchedRects.push(itemToMatchRect(item, pageData.pageWidth, pageData.pageHeight))
        }
        runningLen = itemEnd
      }

      matches.push({
        matchIndex: currentMatchIdx++,
        pageNumber: pageData.pageNumber,
        snippet,
        rects: matchedRects,
      })

      searchStart = matchPos + normQuery.length
      matchPos = pageData.normalizedText.indexOf(normQuery, searchStart)
    }
  }

  return matches
}

/**
 * Escanea de forma progresiva las páginas del PDF.
 * Permite cancelar la búsqueda si el usuario cambia el término o cierra el panel.
 */
export async function searchAllPages(
  pdf: PDFDocumentProxy,
  query: string,
  cache: Map<number, PageSearchData>,
  onProgress?: (scanned: number, total: number, found: number) => void,
  isCancelled?: () => boolean
): Promise<{ matches: SearchMatch[]; cache: Map<number, PageSearchData> }> {
  const normQuery = normalizeForSearch(query)
  if (!normQuery || normQuery.length < 2) {
    return { matches: [], cache }
  }

  const matches: SearchMatch[] = []
  const numPages = pdf.numPages

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (isCancelled?.()) {
      break
    }

    let pageData = cache.get(pageNum)
    if (!pageData) {
      const page = await pdf.getPage(pageNum)
      pageData = await extractPageSearchData(page)
      cache.set(pageNum, pageData)
    }

    const pageMatches = searchInPageData(pageData, normQuery, matches.length)
    matches.push(...pageMatches)

    onProgress?.(pageNum, numPages, matches.length)

    // Ceder el hilo de ejecución brevemente cada 5 páginas para mantener la UI suave
    if (pageNum % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  return { matches, cache }
}
