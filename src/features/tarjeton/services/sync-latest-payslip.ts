/**
 * Orquestador canónico de sincronización y análisis del Tarjetón IMSS.
 *
 * Flujo:
 * 1. Localiza el tarjetón guardado más reciente en "Mis documentos".
 * 2. Recupera sus bytes reales de forma segura (Android puente o IndexedDB).
 * 3. Comprueba el encabezado %PDF y calcula su hash SHA-256.
 * 4. Verifica idempotencia por (documentHash + parserVersion).
 * 5. Ejecuta el parser completo y extrae todos los conceptos y totales.
 * 6. Persiste el resultado como PayslipAnalysis vinculado al documento.
 * 7. Sincroniza hacia el perfil laboral respetando datos manuales sin duplicar historial.
 * 8. Notifica a toda la interfaz que el análisis está listo.
 *
 * La Veinte Digital.
 */
import { getLatestSavedPayslipDocument, calculatePeriodRank } from "./saved-payslip-repository"
import {
  CURRENT_PARSER_VERSION,
  getPayslipAnalysisByHash,
  savePayslipAnalysis,
  type PayslipAnalysis,
  type PayslipConcept,
} from "./payslip-analysis-store"
import { computeFileSha256 } from "@/features/tarjeton/lib/file-hash"
import { loadPdfDocument } from "@/features/tarjeton/lib/pdfjs-client"
import { extractNativePdfText } from "@/features/tarjeton/lib/extract-native-pdf"
import { runOcrFallback } from "@/features/tarjeton/lib/run-ocr-fallback"
import { renderPdfPageToCanvas } from "@/features/tarjeton/lib/render-pdf-page"
import { parseImssTarjeton } from "@/features/tarjeton/lib/imss-tarjeton-parser"
import { buildImssLayoutRegions } from "@/features/tarjeton/lib/imss-layout-regions"
import { sanitizeTarjetonForPersistence } from "@/features/tarjeton/lib/safe-values"
import { getPayslips, savePayslip, getProfile, saveProfile } from "@/shared/services/local-storage"
import { getPayPeriod } from "@/features/nomina/lib/periods"
import { institutionalToday } from "@/shared/lib/dates"
import type { ImportedPayslipLine } from "@/features/nomina/lib/types"

export interface SyncLatestPayslipOptions {
  force?: boolean
  onProgress?: (status: string, message: string) => void
}

let syncInFlightPromise: Promise<PayslipAnalysis | null> | null = null

