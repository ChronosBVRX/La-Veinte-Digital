import { describe, it, expect, vi } from "vitest"
import {
  normalizeForSearch,
  createSearchSnippet,
  itemToMatchRect,
  searchInPageData,
  searchAllPages,
  type PageSearchData,
  type PageTextItem,
} from "../pdf-search"
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"

describe("pdf-search", () => {
  describe("normalizeForSearch", () => {
    it("elimina tildes, mayúsculas y diacríticos comunes en español", () => {
      expect(normalizeForSearch("Cláusula 89")).toBe("clausula 89")
      expect(normalizeForSearch("VACACIONES Y PRIMA")).toBe("vacaciones y prima")
      expect(normalizeForSearch("Antigüedad laboral")).toBe("antiguedad laboral")
      expect(normalizeForSearch("Cesantía en edad avanzada")).toBe("cesantia en edad avanzada")
      expect(normalizeForSearch("   Espacios    múltiples   ")).toBe("espacios multiples")
    })

    it("maneja cadenas vacías o nulas", () => {
      expect(normalizeForSearch("")).toBe("")
    })
  })

  describe("createSearchSnippet", () => {
    it("crea un extracto con elipsis cuando hay texto previo y posterior", () => {
      const text = "El Instituto Mexicano del Seguro Social otorgará a los trabajadores el derecho a las vacaciones conforme al contrato colectivo vigente."
      const query = "vacaciones"
      const matchPos = text.indexOf(query)
      const snippet = createSearchSnippet(text, matchPos, query.length, 25)

      expect(snippet).toContain("vacaciones")
      expect(snippet.startsWith("...")).toBe(true)
      expect(snippet.endsWith("...")).toBe(true)
    })

    it("no añade elipsis si el texto está al inicio o final", () => {
      const text = "Vacaciones anuales pagadas"
      const snippet = createSearchSnippet(text, 0, 10, 50)
      expect(snippet.startsWith("...")).toBe(false)
      expect(snippet.endsWith("...")).toBe(false)
    })
  })

  describe("itemToMatchRect", () => {
    it("convierte coordenadas del PDF (origen abajo-izq) a porcentajes de canvas (origen arriba-izq)", () => {
      const item: PageTextItem = {
        str: "Cláusula 89",
        normalizedStr: "clausula 89",
        transform: [1, 0, 0, 1, 50, 700], // tx=50, ty=700 en una página de 600x800
        width: 120,
        height: 20,
      }
      const pageWidth = 600
      const pageHeight = 800

      const rect = itemToMatchRect(item, pageWidth, pageHeight)

      // vx = 50 -> (50 / 600) * 100 = 8.333%
      expect(rect.xPercent).toBeCloseTo(8.33, 1)
      // vy = 800 - (700 + 20) = 80 -> (80 / 800) * 100 = 10%
      expect(rect.yPercent).toBeCloseTo(10.0, 1)
      // width = 120 -> 20%
      expect(rect.widthPercent).toBeCloseTo(20.0, 1)
      // height = 20 -> 2.5%
      expect(rect.heightPercent).toBeCloseTo(2.5, 1)
    })
  })

  describe("searchInPageData", () => {
    const mockPageData: PageSearchData = {
      pageNumber: 3,
      pageWidth: 600,
      pageHeight: 800,
      fullText: "Cláusula 89. Vacaciones para los trabajadores de base.",
      normalizedText: "clausula 89. vacaciones para los trabajadores de base.",
      items: [
        {
          str: "Cláusula 89. ",
          normalizedStr: "clausula 89. ",
          transform: [1, 0, 0, 1, 50, 700],
          width: 80,
          height: 14,
        },
        {
          str: "Vacaciones ",
          normalizedStr: "vacaciones ",
          transform: [1, 0, 0, 1, 135, 700],
          width: 70,
          height: 14,
        },
        {
          str: "para los trabajadores",
          normalizedStr: "para los trabajadores",
          transform: [1, 0, 0, 1, 210, 700],
          width: 140,
          height: 14,
        },
      ],
    }

    it("encuentra coincidencias dentro de un ítem individual sin importar acentos", () => {
      const matches = searchInPageData(mockPageData, "clausula", 0)
      expect(matches).toHaveLength(1)
      expect(matches[0].pageNumber).toBe(3)
      expect(matches[0].matchIndex).toBe(0)
      expect(matches[0].snippet).toContain("Cláusula")
      expect(matches[0].rects).toHaveLength(1)
    })

    it("encuentra coincidencias que cruzan ítems contiguos", () => {
      const matches = searchInPageData(mockPageData, "89. vacaciones", 0)
      expect(matches).toHaveLength(1)
      expect(matches[0].snippet).toContain("89. Vacaciones")
      expect(matches[0].rects.length).toBeGreaterThanOrEqual(1)
    })

    it("retorna arreglo vacío si la búsqueda es menor a 2 caracteres", () => {
      expect(searchInPageData(mockPageData, "a", 0)).toHaveLength(0)
      expect(searchInPageData(mockPageData, "", 0)).toHaveLength(0)
    })
  })

  describe("searchAllPages", () => {
    it("escanea páginas usando caché y soporta cancelación anticipada", async () => {
      const mockPage1 = {
        pageNumber: 1,
        getViewport: () => ({ width: 600, height: 800 }),
        getTextContent: async () => ({
          items: [{ str: "Estatutos SNTSS 2022", transform: [1,0,0,1,50,700], width: 100, height: 12 }],
        }),
      } as unknown as PDFPageProxy

      const mockPage2 = {
        pageNumber: 2,
        getViewport: () => ({ width: 600, height: 800 }),
        getTextContent: async () => ({
          items: [{ str: "Capítulo de Vacaciones", transform: [1,0,0,1,50,650], width: 120, height: 12 }],
        }),
      } as unknown as PDFPageProxy

      const mockPdf = {
        numPages: 2,
        getPage: vi.fn(async (num: number) => (num === 1 ? mockPage1 : mockPage2)),
      } as unknown as PDFDocumentProxy

      const cache = new Map<number, PageSearchData>()
      const result = await searchAllPages(mockPdf, "vacaciones", cache)

      expect(result.matches).toHaveLength(1)
      expect(result.matches[0].pageNumber).toBe(2)
      expect(result.cache.size).toBe(2)

      // Búsqueda subsecuente usa la caché sin invocar getPage de nuevo
      mockPdf.getPage = vi.fn()
      const cachedResult = await searchAllPages(mockPdf, "estatutos", result.cache)
      expect(cachedResult.matches).toHaveLength(1)
      expect(cachedResult.matches[0].pageNumber).toBe(1)
      expect(mockPdf.getPage).not.toHaveBeenCalled()
    })
  })
})
