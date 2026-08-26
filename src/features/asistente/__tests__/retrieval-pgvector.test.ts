import { describe, it, expect } from "vitest"
import {
  buildContextWithSources,
  classifyRetrievalIntent,
  dedupeByText,
  diversifyByDocument,
  extractExactRefs,
  fuentesPayload,
  rowToSource,
  validateCitations,
  VALIDITY_WEIGHT,
  type RetrievedSource,
} from "../lib/retrieval-sources"

function makeSource(partial: Partial<RetrievedSource>): RetrievedSource {
  return {
    id: "S1",
    chunkId: "CCT-IMSS-SNTSS-2025-2027@V1:10",
    documentId: "CCT-IMSS-SNTSS-2025-2027",
    documento: "Contrato Colectivo de Trabajo IMSS-SNTSS 2025-2027",
    version: "CCT-IMSS-SNTSS-2025-2027@V1",
    tipo: "clausula",
    numero: "63 Bis",
    paginaInicio: 123,
    paginaFin: 124,
    fragmento: "Los trabajadores disfrutarán de un período de vacaciones…",
    sourceUrl: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
    validity: "CURRENT",
    pendingReview: false,
    score: 100,
    ...partial,
  }
}

describe("extractExactRefs", () => {
  it("detecta cláusula con bis", () => {
    expect(extractExactRefs("¿Qué dice la cláusula 63 bis?")).toEqual({ clause: "63 bis" })
  })

  it("detecta artículo simple", () => {
    expect(extractExactRefs("explícame el artículo 30 de la LFT")).toEqual({ article: "30" })
  })

  it("detecta homoclave de procedimiento IMSS", () => {
    expect(extractExactRefs("¿qué es el procedimiento 1A74-003-031?")).toEqual({
      key: "1A74-003-031",
    })
  })

  it("detecta claves de NOM cortas y completas", () => {
    expect(extractExactRefs("¿qué establece la NOM-229?")).toEqual({ key: "NOM-229" })
    expect(extractExactRefs("dime qué dice la NOM-087-SEMARNAT-SSA1-2002")).toEqual({
      key: "NOM-087-SEMARNAT-SSA1-2002",
    })
  })

  it("no inventa referencias cuando no hay", () => {
    expect(extractExactRefs("¿cuántos días de vacaciones tengo?")).toEqual({})
  })
})

describe("validateCitations — el LLM no puede inventar fuentes", () => {
  const sources = [makeSource({ id: "S1" }), makeSource({ id: "S2" })]

  it("conserva citas válidas y las reporta", () => {
    const r = validateCitations("Tienes derecho a vacaciones [S1]. Ver también [S2].", sources)
    expect(r.citedIds).toEqual(["S1", "S2"])
    expect(r.invalidIdsRemoved).toEqual([])
    expect(r.respuesta).toContain("[S1]")
  })

  it("elimina referencias inventadas ([S9] no recuperado)", () => {
    const r = validateCitations("La cláusula dice X [S9] y también [S1]", sources)
    expect(r.respuesta).not.toContain("[S9]")
    expect(r.respuesta).toContain("[S1]")
    expect(r.invalidIdsRemoved).toEqual(["S9"])
  })

  it("sin fuentes no hay cita válida posible", () => {
    const r = validateCitations("todo [S1] es invención", [])
    expect(r.respuesta).not.toContain("[S")
    expect(r.citedIds).toEqual([])
  })
})

describe("fuentesPayload", () => {
  it("marca PENDING_REVIEW con advertencia explícita", () => {
    const src = makeSource({ id: "S1", validity: "PENDING_REVIEW", pendingReview: true })
    const out = fuentesPayload([src], ["S1"]) as Array<Record<string, unknown>>
    expect(out[0].advertenciaVigencia).toBeTruthy()
    expect(out[0].validity).toBe("PENDING_REVIEW")
    expect(out[0].citada).toBe(true)
  })

  it("CURRENT no lleva advertencia", () => {
    const out = fuentesPayload([makeSource({})], []) as Array<Record<string, unknown>>
    expect(out[0].advertenciaVigencia).toBeUndefined()
  })

  it("expone página, tipo, número y URL para respuesta verificable", () => {
    const out = fuentesPayload([makeSource({ numero: "63 Bis", paginaInicio: 123 })], [])
      [0] as Record<string, unknown>
    expect(out.tipo).toBe("clausula")
    expect(out.numero).toBe("63 Bis")
    expect(out.paginaInicio).toBe(123)
    expect(String(out.sourceUrl)).toContain("imss.gob.mx")
  })
})

describe("buildContextWithSources", () => {
  it("etiqueta cada fragmento con su [S#] y badge de vigencia", () => {
    const ctx = buildContextWithSources([
      makeSource({ id: "S1" }),
      makeSource({ id: "S2", pendingReview: true }),
    ])
    expect(ctx).toContain("[S1]")
    expect(ctx).toContain("[S2]")
    expect(ctx).toContain("[VIGENCIA POR REVISAR]")
    expect(ctx).toContain("---")
  })
})

describe("rowToSource + pesos de vigencia", () => {
  it("HISTORICAL queda penalizado respecto a CURRENT", () => {
    expect(VALIDITY_WEIGHT["HISTORICAL"]).toBeLessThan(VALIDITY_WEIGHT["CURRENT"])
    expect(VALIDITY_WEIGHT["SUPERSEDED"]).toBeLessThan(VALIDITY_WEIGHT["PENDING_REVIEW"])
  })

  it("deriva tipo desde clause > article > section_type", () => {
    const base = {
      chunk_id: "x",
      document_id: "d",
      document_title: "t",
      version_id: "v",
      validity: "CURRENT",
      section_type: "capitulo",
      section_title: null,
      article: "30",
      clause: null,
      numeral: null,
      page_start: 5,
      page_end: 5,
      text: "texto",
      source_url: null,
    }
    expect(rowToSource(base as never, "S1", 0).tipo).toBe("articulo")
    expect(rowToSource({ ...base, article: null } as never, "S1", 0).tipo).toBe("capitulo")
    expect(
      rowToSource({ ...base, article: null, clause: "47" } as never, "S1", 0).numero,
    ).toBe("47")
  })
})

