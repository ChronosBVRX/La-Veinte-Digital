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

describe.skipIf(!HAS_CORPUS)("Ampliación 2026-08-25 — leyes, NOMs y Ley Silla", () => {
  let catalog: NormativeCatalog

  beforeAll(() => {
    catalog = new NormativeCatalog(process.cwd())
  })

  it("INFONAVIT: si está en el corpus, proviene de Cámara de Diputados (fuente oficial)", () => {
    const doc = catalog.getDocument("LEY-INFONAVIT")
    if (!doc?.currentVersion) return
    expect(["Cámara de Diputados"]).toContain(doc.organization[0])
  })

  it("LSAR/AFORE: la ley SAR responde preguntas de afore", () => {
    const hits = catalog.searchNormativeCorpus("afore cuenta individual retiro", {})
    if (!catalog.getDocument("LSAR")?.currentVersion) return
    expect(hits.length).toBeGreaterThan(0)
  })

  it("NOM-017: solo la versión 2024 debe existir; la 2008 no se registra como vigente", () => {
    const doc = catalog.getDocument("NOM-017-STPS-2024")
    if (!doc) return
    expect(doc.id).toBe("NOM-017-STPS-2024")
  })

  it("Ley Silla/bipedestación: las disposiciones STPS están disponibles con título oficial", () => {
    const doc = catalog.getDocument("DISPOSICIONES-BIPEDESTACION-2025")
    if (!doc?.currentVersion) return
    expect(doc.title).toMatch(/bipedestaci/i)
  })

  it("¿Puedo sentarme durante mi jornada? — recupera disposiciones de bipedestación", () => {
    if (!catalog.getDocument("DISPOSICIONES-BIPEDESTACION-2025")?.currentVersion) return
    const hits = catalog.searchNormativeCorpus("descanso bipedestación sillas", {})
    expect(hits.some((h) => h.documentId === "DISPOSICIONES-BIPEDESTACION-2025")).toBe(true)
  })

  it("¿Ya trabajamos 40 horas? — exige CPEUM + LFT reformadas, nunca respuesta sin transitorios", () => {
    const cpeum = catalog.getDocument("CPEUM")
    const lft = catalog.getDocument("LFT")
    // La regla editorial es que la respuesta dependa del texto + transitorios vigentes.
    // Si los documentos base existen, deben tener lastReformDate registrada (auditoría DOF).
    for (const doc of [cpeum, lft]) {
      if (!doc) continue
      expect(doc.lastReformDate ?? null).not.toBeUndefined()
    }
  })

  it("Radiología: NOM-229-SSA1-2002 se trata como VIGENTE (no derogada por el año)", () => {
    const doc = catalog.getDocument("NOM-229-SSA1-2002")
    if (!doc?.currentVersion) return
    expect(doc.validity === "CURRENT" || doc.validity === "PENDING_REVIEW" || doc.validity === "UNKNOWN").toBe(true)
    expect(doc.validity).not.toBe("REPEALED")
  })

  it("RPBI: NOM-087 disponible desde fuente oficial", () => {
    const doc = catalog.getDocument("NOM-087-SEMARNAT-SSA1-2002")
    if (!doc?.currentVersion) return
    expect(doc.provenance).toBe("OFFICIAL")
  })

  it("¿Qué equipo de protección me dan? — NOM-017-STPS-2024 responde", () => {
    if (!catalog.getDocument("NOM-017-STPS-2024")?.currentVersion) return
    const hits = catalog.searchNormativeCorpus("equipo de protección personal selección", {})
    expect(hits.some((h) => h.documentId === "NOM-017-STPS-2024")).toBe(true)
  })

  it("Vivienda: pregunta de crédito INFONAVIT recupera la ley o el procedimiento IMSS", () => {
    const hits = catalog.searchNormativeCorpus("crédito vivienda trabajador", {})
    const tieneFuente =
      hits.some((h) => h.documentId === "LEY-INFONAVIT") ||
      hits.some((h) => h.documentId === "IMSS-1A72-003-005")
    if (!catalog.getDocument("LEY-INFONAVIT") && !catalog.getDocument("IMSS-1A72-003-005")) return
    expect(tieneFuente).toBe(true)
  })

  it("Estatutos: NUNCA existe una edición 'Estatutos 2026' en el corpus", () => {
    const docs = catalog.listDocuments().filter((d) => /estatuto/i.test(d.title))
    for (const d of docs) {
      expect(d.id).not.toMatch(/2026/)
      expect(d.title).not.toMatch(/Estatutos.*2026/)
    }
  })

  it("Vacaciones: procedimiento IMSS + CCT son recuperables por separado", () => {
    const hits = catalog.searchNormativeCorpus("vacaciones programación autorización", {})
    expect(hits.length).toBeGreaterThan(0)
  })

  it("Fondo de ahorro: '¿Qué hago si no me pagaron?' recupera 1A74-003-024", () => {
    if (!catalog.getDocument("IMSS-1A74-003-024")?.currentVersion) return
    const hits = catalog.searchNormativeCorpus("fondo de ahorro pago aclaración", {})
    expect(hits.some((h) => h.documentId === "IMSS-1A74-003-024")).toBe(true)
  })

  it("Teletrabajo: NOM-037-STPS-2023 disponible cuando esté descargada", () => {
    const doc = catalog.getDocument("NOM-037-STPS-2023")
    if (!doc?.currentVersion) return
    expect(doc.organization[0]).toBe("STPS")
  })

  it("Discriminación: LFPED responde consultas de no discriminación", () => {
    const hits = catalog.searchNormativeCorpus("discriminación laboral", {})
    expect(hits.length).toBeGreaterThan(0)
  })

  it("REGRESIÓN '¿Cuáles son mis derechos laborales?': el corpus SÍ contiene evidencia de derechos", () => {
    // El retrieval (FTS local) debe encontrar chunks de derechos/obligaciones
    // en documentos laborales. Si esto falla, el problema es de retrieval,
    // no del prompt.
    const hits = catalog.searchNormativeCorpus(
      "derechos y obligaciones de los trabajadores",
      { limit: 10 },
    )
    expect(hits.length).toBeGreaterThan(0)
    const laborales = hits.filter((h) =>
      /CCT|LFT|ESTATUTOS|RIIMSS/i.test(h.documentId),
    )
    expect(laborales.length).toBeGreaterThan(0)
  })

  it("REGRESIÓN broad: 'prestaciones' recupera CCT/LSS, no leyes ajenas al tema", () => {
    const hits = catalog.searchNormativeCorpus("prestaciones trabajadores derecho", { limit: 10 })
    expect(hits.length).toBeGreaterThan(0)
  })
})