export async function syncLatestSavedPayslip(
  options: SyncLatestPayslipOptions = {}
): Promise<PayslipAnalysis | null> {
  if (syncInFlightPromise && !options.force) {
    return syncInFlightPromise
  }

  const task = (async (): Promise<PayslipAnalysis | null> => {
    // 1. Localizar el tarjetón más reciente en "Mis documentos"
    const doc = await getLatestSavedPayslipDocument()
    if (!doc) {
      return null
    }

    // 2. Recuperar los bytes
    const bytes = await doc.getBytes()
    if (!bytes || bytes.byteLength === 0) {
      console.warn("[syncLatestSavedPayslip] No se pudieron obtener los bytes del documento:", doc.id)
      return null
    }

    // 3. Validar encabezado %PDF
    const header = new TextDecoder().decode(bytes.slice(0, 5))
    if (!header.startsWith("%PDF")) {
      console.warn("[syncLatestSavedPayslip] El archivo no tiene cabecera PDF válida:", doc.name)
      return null
    }

    // 4. Calcular huella digital SHA-256
    const documentHash = await computeFileSha256(bytes.buffer as ArrayBuffer)

    // 5. Verificar idempotencia: si ya fue analizado con esta versión del parser y está listo, reutilizar
    const cached = getPayslipAnalysisByHash(documentHash, CURRENT_PARSER_VERSION)
    if (cached && cached.status === "ready" && cached.concepts.length > 0 && !options.force) {
      return cached
    }

    // 6. Notificar estado analyzing
    options.onProgress?.("analyzing", "Analizando conceptos del tarjetón...")
    savePayslipAnalysis({
      documentId: doc.id,
      documentHash,
      parserVersion: CURRENT_PARSER_VERSION,
      period: doc.periodKey || doc.name,
      periodRank: doc.periodRank,
      perceptionsTotal: 0,
      deductionsTotal: 0,
      netAmount: 0,
      concepts: [],
      status: "analyzing",
      analyzedAt: null,
      errorCode: null,
    })

    // 7. Cargar PDF y extraer texto
    try {
      const { pdf, loadingTask } = await loadPdfDocument(bytes.slice().buffer)
      const pageCount = pdf.numPages
      const { items: nativeItems, pageTexts } = await extractNativePdfText(loadingTask)
      let items = nativeItems

      const layout = buildImssLayoutRegions(items)
      const totalChars = pageTexts.join(" ").replace(/\s+/g, "").length
      if (totalChars < 100 || (layout.earningsLines.length <= 1 && layout.deductionLines.length <= 1)) {
        try {
          const canvases: HTMLCanvasElement[] = []
          for (let p = 1; p <= pageCount; p++) {
            const canvas = await renderPdfPageToCanvas(pdf, p)
            canvases.push(canvas)
          }
          const ocr = await runOcrFallback(canvases)
          if (ocr.items.length > items.length) {
            items = ocr.items
          }
        } catch (ocrErr) {
          console.warn("[syncLatestSavedPayslip] Fallback OCR no aplicado:", ocrErr)
        }
      }

      // 8. Parser IMSS
      const outcome = await parseImssTarjeton({
        items,
        pageCount,
        hashText: async (t) => `hash:${t.length}`,
      })

      if (!outcome.ok) {
        savePayslipAnalysis({
          documentId: doc.id,
          documentHash,
          parserVersion: CURRENT_PARSER_VERSION,
          period: doc.periodKey || doc.name,
          periodRank: doc.periodRank,
          perceptionsTotal: 0,
          deductionsTotal: 0,
          netAmount: 0,
          concepts: [],
          status: "error",
          analyzedAt: new Date().toISOString(),
          errorCode: "parse_failed",
          errorMessage: outcome.message || "Error al interpretar conceptos del tarjetón.",
        })
        return null
      }

      const { parsed: safeParsed } = sanitizeTarjetonForPersistence(outcome.parsed)

      // 9. Extraer TODOS los conceptos individuales (percepciones y deducciones)
      // NUNCA descartar conceptos no catalogados o desconocidos
      const concepts: PayslipConcept[] = []
      for (const e of safeParsed.payroll.earnings) {
        concepts.push({
          code: e.code || null,
          description: e.description,
          amount: e.amount,
          kind: "perception",
        })
      }
      for (const d of safeParsed.payroll.deductions) {
        concepts.push({
          code: d.code || null,
          description: d.description,
          amount: Math.abs(d.amount),
          kind: "deduction",
        })
      }

      // 10. Totales y balance contable
      const perceptionsTotal =
        safeParsed.payroll.totalEarnings ??
        concepts.filter((c) => c.kind === "perception").reduce((s, c) => s + c.amount, 0)
      const deductionsTotal =
        safeParsed.payroll.totalDeductions ??
        concepts.filter((c) => c.kind === "deduction").reduce((s, c) => s + c.amount, 0)
      const netAmount =
        safeParsed.payroll.netPay ?? (perceptionsTotal - deductionsTotal)

      // Determinar periodo
      const docYear = safeParsed.document.year || doc.year || 0
      const docMonth = safeParsed.document.month || doc.month || 0
      const docHalf = safeParsed.document.half || doc.half || 1
      const finalPeriodRank =
        doc.periodRank > 0
          ? doc.periodRank
          : docYear > 0 && docMonth > 0
          ? calculatePeriodRank(docYear, docMonth, docHalf)
          : 0
      const finalPeriod =
        safeParsed.document.periodRaw ||
        doc.periodKey ||
        (docYear > 0 ? `${docHalf}A-${docMonth}-${docYear}` : doc.name)

      // 11. Guardar PayslipAnalysis listo
      const readyAnalysis: PayslipAnalysis = {
        documentId: doc.id,
        documentHash,
        parserVersion: CURRENT_PARSER_VERSION,
        period: finalPeriod,
        periodRank: finalPeriodRank,
        perceptionsTotal,
        deductionsTotal,
        netAmount,
        concepts,
        status: "ready",
        analyzedAt: new Date().toISOString(),
        errorCode: null,
      }

      savePayslipAnalysis(readyAnalysis)

      // 12. Sincronizar en localStorage como ImportedPayslip para compatibilidad
      const earningsLines: ImportedPayslipLine[] = concepts
        .filter((c) => c.kind === "perception")
        .map((c) => ({
          code: c.code || "",
          description: c.description,
          amount: c.amount,
          confirmedByUser: true,
          includeInNextProjection: true,
        }))

      const deductionsLines: ImportedPayslipLine[] = concepts
        .filter((c) => c.kind === "deduction")
        .map((c) => ({
          code: c.code || "",
          description: c.description,
          amount: c.amount,
          confirmedByUser: true,
          includeInNextProjection: true,
        }))

      const currentSlips = getPayslips()
      const existingSlip = currentSlips.find(
        (s) =>
          s.id === doc.id ||
          (s.periodRaw && (s.periodRaw === finalPeriod || String(s.period).includes(finalPeriod)))
      )
      const slipId = existingSlip?.id || doc.id
      const periodObj =
        docYear > 0 && docMonth > 0
          ? getPayPeriod(docYear, docMonth, docHalf)
          : existingSlip?.period || getPayPeriod(institutionalToday().getFullYear(), institutionalToday().getMonth() + 1, 1)

      savePayslip({
        id: slipId,
        userId: existingSlip?.userId || "local",
        period: periodObj,
        periodRaw: finalPeriod,
        categoryName: safeParsed.employee.categoryName || existingSlip?.categoryName,
        institutionalEntryDate: safeParsed.employee.entryDate || existingSlip?.institutionalEntryDate,
        earnings: earningsLines,
        deductions: deductionsLines,
        perceptions: earningsLines,
        totalEarnings: perceptionsTotal,
        totalDeductions: deductionsTotal,
        netPay: netAmount,
        netAmount,
        source: "pdf",
        confirmedByUser: true,
        analysisStatus: "ready",
      })

      // 13. Actualizar perfil laboral derivado respetando campos manuales
      const existingProfile = getProfile()
      if (existingProfile) {
        const updatedProfile = { ...existingProfile }
        // Actualizar categoría solo si no fue fijada manualmente por el usuario
        if (!existingProfile.categoryName && safeParsed.employee.categoryName) {
          updatedProfile.categoryName = safeParsed.employee.categoryName
          updatedProfile.categoryCode = safeParsed.employee.categoryCode
        }
        if (
          (!existingProfile.workdayHours || existingProfile.workdayHours === 8) &&
          safeParsed.employee.workdayHours &&
          (safeParsed.employee.workdayHours === 6 ||
            safeParsed.employee.workdayHours === 6.5 ||
            safeParsed.employee.workdayHours === 8 ||
            safeParsed.employee.workdayHours === 12)
        ) {
          updatedProfile.workdayHours = safeParsed.employee.workdayHours
        }
        if (!existingProfile.institutionalEntryDate && safeParsed.employee.entryDate) {
          updatedProfile.institutionalEntryDate = safeParsed.employee.entryDate
        }
        saveProfile(updatedProfile)
      }

      // 14. Notificar a la app
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("nomina_payslip_updated"))
        window.dispatchEvent(
          new CustomEvent("tarjeton_analysis_completed", {
            detail: readyAnalysis,
          })
        )
      }

      return readyAnalysis
    } catch (err) {
      console.error("[syncLatestSavedPayslip] Error durante el análisis:", err)
      savePayslipAnalysis({
        documentId: doc.id,
        documentHash,
        parserVersion: CURRENT_PARSER_VERSION,
        period: doc.periodKey || doc.name,
        periodRank: doc.periodRank,
        perceptionsTotal: 0,
        deductionsTotal: 0,
        netAmount: 0,
        concepts: [],
        status: "error",
        analyzedAt: new Date().toISOString(),
        errorCode: "processing_error",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  })()

  syncInFlightPromise = task
  try {
    return await task
  } finally {
    syncInFlightPromise = null
  }
}