describe("classifyRetrievalIntent — bug 'derechos laborales'", () => {
  it("referencias exactas → EXACT_REFERENCE", () => {
    expect(classifyRetrievalIntent("¿Qué dice la cláusula 63 bis?")).toBe("EXACT_REFERENCE")
    expect(classifyRetrievalIntent("explícame el artículo 30")).toBe("EXACT_REFERENCE")
    expect(classifyRetrievalIntent("procedimiento 1A74-003-031")).toBe("EXACT_REFERENCE")
    expect(classifyRetrievalIntent("¿qué establece la NOM-229?")).toBe("EXACT_REFERENCE")
    expect(classifyRetrievalIntent("¿qué dice la NOM-035?")).toBe("EXACT_REFERENCE")
  })

  it("temas concretos → SPECIFIC_TOPIC", () => {
    expect(classifyRetrievalIntent("¿cuántos días de vacaciones me corresponden?")).toBe(
      "SPECIFIC_TOPIC",
    )
    expect(classifyRetrievalIntent("¿cómo funcionan las guardias festivas?")).toBe("SPECIFIC_TOPIC")
  })

  it('preguntas amplias → BROAD_TOPIC (el caso del bug)', () => {
    expect(classifyRetrievalIntent("¿Cuáles son mis derechos laborales?")).toBe("BROAD_TOPIC")
    expect(classifyRetrievalIntent("¿Qué prestaciones tengo?")).toBe("BROAD_TOPIC")
    expect(classifyRetrievalIntent("¿Qué me corresponde por trabajar en el IMSS?")).toBe("BROAD_TOPIC")
    expect(classifyRetrievalIntent("Explícame mis principales derechos")).toBe("BROAD_TOPIC")
    expect(classifyRetrievalIntent("¿Qué beneficios establece el contrato colectivo?")).toBe("BROAD_TOPIC")
  })

  it("seguimientos cortos sin tema propio → FOLLOW_UP", () => {
    expect(classifyRetrievalIntent("¿y si soy trabajador de base?")).toBe("FOLLOW_UP")
    expect(classifyRetrievalIntent("¿pero y eso aplica a sustitutos?")).toBe("FOLLOW_UP")
  })
})

describe("diversificación para BROAD_TOPIC", () => {
  function mk(doc: string, i: number): RetrievedSource & { fragmento: string } {
    return rowToSource(
      {
        chunk_id: `${doc}@V1:${i}`,
        document_id: doc,
        document_title: `Título ${doc}`,
        version_id: `${doc}@V1`,
        validity: "CURRENT",
        section_type: "capitulo",
        section_title: null,
        article: null,
        clause: null,
        numeral: null,
        page_start: i,
        page_end: i,
        text: `texto-${i}-${Math.random()}`,
        source_url: null,
      },
      "",
      100 - i,
    )
  }

  const ranked = [
    mk("CCT-IMSS-SNTSS-2025-2027", 1),
    mk("CCT-IMSS-SNTSS-2025-2027", 2),
    mk("CCT-IMSS-SNTSS-2025-2027", 3),
    mk("CCT-IMSS-SNTSS-2025-2027", 4),
    mk("LFT", 5),
    mk("NOM-035-STPS-2018", 6),
    mk("SNTSS-ESTATUTOS-2022", 7),
    mk("IMSS-CODIGO-CONDUCTA", 8),
  ]

  it("round-robin: los primeros puestos cubren TODOS los documentos", () => {
    const docs = new Set(ranked.map((r) => r.documentId))
    const out = diversifyByDocument(ranked as RetrievedSource[], 8)
    const primeros = new Set(out.slice(0, docs.size).map((s) => s.documentId))
    expect(primeros.size).toBe(docs.size)
  })

  it("los duplicados de un documento llegan solo tras agotar los demás", () => {
    const out = diversifyByDocument(ranked as RetrievedSource[], 8)
    // CCT tiene 4 candidatos y los demás 1: tras la primera ronda (5 docs),
    // solo quedan duplicados de CCT para rellenar.
    const porDoc = new Map<string, number>()
    for (const s of out) porDoc.set(s.documentId, (porDoc.get(s.documentId) ?? 0) + 1)
    expect(porDoc.get("CCT-IMSS-SNTSS-2025-2027")).toBe(4)
    expect(porDoc.get("LFT")).toBe(1)
    expect(out).toHaveLength(8)
    // Ningún duplicado antes de la posición docs.size
    const vistos = new Set<string>()
    let i = 0
    for (; i < out.length; i++) {
      if (vistos.has(out[i].documentId) && vistos.size < new Set(ranked.map((r) => r.documentId)).size) break
      vistos.add(out[i].documentId)
    }
    expect(vistos.size).toBe(new Set(ranked.map((r) => r.documentId)).size)
  })

  it("k menor que documentos: solo los mejores de cada doc", () => {
    const out = diversifyByDocument(ranked as RetrievedSource[], 3)
    expect(new Set(out.map((s) => s.documentId)).size).toBe(3)
  })

  it("dedupeByText elimina fragmentos repetidos del mismo documento", () => {
    const a = mk("CCT", 1)
    const b = mk("CCT", 99)
    b.fragmento = a.fragmento
    expect(dedupeByText([a, b])).toHaveLength(1)
  })
})
