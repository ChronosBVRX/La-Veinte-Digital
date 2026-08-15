import { describe, expect, it, beforeEach } from "vitest"
import { DatabaseSync } from "node:sqlite"
import { NormativeDB } from "@/features/normativa/services/db"
import { classifyDownloadError, isSourceBlocked } from "@/features/normativa/services/bootstrap"
import { DownloadError } from "@/features/normativa/services/downloader"
import { buildCoverage } from "@/features/normativa/services/coverage"
import { compareDocuments } from "@/features/normativa/services/compare"
import { NormativeCatalog } from "@/features/normativa/services/catalog"
import type { SourceSpec } from "@/features/normativa/core/types"

const SPEC: SourceSpec = {
  id: "IMSS-1A74-003-031",
  title: "Procedimiento para tiempo extraordinario",
  organization: "IMSS",
  type: "procedure",
  category: "procedimientos",
  url: "https://www.imss.gob.mx/x.pdf",
  priority: "critical",
}

describe("máquina de estados por fuente", () => {
  it("clasifica WAF como WAF_BLOCK con reintento", () => {
    const r = classifyDownloadError(new DownloadError("WAF_BLOCK", "bloqueo"), SPEC, 0)
    expect(r.state).toBe("WAF_BLOCK")
    expect(r.retryAfter).not.toBeNull()
  })

  it("clasifica 403 como HTTP_403", () => {
    expect(classifyDownloadError(new DownloadError("HTTP_403", "x"), SPEC, 0).state).toBe("HTTP_403")
  })

  it("clasifica 404 como NOT_FOUND con reintento largo", () => {
    const r = classifyDownloadError(new DownloadError("NOT_FOUND", "x"), SPEC, 0)
    expect(r.state).toBe("NOT_FOUND")
    expect(r.retryAfter).not.toBeNull()
  })

  it("clasifica contenido incorrecto como MANUAL_REVIEW sin reintento automático", () => {
    const r = classifyDownloadError(new DownloadError("BAD_CONTENT", "no es PDF"), SPEC, 0)
    expect(r.state).toBe("MANUAL_REVIEW")
    expect(r.retryAfter).toBeNull()
  })

  it("el backoff crece con los intentos", () => {
    const a = classifyDownloadError(new DownloadError("WAF_BLOCK", "x"), SPEC, 0)
    const b = classifyDownloadError(new DownloadError("WAF_BLOCK", "x"), SPEC, 2)
    expect(new Date(b.retryAfter!).getTime()).toBeGreaterThan(new Date(a.retryAfter!).getTime())
  })

  it("isSourceBlocked respeta retry_after", () => {
    const future = { id: "x", state: "WAF_BLOCK" as const, retryAfter: new Date(Date.now() + 3600000).toISOString(), lastError: null, attempts: 1, updatedAt: "" }
    expect(isSourceBlocked(future, new Date())).toBe(true)
    const past = { ...future, retryAfter: new Date(Date.now() - 3600000).toISOString() }
    expect(isSourceBlocked(past, new Date())).toBe(false)
    expect(isSourceBlocked(null, new Date())).toBe(false)
    const available = { ...future, state: "AVAILABLE" as const }
    expect(isSourceBlocked(available, new Date())).toBe(false)
  })

  it("MANUAL_REVIEW sin fecha sigue bloqueada (requiere acción humana)", () => {
    const manual = { id: "x", state: "MANUAL_REVIEW" as const, retryAfter: null, lastError: null, attempts: 1, updatedAt: "" }
    expect(isSourceBlocked(manual, new Date())).toBe(true)
  })
})

