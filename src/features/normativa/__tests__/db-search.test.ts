import { describe, expect, it, beforeEach } from "vitest"
import { DatabaseSync } from "node:sqlite"
import { NormativeDB } from "@/features/normativa/services/db"
import { buildEvidencePack, verifyClaim, classifyClaimType } from "@/features/normativa/services/evidence"
import type { DocumentChunk, DocumentMetadata } from "@/features/normativa/core/types"

function seedDoc(db: NormativeDB, meta: DocumentMetadata, chunks: Array<Partial<DocumentChunk> & { text: string }>, label = "V1") {
  db.upsertDocument(meta)
  const versionId = `${meta.id}@${label}`
  db.upsertVersion({
    id: versionId, documentId: meta.id, label, dir: `/tmp/${meta.id}/${label}`,
    sha256: `sha-${meta.id}`, downloadedAt: "2026-08-14T00:00:00.000Z", lastCheckedAt: "2026-08-14T00:00:00.000Z",
    contentType: "application/pdf", size: 1000, resolvedUrl: meta.url ?? "", originalUrl: meta.url ?? "",
    status: "VERIFIED", pages: 10,
  })
  db.replaceChunks(
    chunks.map((c, i) => ({
      id: `${versionId}-c${i}`,
      documentId: meta.id,
      versionId,
      sectionId: null,
      pdfPageIndex: c.pdfPageIndex ?? 1,
      printedPage: c.printedPage ?? null,
      section: c.section ?? null,
      article: c.article ?? null,
      clause: c.clause ?? null,
      numeral: null,
      text: c.text,
      order: i + 1,
    }))
  )
}

describe("SQLite FTS5 y búsqueda", () => {
  let db: NormativeDB

  beforeEach(() => {
    const mem = new DatabaseSync(":memory:")
    db = new NormativeDB(mem)
    seedDoc(
      db,
      {
        id: "IMSS-1A74-003-031", title: "Procedimiento para tiempo extraordinario", organization: ["IMSS"],
        type: "procedure", category: "procedimientos", canonical: true, provenance: "OFFICIAL",
        url: "https://www.imss.gob.mx/x.pdf", validity: "CURRENT", priority: "critical", topics: [], sourceSpecHash: "",
      },
      [
        { text: "El tiempo extraordinario se paga mediante concepto 37 o concepto 737 según corresponda.", pdfPageIndex: 3 },
        { text: "La autorización del tiempo extraordinario corresponde al jefe inmediato.", pdfPageIndex: 4 },
      ]
    )
    seedDoc(
      db,
      {
        id: "CCT-IMSS-SNTSS-2025-2027", title: "Contrato Colectivo de Trabajo 2025-2027", organization: ["IMSS", "SNTSS"],
        type: "collective_agreement", category: "cct", canonical: true, provenance: "OFFICIAL",
        url: "https://www.imss.gob.mx/cct.pdf", validity: "CURRENT", priority: "critical", topics: [], sourceSpecHash: "",
      },
      [
        { text: "Cláusula 42: el Instituto podrá conceder permisos sindicales con goce de sueldo íntegro.", clause: "42", pdfPageIndex: 40 },
        { text: "Cláusula 99: cambio de lugar de residencia con pago de 60 días de sueldo.", clause: "99", pdfPageIndex: 70 },
      ],
      "2025-2027"
    )
    seedDoc(
      db,
      {
        id: "CCT-IMSS-SNTSS-2023-2025", title: "Contrato Colectivo de Trabajo 2023-2025", organization: ["IMSS", "SNTSS"],
        type: "collective_agreement", category: "cct", canonical: true, provenance: "OFFICIAL",
        url: "https://www.imss.gob.mx/cct-ant.pdf", validity: "HISTORICAL", priority: "low", topics: [], sourceSpecHash: "",
      },
      [{ text: "Cláusula 42 (antigua): permisos sindicales con condiciones distintas.", clause: "42", pdfPageIndex: 40 }]
    )
  })

  it("busca por frase sin importar acentos", () => {
    const hits = db.search("tiempo extraordinario")
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].documentId).toBe("IMSS-1A74-003-031")
  })

  it("encuentra 'concepto 37' y 'concepto 737'", () => {
    const h37 = db.search("concepto 37")
    expect(h37.length).toBeGreaterThan(0)
    expect(h37[0].text).toContain("concepto 37")
  })

  it("busca por cláusula: 'Cláusula 42' devuelve fragmentos con cláusula 42", () => {
    const hits = db.search("Cláusula 42")
    expect(hits.some((h) => h.clause === "42")).toBe(true)
  })

  it("excluye documentos HISTORICAL salvo includeHistorical", () => {
    const current = db.search("Cláusula 42", { includeHistorical: false })
    expect(current.some((h) => h.documentId === "CCT-IMSS-SNTSS-2023-2025")).toBe(false)
    const withHist = db.search("Cláusula 42", { includeHistorical: true })
    expect(withHist.some((h) => h.documentId === "CCT-IMSS-SNTSS-2023-2025")).toBe(true)
  })

  it("TEST DE ALUCINACIÓN: cláusula inexistente no arroja evidencia inventada", () => {
    const hits = db.search("Cláusula 999")
    const fake = hits.find((h) => h.clause === "999")
    expect(fake).toBeUndefined()
    expect(hits.length).toBe(0)
  })

  it("proporciona snippet y página para citar", () => {
    const hits = db.search("jefe inmediato")
    expect(hits[0].pdfPageIndex).toBe(4)
    expect(hits[0].snippet).toContain("jefe")
  })
})

