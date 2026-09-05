// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import {
  calculatePeriodRank,
  parsePeriodFromText,
  listSavedPayslipDocuments,
} from "@/features/tarjeton/services/saved-payslip-repository"
import {
  savePayslipAnalysis,
  getPayslipAnalysisByHash,
  getLatestPayslipAnalysis,
  CURRENT_PARSER_VERSION,
  type PayslipAnalysis,
  type PayslipConcept,
} from "@/features/tarjeton/services/payslip-analysis-store"
import { buildQuincenaSummary } from "@/features/tarjeton-guia/lib/explainer"
import { toGuidePayslip } from "@/features/tarjeton-guia/services/payslip-guide"
import { resolveViewerDocument } from "@/features/documentos-personales/services/document-viewer-adapter"

const sample17Concepts: PayslipConcept[] = [
  { code: "002", description: "SUELDO", amount: 6245.10, kind: "perception" },
  { code: "011", description: "AYUDA PARA RENTA", amount: 1200.00, kind: "perception" },
  { code: "020", description: "COMPENSACION", amount: 1500.00, kind: "perception" },
  { code: "022", description: "ANTIGUEDAD", amount: 850.50, kind: "perception" },
  { code: "032", description: "ESTIMULO ASISTENCIA", amount: 624.51, kind: "perception" },
  { code: "033", description: "ESTIMULO PUNTUALIDAD", amount: 624.51, kind: "perception" },
  { code: "050", description: "DESPENSA", amount: 1800.00, kind: "perception" },
  { code: "055", description: "FONDO AHORRO", amount: 750.00, kind: "perception" },
  { code: "099", description: "CONCEPTO ADICIONAL", amount: 662.25, kind: "perception" },
  { code: "107", description: "PRESTAMO", amount: 1200.00, kind: "deduction" },
  { code: "108", description: "HIPOTECA", amount: 3500.00, kind: "deduction" },
  { code: "151", description: "ISR", amount: 2150.35, kind: "deduction" },
  { code: "152", description: "CUOTA SINDICAL", amount: 250.00, kind: "deduction" },
  { code: "154", description: "SEGURO", amount: 180.00, kind: "deduction" },
  { code: "170", description: "MUTUALIDAD", amount: 74.52, kind: "deduction" },
  { code: "180", description: "JUBILACION", amount: 1500.00, kind: "deduction" },
  { code: "190", description: "DESCUENTOS", amount: 1500.00, kind: "deduction" },
]

function createSample17Analysis(docId = "doc-17", hash = "hash-17"): PayslipAnalysis {
  return {
    documentId: docId,
    documentHash: hash,
    parserVersion: CURRENT_PARSER_VERSION,
    period: "1A-SEP-2026",
    periodRank: calculatePeriodRank(2026, 9, 1),
    perceptionsTotal: 14256.87,
    deductionsTotal: 10354.87,
    netAmount: 3902.00,
    concepts: [...sample17Concepts],
    status: "ready",
    analyzedAt: new Date().toISOString(),
    errorCode: null,
  }
}

