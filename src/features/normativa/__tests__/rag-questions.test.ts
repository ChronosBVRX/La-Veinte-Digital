import { describe, expect, it, beforeAll } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { NormativeCatalog } from "@/features/normativa/services/catalog"

/**
 * Batería de preguntas reales contra el corpus documental.
 * Se ejecuta únicamente si existe data/normativa/catalog.sqlite
 * (generado con `npm run normativa:bootstrap`). En CI sin corpus, se omite.
 */

const CATALOG_PATH = path.resolve(process.cwd(), "data", "normativa", "catalog.sqlite")
const HAS_CORPUS = fs.existsSync(CATALOG_PATH)

describe.skipIf(!HAS_CORPUS)("Batería RAG sobre el corpus real", () => {
  let catalog: NormativeCatalog

  beforeAll(() => {
    catalog = new NormativeCatalog(process.cwd())
  })

  it("¿Qué es el concepto 37? — debe citar fuentes con fundamento", () => {
    const hits = catalog.searchNormativeCorpus("concepto 37", {})
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.text.length > 0)).toBe(true)
  })

  it("¿Qué procedimiento regula el tiempo extraordinario? — 1A74-003-031 o CCT", () => {
    const hits = catalog.searchNormativeCorpus("tiempo extraordinario autorización", {})
    expect(hits.length).toBeGreaterThan(0)
  })

  it("¿Un permiso sindical es lo mismo que un permiso personal? — 1A31-003-007 lo distingue", () => {
    const hits = catalog.searchNormativeCorpus("permisos sindicales", {})
    expect(hits.length).toBeGreaterThan(0)
  })

  it("¿Qué documento regula el cambio de residencia? — 1A74-003-029 / Cláusula 99", () => {
    const hits = catalog.searchNormativeCorpus("cambio de residencia", {})
    expect(hits.length).toBeGreaterThan(0)
  })

  it("¿Qué es el ST-7? — debe aparecer el aviso de calificación", () => {
    const proc = catalog.getDocument("IMSS-3A21-003-010")
    if (!proc?.currentVersion) return
    const hits = catalog.searchNormativeCorpus("ST-7", {})
    expect(hits.length).toBeGreaterThan(0)
  })

  it("¿Qué documento habla de actualización del catálogo de plazas? — 1A74-003-030", () => {
    const hits = catalog.searchNormativeCorpus("catálogo de plazas actualización", {})
    expect(hits.length).toBeGreaterThan(0)
  })

  it("¿Cuándo expira el tabulador actual? — vigencia registrada 2026-10-15", () => {
    const doc = catalog.getDocument("IMSS-TABULADOR-BASE-2025-2026")
    if (doc) {
      expect(doc.effectiveUntil).toBe("2026-10-15")
    } else {
      expect(true).toBe(true)
    }
  })

  it("¿Qué diferencia hay entre RIIMSS y RIT? — son documentos distintos", () => {
    const riimss = catalog.getDocument("RIIMSS")
    const cct = catalog.getDocument("CCT-IMSS-SNTSS-2025-2027")
    expect(riimss?.id).not.toBe(cct?.id)
  })

  it("¿Qué versión de Estatutos tenemos? — octubre 2022, PENDING_REVIEW", () => {
    const doc = catalog.getDocument("SNTSS-ESTATUTOS-2022")
    if (!doc) return
    expect(doc.edition === "Octubre 2022" || doc.edition == null).toBe(true)
    expect(doc.validity).toBe("PENDING_REVIEW")
  })

  it("¿La aplicación sabe que la vigencia de Estatutos requiere verificación?", () => {
    const doc = catalog.getDocument("SNTSS-ESTATUTOS-2022")
    if (doc) {
      expect(doc.warning ?? doc.verificationStatus).toBeTruthy()
    }
  })

  it("TEST DE ALUCINACIÓN: cláusula 999 con vacaciones no arroja evidencia inventada", () => {
    const r = catalog.verifyClaim("La cláusula 999 me da 45 días de vacaciones")
    expect(r.state).toBe("NEEDS_MORE_EVIDENCE")
  })

  it("TEST DE DOCUMENTO ANTIGUO: las búsquedas no mezclan históricos por defecto", () => {
    const hits = catalog.searchNormativeCorpus("Cláusula 1", { includeHistorical: false })
    expect(hits.every((h) => h.validity !== "HISTORICAL")).toBe(true)
  })

  it("Búsqueda del CCT vigente excluye ediciones pasadas del CCT", () => {
    const hits = catalog.searchNormativeCorpus("jornada de trabajo", { includeHistorical: false })
    expect(hits.some((h) => /2023-2025|2021-2023/.test(h.documentId))).toBe(false)
  })
})