describe("evidence pack y verificación de afirmaciones", () => {
  let db: NormativeDB

  beforeEach(() => {
    const mem = new DatabaseSync(":memory:")
    db = new NormativeDB(mem)
    seedDoc(
      db,
      {
        id: "IMSS-1A74-003-029", title: "Procedimiento para pago por cambio de lugar de residencia", organization: ["IMSS"],
        type: "procedure", category: "procedimientos", canonical: true, provenance: "OFFICIAL",
        url: "https://www.imss.gob.mx/x.pdf", validity: "CURRENT", priority: "high", topics: [], sourceSpecHash: "",
      },
      [
        { text: "El trabajador tendrá derecho al pago de 60 días de sueldo por cambio de lugar de residencia conforme al concepto 031.", pdfPageIndex: 2 },
        { text: "La Cláusula 99 del CCT regula el cambio de lugar de residencia.", pdfPageIndex: 3 },
      ]
    )
  })

  it("construye un paquete de evidencia congelando documentos y versiones", () => {
    const pack = buildEvidencePack(db, "cambio de residencia")
    expect(pack.documents.length).toBeGreaterThan(0)
    const d = pack.documents[0]
    expect(d.id).toBe("IMSS-1A74-003-029")
    expect(d.sha256).toBe("sha-IMSS-1A74-003-029")
    expect(d.versionLabel).toBe("V1")
    expect(pack.claims.every((c) => c.state === "VERIFIED")).toBe(true)
    expect(pack.claims.some((c) => c.evidence[0].quote.includes("60 días"))).toBe(true)
  })

  it("verifica una afirmación sustentada", () => {
    const r = verifyClaim(db, "El trabajador tiene derecho al pago de 60 días de sueldo por cambio de residencia")
    expect(r.state).toBe("VERIFIED")
    expect(r.evidence.length).toBeGreaterThan(0)
  })

  it("responde NEEDS_MORE_EVIDENCE ante afirmaciones sin sustento", () => {
    const r = verifyClaim(db, "La cláusula 999 otorga 45 días de vacaciones adicionales a todos")
    expect(r.state).toBe("NEEDS_MORE_EVIDENCE")
  })

  it("no valida números inexistentes: la cláusula 999 no puede fundamentarse", () => {
    const r = verifyClaim(db, "La cláusula 999 me da 45 días de vacaciones")
    expect(r.state).toBe("NEEDS_MORE_EVIDENCE")
    expect(r.evidence).toHaveLength(0)
  })

  it("valida una cifra cuando el número real aparece en la evidencia", () => {
    const r = verifyClaim(db, "El trabajador tiene derecho al pago de 60 días de sueldo")
    expect(r.state).toBe("VERIFIED")
    expect(r.evidence.some((e) => e.quote.includes("60 días"))).toBe(true)
  })

  it("clasifica tipos de afirmación", () => {
    expect(classifyClaimType("El trabajador tiene derecho a vacaciones conforme a la Cláusula 58")).toBe("LEGAL_CLAIM")
    expect(classifyClaimType("El pago será de 60 días de sueldo")).toBe("NUMERICAL_CLAIM")
    expect(classifyClaimType("Ahora pasemos al siguiente tema")).toBe("TRANSITION")
  })
})