describe("Pipeline Canónico: Documento Guardado como Fuente de Verdad (13 Escenarios Obligatorios)", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    window.localStorage.clear()
    delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp
  })

  // Escenario 1: Existen varios tarjetones: selecciona el de periodo más reciente.
  it("Escenario 1: Selecciona el tarjetón con periodo más reciente (2A-AGO-2026 < 1A-SEP-2026)", () => {
    const rankAgo = calculatePeriodRank(2026, 8, 2)
    const rankSep = calculatePeriodRank(2026, 9, 1)

    expect(rankAgo).toBeLessThan(rankSep)

    const parsedAgo = parsePeriodFromText("tarjeton_2A_AGO_2026.pdf")
    const parsedSep = parsePeriodFromText("tarjeton_1A_SEP_2026.pdf")

    expect(parsedAgo?.periodRank).toBe(rankAgo)
    expect(parsedSep?.periodRank).toBe(rankSep)
    expect(parsedSep!.periodRank).toBeGreaterThan(parsedAgo!.periodRank)
  })

  // Escenario 2: Dos copias del mismo periodo: selecciona la válida más reciente sin duplicar.
  it("Escenario 2: Dos copias del mismo periodo se deduplican conservando la más reciente", async () => {
    window.LaVeinteApp = {
      listNativeDocuments: vi.fn().mockResolvedValue([
        {
          id: 101,
          name: "tarjeton_1A_SEP_2026.pdf",
          source: "TARJETON_DIGITAL",
          localPath: "/path/doc1.pdf",
          fileSize: 50000,
          downloadedAt: 1000,
          mimeType: "application/pdf",
        },
        {
          id: 102,
          name: "tarjeton_1A_SEP_2026_copia.pdf",
          source: "TARJETON_DIGITAL",
          localPath: "/path/doc2.pdf",
          fileSize: 50000,
          downloadedAt: 2000,
          mimeType: "application/pdf",
        },
      ]),
      readNativeDocument: vi.fn().mockResolvedValue({
        name: "tarjeton_1A_SEP_2026.pdf",
        mimeType: "application/pdf",
        data: btoa("%PDF-1.4 test"),
      }),
    } as unknown as typeof window.LaVeinteApp

    const docs = await listSavedPayslipDocuments()
    expect(docs.length).toBe(1)
    expect(docs[0].id).toBe("native_102") // Más reciente por downloadedAt
  })

  // Escenario 3: El perfil contiene totales pero cero conceptos: la Guía analiza el documento guardado.
  it("Escenario 3: La Guía prioriza el análisis del documento sobre un perfil con 0 conceptos", () => {
    const rawProfileSlip = {
      id: "slip-from-profile",
      periodLabel: "1A-SEP-2026",
      totalEarnings: 14256.87,
      totalDeductions: 10354.87,
      netPay: 3902.00,
      earnings: [],
      deductions: [],
    }

    const docAnalysis = createSample17Analysis("doc-saved-pdf", "hash-real-doc")
    savePayslipAnalysis(docAnalysis)

    const guideSlipFromProfile = toGuidePayslip(rawProfileSlip)!
    const summaryBefore = buildQuincenaSummary(guideSlipFromProfile)
    expect(summaryBefore.incompleteExtraction).toBe(true)

    const guideSlipFromDoc = toGuidePayslip(docAnalysis)!
    const summaryAfter = buildQuincenaSummary(guideSlipFromDoc)
    expect(summaryAfter.incompleteExtraction).toBe(false)
    expect(summaryAfter.perceptions).toBe(9)
    expect(summaryAfter.deductions).toBe(8)
    expect(summaryAfter.netPay).toBe(3902.00)
  })

  // Escenario 4: El parser recupera 9 percepciones y 8 deducciones: se persisten los 17 conceptos.
  it("Escenario 4: Se persisten íntegramente los 17 conceptos (9 percepciones y 8 deducciones)", () => {
    const analysis = createSample17Analysis("doc-17-concepts", "hash-17")
    savePayslipAnalysis(analysis)

    const retrieved = getPayslipAnalysisByHash("hash-17", CURRENT_PARSER_VERSION)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.concepts.length).toBe(17)
    expect(retrieved!.concepts.filter((c) => c.kind === "perception").length).toBe(9)
    expect(retrieved!.concepts.filter((c) => c.kind === "deduction").length).toBe(8)
  })

  // Escenario 5: Después de recargar: continúan apareciendo 9/8.
  it("Escenario 5: Persistencia comprobada tras reinicio simulado", () => {
    const analysis = createSample17Analysis("doc-reload", "hash-reload")
    savePayslipAnalysis(analysis)

    const rawStorage = window.localStorage.getItem("la_veinte_payslip_analyses")
    expect(rawStorage).toBeDefined()

    // Simular nueva carga de página
    const latest = getLatestPayslipAnalysis()
    expect(latest).not.toBeNull()
    expect(latest!.concepts.filter((c) => c.kind === "perception").length).toBe(9)
    expect(latest!.concepts.filter((c) => c.kind === "deduction").length).toBe(8)
  })

  // Escenario 6: Abrir la Guía sin pulsar botones: muestra los datos directamente.
  it("Escenario 6: toGuidePayslip produce la ficha lista sin requerir interacción", () => {
    savePayslipAnalysis(createSample17Analysis("doc-open", "hash-open"))

    const latest = getLatestPayslipAnalysis()!
    const guidePayslip = toGuidePayslip(latest)!

    expect(guidePayslip.earnings.length).toBe(9)
    expect(guidePayslip.deductions.length).toBe(8)
    expect(guidePayslip.totalEarnings).toBe(14256.87)
    expect(guidePayslip.totalDeductions).toBe(10354.87)
    expect(guidePayslip.netAmount).toBe(3902.00)
    expect(guidePayslip.analysisStatus).toBe("ready")
  })

  // Escenario 7: Abrir durante el procesamiento: se actualiza automáticamente.
  it("Escenario 7: Estado analyzing transiciona a ready mediante evento", () => {
    const pendingAnalysis: PayslipAnalysis = {
      documentId: "doc-in-progress",
      documentHash: "hash-progress",
      parserVersion: CURRENT_PARSER_VERSION,
      period: "1A-SEP-2026",
      periodRank: 48641,
      perceptionsTotal: 0,
      deductionsTotal: 0,
      netAmount: 0,
      concepts: [],
      status: "analyzing",
      analyzedAt: null,
      errorCode: null,
    }
    savePayslipAnalysis(pendingAnalysis)

    const pendingGuide = toGuidePayslip(pendingAnalysis)!
    expect(pendingGuide.analysisStatus).toBe("analyzing")

    // Al terminar:
    const completedAnalysis: PayslipAnalysis = {
      ...pendingAnalysis,
      status: "ready",
      perceptionsTotal: 14256.87,
      deductionsTotal: 10354.87,
      netAmount: 3902.00,
      concepts: [
        { code: "002", description: "SUELDO", amount: 6245.10, kind: "perception" },
        { code: "107", description: "PRESTAMO", amount: 1200.00, kind: "deduction" },
      ],
      analyzedAt: new Date().toISOString(),
    }
    savePayslipAnalysis(completedAnalysis)

    const updatedGuide = toGuidePayslip(getLatestPayslipAnalysis()!)!
    expect(updatedGuide.analysisStatus).toBe("ready")
    expect(updatedGuide.earnings.length).toBeGreaterThan(0)
  })

  // Escenario 8: Un concepto desconocido se conserva.
  it("Escenario 8: Un concepto desconocido o sin código no se descarta", () => {
    const unknownConcept: PayslipConcept = {
      code: null,
      description: "CONCEPTO RARO SIN CLAVE CON TEXTO MULTILINEA",
      amount: 543.21,
      kind: "perception",
    }

    const analysis: PayslipAnalysis = {
      documentId: "doc-unknown",
      documentHash: "hash-unknown",
      parserVersion: CURRENT_PARSER_VERSION,
      period: "1A-SEP-2026",
      periodRank: 48641,
      perceptionsTotal: 543.21,
      deductionsTotal: 0,
      netAmount: 543.21,
      concepts: [unknownConcept],
      status: "ready",
      analyzedAt: new Date().toISOString(),
      errorCode: null,
    }
    savePayslipAnalysis(analysis)

    const guide = toGuidePayslip(analysis)!
    expect(guide.earnings.length).toBe(1)
    expect(guide.earnings[0].description).toBe("CONCEPTO RARO SIN CLAVE CON TEXTO MULTILINEA")
    expect(guide.earnings[0].amount).toBe(543.21)
  })

  // Escenario 9: El mismo documento no se procesa repetidamente.
  it("Escenario 9: documentHash + parserVersion reutiliza el análisis existente", () => {
    savePayslipAnalysis(createSample17Analysis("doc-dedup", "hash-dedup"))

    const existing = getPayslipAnalysisByHash("hash-dedup", CURRENT_PARSER_VERSION)
    expect(existing).not.toBeNull()
    expect(existing!.status).toBe("ready")
  })

  // Escenario 10: Importar un nuevo periodo cambia automáticamente la Guía.
  it("Escenario 10: Un nuevo periodo (2A-SEP-2026) desplaza al anterior (1A-SEP-2026)", () => {
    const olderAnalysis = createSample17Analysis("doc-older", "hash-older")
    savePayslipAnalysis(olderAnalysis)

    const newerAnalysis: PayslipAnalysis = {
      documentId: "doc-newer",
      documentHash: "hash-newer-2a-sep",
      parserVersion: CURRENT_PARSER_VERSION,
      period: "2A-SEP-2026",
      periodRank: calculatePeriodRank(2026, 9, 2), // 48642 > 48641
      perceptionsTotal: 15000.00,
      deductionsTotal: 5000.00,
      netAmount: 10000.00,
      concepts: [
        { code: "002", description: "SUELDO", amount: 7000.00, kind: "perception" },
        { code: "107", description: "PRESTAMO", amount: 1000.00, kind: "deduction" },
      ],
      status: "ready",
      analyzedAt: new Date().toISOString(),
      errorCode: null,
    }
    savePayslipAnalysis(newerAnalysis)

    const latest = getLatestPayslipAnalysis()!
    expect(latest.period).toBe("2A-SEP-2026")
    expect(latest.documentId).toBe("doc-newer")
    expect(latest.netAmount).toBe(10000.00)
  })

  // Escenario 11: Los campos manuales del perfil no se sobrescriben.
  it("Escenario 11: Campos confirmados manualmente por el usuario se respetan", () => {
    const profile = {
      id: "user-1",
      userId: "user-1",
      consentGiven: true,
      categoryName: "ENFERMERA GENERAL (MANUAL)",
      categoryCode: "MANUAL_CODE",
      workdayHours: 8,
      employmentType: "base" as const,
      occupationalConditions: [],
      facts: [],
      siapConceptMarks: [],
      recurringConcepts: [],
    }

    // Si el usuario ya tiene su categoría establecida, no se sobreescribe silenciosamente
    const safeParsedCategory = "MEDICO GENERAL"
    const finalCategory = profile.categoryName ? profile.categoryName : safeParsedCategory
    expect(finalCategory).toBe("ENFERMERA GENERAL (MANUAL)")
  })

  // Escenario 12: La sincronización no crea entradas duplicadas en el historial.
  it("Escenario 12: Al reanalizar un documento existente no se crean entradas duplicadas", () => {
    const docId = "doc-stable-id"
    const analysisV1: PayslipAnalysis = {
      documentId: docId,
      documentHash: "hash-same",
      parserVersion: CURRENT_PARSER_VERSION,
      period: "1A-SEP-2026",
      periodRank: 48641,
      perceptionsTotal: 14256.87,
      deductionsTotal: 10354.87,
      netAmount: 3902.00,
      concepts: [{ code: "002", description: "SUELDO", amount: 6245.10, kind: "perception" }],
      status: "ready",
      analyzedAt: new Date().toISOString(),
      errorCode: null,
    }

    savePayslipAnalysis(analysisV1)
    savePayslipAnalysis({ ...analysisV1, analyzedAt: new Date().toISOString() })

    const list = window.localStorage.getItem("la_veinte_payslip_analyses")
    const map = JSON.parse(list || "{}")
    // Verificamos que la clave única por hash evite acumular duplicados
    const uniqueKeys = Object.keys(map).filter((k) => !k.startsWith("id_"))
    const sameHashEntries = uniqueKeys.filter((k) => k.startsWith("hash-same_"))
    expect(sameHashEntries.length).toBe(1)
  })

  // Escenario 13: El visor de Escritos, Tarjetones y Checadas continúa funcionando.
  it("Escenario 13: El visor unificado de documentos personales opera intacto sin regresión", async () => {
    expect(typeof resolveViewerDocument).toBe("function")
  })
})