describe("cobertura documental", () => {
  let catalog: NormativeCatalog

  beforeEach(() => {
    const mem = new DatabaseSync(":memory:")
    const db = new NormativeDB(mem)
    db.upsertDocument({
      id: "CCT-IMSS-SNTSS-2025-2027", title: "CCT 2025-2027", organization: ["IMSS"], type: "collective_agreement",
      category: "cct", canonical: true, provenance: "OFFICIAL", url: "u", validity: "CURRENT", priority: "critical", topics: [], sourceSpecHash: "",
    })
    db.upsertVersion({
      id: "CCT-IMSS-SNTSS-2025-2027@2025-2027", documentId: "CCT-IMSS-SNTSS-2025-2027", label: "2025-2027", dir: "/tmp/cct",
      sha256: "sha", downloadedAt: "2026-08-14T00:00:00.000Z", lastCheckedAt: "2026-08-14T00:00:00.000Z",
      contentType: "application/pdf", size: 1, resolvedUrl: "u", originalUrl: "u", status: "VERIFIED", pages: 597,
    })
    catalog = new NormativeCatalog(process.cwd())
    catalog.db = db
  })

  it("detecta cobertura completa para tema con CCT disponible", () => {
    const r = buildCoverage(catalog, "¿me pueden cambiar el horario?")
    expect(r.total).toBeGreaterThan(0)
    const cct = r.items.find((i) => i.id === "CCT-IMSS-SNTSS-2025-2027")
    expect(cct?.status).toBe("available")
    const faltante = r.items.find((i) => i.id === "IMSS-1A74-003-032")
    expect(faltante?.status).toBe("unavailable")
    expect(r.coverage).toBeLessThan(100)
    expect(r.recommended).toBe(false)
    expect(r.warnings.length).toBeGreaterThan(0)
  })

  it("marca revisión obligatoria en Estatutos (vigencia no confirmada)", () => {
    const db = catalog.db
    db.upsertDocument({
      id: "SNTSS-ESTATUTOS-2022", title: "Estatutos SNTSS", edition: "Octubre 2022", organization: ["SNTSS"],
      type: "union_statutes", category: "sntss", canonical: true, provenance: "OFFICIAL", url: "u",
      validity: "PENDING_REVIEW", priority: "critical", topics: [], sourceSpecHash: "",
    })
    db.upsertVersion({
      id: "SNTSS-ESTATUTOS-2022@V1", documentId: "SNTSS-ESTATUTOS-2022", label: "V1", dir: "/tmp/est",
      sha256: "sha", downloadedAt: "2026-08-14T00:00:00.000Z", lastCheckedAt: "2026-08-14T00:00:00.000Z",
      contentType: "application/pdf", size: 1, resolvedUrl: "u", originalUrl: "u", status: "VERIFIED", pages: 72,
    })
    const r = buildCoverage(catalog, "mis derechos sindicales")
    const estatutos = r.items.find((i) => i.id === "SNTSS-ESTATUTOS-2022")
    expect(estatutos?.status).toBe("review")
    expect(r.warnings.some((w) => /revisión humana/i.test(w))).toBe(true)
  })
})

describe("comparador de versiones", () => {
  let db: NormativeDB

  beforeEach(() => {
    db = new NormativeDB(new DatabaseSync(":memory:"))
    for (const [id, label, clauses] of [
      ["CCT-A", "V1", [
        { label: "Cláusula 1", text: "La jornada será de ocho horas." },
        { label: "Cláusula 2", text: "El pago será de 60 días de sueldo." },
        { label: "Cláusula 3", text: "Texto idéntico en ambas versiones." },
      ]],
      ["CCT-B", "V2", [
        { label: "Cláusula 1", text: "La jornada será de nueve horas." },
        { label: "Cláusula 2", text: "El pago será de 90 días de sueldo." },
        { label: "Cláusula 3", text: "Texto idéntico en ambas versiones." },
        { label: "Cláusula 4", text: "Cláusula nueva sobre teletrabajo." },
      ]],
    ] as const) {
      db.upsertDocument({
        id, title: id, organization: ["IMSS"], type: "collective_agreement", category: "cct",
        canonical: true, provenance: "OFFICIAL", url: "u", validity: id === "CCT-B" ? "CURRENT" : "HISTORICAL",
        priority: "high", topics: [], sourceSpecHash: "",
      })
      const versionId = `${id}@${label}`
      db.upsertVersion({
        id: versionId, documentId: id, label, dir: `/tmp/${id}`, sha256: `sha-${id}`, downloadedAt: "2026-08-14T00:00:00.000Z",
        lastCheckedAt: "2026-08-14T00:00:00.000Z", contentType: "application/pdf", size: 1, resolvedUrl: "u",
        originalUrl: "u", status: "VERIFIED", pages: 5,
      })
      const sections = clauses.map((c, i) => ({
        id: `${versionId}-s${i}`, documentId: id, versionId, kind: "clausula", label: c.label, order: i,
        startPage: i + 1, endPage: i + 1, parentId: null,
      }))
      db.replaceSections(sections)
      db.replaceChunks(
        clauses.map((c, i) => ({
          id: `${versionId}-c${i}`, documentId: id, versionId, sectionId: `${versionId}-s${i}`,
          pdfPageIndex: i + 1, printedPage: null, section: c.label, article: null, clause: c.label.replace("Cláusula ", ""),
          numeral: null, text: c.text, order: i + 1,
        }))
      )
    }
  })

  it("detecta añadidas, eliminadas, modificadas e idénticas", () => {
    const r = compareDocuments(db, "CCT-A", "CCT-B")
    expect(r).not.toBeNull()
    expect(r!.added.map((c) => c)).toContain("Cláusula 4")
    expect(r!.removed).toHaveLength(0)
    expect(r!.modified.map((m) => m.clause)).toEqual(expect.arrayContaining(["Cláusula 1", "Cláusula 2"]))
    expect(r!.unchanged).toContain("Cláusula 3")
  })

  it("detecta cambios de cifras (60 → 90)", () => {
    const r = compareDocuments(db, "CCT-A", "CCT-B")!
    const c2 = r.modified.find((m) => m.clause === "Cláusula 2")
    expect(c2?.changedNumbers).toEqual(expect.arrayContaining([{ before: 60, after: 90 }]))
  })
})
