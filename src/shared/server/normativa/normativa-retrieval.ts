/**
 * Servicio compartido de recuperación de fuentes normativas en servidor.
 * Consulta el catálogo local (catalog.sqlite) o retorna lista vacía de forma segura.
 * La Veinte Digital
 */

import path from "node:path"
import fs from "node:fs"
import { NormativeDB } from "@/features/normativa/services/db"

export interface RetrievedNormativaSource {
  id: string
  chunkId: string
  documentId: string
  documento: string
  version: string
  tipo: string | null
  numero: string | null
  paginaInicio: number | null
  paginaFin: number | null
  fragmento: string
  sourceUrl: string | null
  validity: string
  score: number
}

export interface ExactNormativaRefs {
  clause?: string
  article?: string
  key?: string
}

export function extractExactNormativaRefs(text: string): ExactNormativaRefs {
  const refs: ExactNormativaRefs = {}
  const clause = text.match(/cl[áa]usula\s+(\d+\s*(?:bis|ter|quater)?)/i)
  if (clause) refs.clause = clause[1].replace(/\s+/g, " ").trim()

  const article = text.match(/art[íi]culo\s+("?\d+(?:\s*(?:bis|ter))?"?)/i)
  if (article) refs.article = article[1].replace(/"/g, "").trim()

  const homoclave = text.match(/\b\d[AB]\d{2}-\d{3}-\d{3}\b/i)
  if (homoclave) refs.key = homoclave[0]

  if (!refs.key) {
    const nom = text.match(/\bNOM[-\s]?\d{3}(?:[-\s]?[A-Z0-9]+)*\b/i)
    if (nom) {
      refs.key = nom[0].toUpperCase().replace(/\s+/g, "-")
    }
  }

  return refs
}

/**
 * Recupera fuentes normativas verificadas desde catalog.sqlite.
 */
export async function retrieveNormativaSources(
  query: string,
  limit = 5
): Promise<RetrievedNormativaSource[]> {
  try {
    const catalogPath = path.resolve(process.cwd(), "data", "normativa", "catalog.sqlite")
    if (!fs.existsSync(catalogPath)) {
      return []
    }

    const db = new NormativeDB(catalogPath)
    const hits = db.search(query, { limit, mode: "or" })

    return hits.map((h) => {
      const parsedPrinted = h.printedPage ? parseInt(h.printedPage, 10) : null
      const pageNum = !isNaN(Number(parsedPrinted)) && parsedPrinted !== null ? parsedPrinted : h.pdfPageIndex ?? null

      return {
        id: h.chunkId,
        chunkId: h.chunkId,
        documentId: h.documentId,
        documento: h.documentTitle,
        version: h.versionId,
        tipo: h.section,
        numero: h.clause ? `Cláusula ${h.clause}` : h.article ? `Artículo ${h.article}` : null,
        paginaInicio: pageNum,
        paginaFin: pageNum,
        fragmento: h.text,
        sourceUrl: null,
        validity: h.validity,
        score: 100,
      }
    })
  } catch (err) {
    console.warn("[normativa-retrieval] Catálogo normativo no disponible:", err)
    return []
  }
}
